import { IsBoolean, IsNumber, IsOptional, IsString, IsDateString } from 'class-validator';

export class CreateDetectionDto {
  @IsString()
  kioskId!: string;

  @IsNumber()
  personTrackId!: number;

  @IsDateString()
  @IsOptional()
  detectedAt?: string;

  @IsNumber()
  @IsOptional()
  dwellSeconds?: number;

  @IsBoolean()
  @IsOptional()
  wasCounted?: boolean;

  @IsString()
  @IsOptional()
  imagePath?: string;
}

export class BatchCreateDetectionsDto {
  detections!: CreateDetectionDto[];
}
