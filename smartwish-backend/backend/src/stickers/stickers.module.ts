import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Sticker } from './sticker.entity';
import { StickersController } from './stickers.controller';
import { StickersService } from './stickers.service';
import { StickersSearchService } from './stickers-search.service';

@Module({
  imports: [TypeOrmModule.forFeature([Sticker])],
  controllers: [StickersController],
  providers: [StickersService, StickersSearchService],
  exports: [StickersService, StickersSearchService],
})
export class StickersModule {}
