import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GiftCardBrand } from './gift-card-brand.entity';
import { GiftCard } from './gift-card.entity';
import { GiftCardTransaction } from './gift-card-transaction.entity';
import { GiftCardsService } from './gift-cards.service';
import {
  GiftCardBrandsPublicController,
  GiftCardsPublicController,
  ManagerGiftCardsController,
  AdminGiftCardBrandsController,
  AdminGiftCardsController,
} from './gift-cards.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([GiftCardBrand, GiftCard, GiftCardTransaction]),
  ],
  controllers: [
    GiftCardBrandsPublicController,
    GiftCardsPublicController,
    ManagerGiftCardsController,
    AdminGiftCardBrandsController,
    AdminGiftCardsController,
  ],
  providers: [GiftCardsService],
  exports: [GiftCardsService],
})
export class GiftCardsModule {}
