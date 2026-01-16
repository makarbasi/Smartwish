import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual, LessThanOrEqual, In } from 'typeorm';
import { SurveillanceDetection } from './surveillance-detection.entity';
import { SurveillanceDailyStats } from './surveillance-daily-stats.entity';
import { KioskConfig } from '../kiosks/kiosk-config.entity';
import { CreateDetectionDto } from './dto/create-detection.dto';
import { QueryDetectionsDto, DeleteDetectionsDto } from './dto/query-detections.dto';

@Injectable()
export class SurveillanceService {
  constructor(
    @InjectRepository(SurveillanceDetection)
    private readonly detectionRepo: Repository<SurveillanceDetection>,
    @InjectRepository(SurveillanceDailyStats)
    private readonly statsRepo: Repository<SurveillanceDailyStats>,
    @InjectRepository(KioskConfig)
    private readonly kioskRepo: Repository<KioskConfig>,
  ) {}

  /**
   * Validate kiosk exists and API key matches
   */
  async validateKioskApiKey(kioskId: string, apiKey: string): Promise<boolean> {
    const kiosk = await this.kioskRepo.findOne({ where: { kioskId } });
    if (!kiosk) {
      return false;
    }
    return kiosk.apiKey === apiKey;
  }

  /**
   * Create a new detection record
   */
  async createDetection(dto: CreateDetectionDto): Promise<SurveillanceDetection> {
    const detection = this.detectionRepo.create({
      kioskId: dto.kioskId,
      personTrackId: dto.personTrackId,
      detectedAt: dto.detectedAt ? new Date(dto.detectedAt) : new Date(),
      dwellSeconds: dto.dwellSeconds,
      wasCounted: dto.wasCounted ?? false,
      imagePath: dto.imagePath,
    });

    const saved = await this.detectionRepo.save(detection);
    
    // Update daily stats (trigger in DB handles this, but we can also do it here for reliability)
    await this.updateDailyStats(dto.kioskId, detection.detectedAt, dto.wasCounted ?? false);
    
    return saved;
  }

  /**
   * Create multiple detection records in batch
   */
  async createDetectionsBatch(dtos: CreateDetectionDto[]): Promise<{ created: number }> {
    if (!dtos || dtos.length === 0) {
      return { created: 0 };
    }

    const detections = dtos.map(dto => this.detectionRepo.create({
      kioskId: dto.kioskId,
      personTrackId: dto.personTrackId,
      detectedAt: dto.detectedAt ? new Date(dto.detectedAt) : new Date(),
      dwellSeconds: dto.dwellSeconds,
      wasCounted: dto.wasCounted ?? false,
      imagePath: dto.imagePath,
    }));

    await this.detectionRepo.save(detections);
    
    return { created: detections.length };
  }

  /**
   * Update daily stats for a kiosk
   */
  private async updateDailyStats(kioskId: string, detectedAt: Date, wasCounted: boolean): Promise<void> {
    const dateStr = detectedAt.toISOString().split('T')[0];
    const hour = detectedAt.getUTCHours();

    let stats = await this.statsRepo.findOne({
      where: { kioskId, date: dateStr },
    });

    if (!stats) {
      stats = this.statsRepo.create({
        kioskId,
        date: dateStr,
        totalDetected: 1,
        totalCounted: wasCounted ? 1 : 0,
        hourlyCounts: { [hour]: 1 },
        peakHour: hour,
      });
    } else {
      stats.totalDetected += 1;
      if (wasCounted) {
        stats.totalCounted += 1;
      }
      
      const hourKey = hour.toString();
      stats.hourlyCounts[hourKey] = (stats.hourlyCounts[hourKey] || 0) + 1;
      
      // Recalculate peak hour
      let maxCount = 0;
      let peakHour = 0;
      for (const [h, count] of Object.entries(stats.hourlyCounts)) {
        if (count > maxCount) {
          maxCount = count;
          peakHour = parseInt(h, 10);
        }
      }
      stats.peakHour = peakHour;
    }

    await this.statsRepo.save(stats);
  }

  /**
   * Get detections for a kiosk with filtering and pagination
   */
  async getDetections(
    kioskId: string,
    query: QueryDetectionsDto,
  ): Promise<{ detections: SurveillanceDetection[]; total: number; page: number; limit: number }> {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 50, 100);
    const skip = (page - 1) * limit;

    const qb = this.detectionRepo.createQueryBuilder('d')
      .where('d.kiosk_id = :kioskId', { kioskId })
      .orderBy('d.detected_at', 'DESC');

    // Date range filter
    if (query.startDate) {
      qb.andWhere('d.detected_at >= :startDate', { startDate: query.startDate });
    }
    if (query.endDate) {
      // Add 1 day to include the end date fully
      const endDate = new Date(query.endDate);
      endDate.setDate(endDate.getDate() + 1);
      qb.andWhere('d.detected_at < :endDate', { endDate: endDate.toISOString() });
    }

    // Hour range filter
    if (query.startHour !== undefined) {
      qb.andWhere('EXTRACT(HOUR FROM d.detected_at) >= :startHour', { startHour: query.startHour });
    }
    if (query.endHour !== undefined) {
      qb.andWhere('EXTRACT(HOUR FROM d.detected_at) <= :endHour', { endHour: query.endHour });
    }

    // Counted only filter
    if (query.countedOnly) {
      qb.andWhere('d.was_counted = true');
    }

    const [detections, total] = await qb
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return { detections, total, page, limit };
  }

  /**
   * Get daily stats for a kiosk
   */
  async getDailyStats(
    kioskId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<SurveillanceDailyStats[]> {
    const where: any = { kioskId };

    if (startDate && endDate) {
      where.date = Between(startDate, endDate);
    } else if (startDate) {
      where.date = MoreThanOrEqual(startDate);
    } else if (endDate) {
      where.date = LessThanOrEqual(endDate);
    }

    return this.statsRepo.find({
      where,
      order: { date: 'DESC' },
    });
  }

  /**
   * Get summary stats for a kiosk (today, week, month)
   */
  async getSummaryStats(kioskId: string): Promise<{
    today: { detected: number; counted: number };
    yesterday: { detected: number; counted: number };
    thisWeek: { detected: number; counted: number };
    thisMonth: { detected: number; counted: number };
    peakHourToday: number | null;
  }> {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

    const todayStats = await this.statsRepo.findOne({ where: { kioskId, date: today } });
    const yesterdayStats = await this.statsRepo.findOne({ where: { kioskId, date: yesterday } });

    const weekStats = await this.statsRepo
      .createQueryBuilder('s')
      .select('SUM(s.total_detected)', 'detected')
      .addSelect('SUM(s.total_counted)', 'counted')
      .where('s.kiosk_id = :kioskId', { kioskId })
      .andWhere('s.date >= :weekAgo', { weekAgo })
      .getRawOne();

    const monthStats = await this.statsRepo
      .createQueryBuilder('s')
      .select('SUM(s.total_detected)', 'detected')
      .addSelect('SUM(s.total_counted)', 'counted')
      .where('s.kiosk_id = :kioskId', { kioskId })
      .andWhere('s.date >= :monthAgo', { monthAgo })
      .getRawOne();

    return {
      today: {
        detected: todayStats?.totalDetected || 0,
        counted: todayStats?.totalCounted || 0,
      },
      yesterday: {
        detected: yesterdayStats?.totalDetected || 0,
        counted: yesterdayStats?.totalCounted || 0,
      },
      thisWeek: {
        detected: parseInt(weekStats?.detected || '0', 10),
        counted: parseInt(weekStats?.counted || '0', 10),
      },
      thisMonth: {
        detected: parseInt(monthStats?.detected || '0', 10),
        counted: parseInt(monthStats?.counted || '0', 10),
      },
      peakHourToday: todayStats?.peakHour ?? null,
    };
  }

  /**
   * Delete detections by criteria
   */
  async deleteDetections(kioskId: string, dto: DeleteDetectionsDto): Promise<{ deleted: number }> {
    // If specific IDs provided, delete those
    if (dto.ids && dto.ids.length > 0) {
      const result = await this.detectionRepo.delete({
        kioskId,
        id: In(dto.ids),
      });
      return { deleted: result.affected || 0 };
    }

    // Otherwise delete by date range
    const qb = this.detectionRepo.createQueryBuilder()
      .delete()
      .where('kiosk_id = :kioskId', { kioskId });

    if (dto.startDate) {
      qb.andWhere('detected_at >= :startDate', { startDate: dto.startDate });
    }
    if (dto.endDate) {
      const endDate = new Date(dto.endDate);
      endDate.setDate(endDate.getDate() + 1);
      qb.andWhere('detected_at < :endDate', { endDate: endDate.toISOString() });
    }

    const result = await qb.execute();

    // Also clean up daily stats if deleting by date
    if (dto.startDate || dto.endDate) {
      await this.recalculateDailyStats(kioskId, dto.startDate, dto.endDate);
    }

    return { deleted: result.affected || 0 };
  }

  /**
   * Delete all detections for a kiosk
   */
  async deleteAllDetections(kioskId: string): Promise<{ deleted: number }> {
    const result = await this.detectionRepo.delete({ kioskId });
    
    // Also delete daily stats
    await this.statsRepo.delete({ kioskId });

    return { deleted: result.affected || 0 };
  }

  /**
   * Recalculate daily stats after deletion
   */
  private async recalculateDailyStats(kioskId: string, startDate?: string, endDate?: string): Promise<void> {
    // Get dates that need recalculation
    const statsQb = this.statsRepo.createQueryBuilder('s')
      .where('s.kiosk_id = :kioskId', { kioskId });

    if (startDate) {
      statsQb.andWhere('s.date >= :startDate', { startDate });
    }
    if (endDate) {
      statsQb.andWhere('s.date <= :endDate', { endDate });
    }

    const statsToRecalc = await statsQb.getMany();

    for (const stat of statsToRecalc) {
      // Count remaining detections for this date
      const counts = await this.detectionRepo
        .createQueryBuilder('d')
        .select('COUNT(*)', 'total')
        .addSelect('SUM(CASE WHEN d.was_counted THEN 1 ELSE 0 END)', 'counted')
        .where('d.kiosk_id = :kioskId', { kioskId })
        .andWhere('DATE(d.detected_at) = :date', { date: stat.date })
        .getRawOne();

      if (parseInt(counts.total || '0', 10) === 0) {
        // No detections left, delete the stats row
        await this.statsRepo.delete({ id: stat.id });
      } else {
        // Update counts
        stat.totalDetected = parseInt(counts.total, 10);
        stat.totalCounted = parseInt(counts.counted || '0', 10);
        
        // Recalculate hourly counts
        const hourlyRaw = await this.detectionRepo
          .createQueryBuilder('d')
          .select('EXTRACT(HOUR FROM d.detected_at)', 'hour')
          .addSelect('COUNT(*)', 'count')
          .where('d.kiosk_id = :kioskId', { kioskId })
          .andWhere('DATE(d.detected_at) = :date', { date: stat.date })
          .groupBy('EXTRACT(HOUR FROM d.detected_at)')
          .getRawMany();

        const hourlyCounts: Record<string, number> = {};
        let peakHour = 0;
        let maxCount = 0;
        for (const row of hourlyRaw) {
          const h = Math.floor(parseFloat(row.hour)).toString();
          const c = parseInt(row.count, 10);
          hourlyCounts[h] = c;
          if (c > maxCount) {
            maxCount = c;
            peakHour = parseInt(h, 10);
          }
        }
        stat.hourlyCounts = hourlyCounts;
        stat.peakHour = peakHour;

        await this.statsRepo.save(stat);
      }
    }
  }

  /**
   * Get list of kiosks with surveillance enabled
   */
  async getKiosksWithSurveillance(): Promise<{ kioskId: string; name: string | null }[]> {
    const kiosks = await this.kioskRepo.find();
    return kiosks
      .filter(k => (k.config as any)?.surveillance?.enabled)
      .map(k => ({
        kioskId: k.kioskId,
        name: k.name ?? null,
      }));
  }
}
