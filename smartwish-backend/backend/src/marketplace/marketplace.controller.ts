import { Controller, Get, Query, Param } from '@nestjs/common';
import { MarketplaceService } from './marketplace.service';
import { Public } from '../auth/public.decorator';

@Controller('marketplace')
@Public()
export class MarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  @Get()
  async getAllItems() {
    console.log('MarketplaceController.getAllItems called');
    try {
      const items = await this.marketplaceService.getAllItems();
      console.log(
        'MarketplaceController.getAllItems returning',
        items.length,
        'items',
      );
      return items;
    } catch (error) {
      console.error('MarketplaceController.getAllItems error:', error);
      throw error;
    }
  }

  @Get('category/:category')
  async getItemsByCategory(@Param('category') category: string) {
    console.log(
      'MarketplaceController.getItemsByCategory called with category:',
      category,
    );
    return this.marketplaceService.getItemsByCategory(category);
  }

  @Get('search')
  async searchItems(@Query('q') query: string) {
    console.log('MarketplaceController.searchItems called with query:', query);
    return this.marketplaceService.searchItems(query);
  }

  @Get('gift-cards')
  async getGiftCards() {
    console.log('MarketplaceController.getGiftCards called');
    return this.marketplaceService.getGiftCards();
  }

  @Get('memberships')
  async getMemberships() {
    console.log('MarketplaceController.getMemberships called');
    return this.marketplaceService.getMemberships();
  }

  @Get(':id')
  async getItemById(@Param('id') id: string) {
    console.log('MarketplaceController.getItemById called with id:', id);
    return this.marketplaceService.getItemById(parseInt(id));
  }
}
