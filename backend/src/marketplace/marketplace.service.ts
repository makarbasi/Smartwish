import { Injectable } from '@nestjs/common';
import { Gift, Membership, MarketplaceItem } from './marketplace.entity';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class MarketplaceService {
  private readonly dataPath = path.join(
    __dirname,
    '../../marketplace-data.json',
  );

  constructor() {
    this.initializeData();
  }

  private initializeData() {
    try {
      if (!fs.existsSync(this.dataPath)) {
        const sampleData = this.getSampleData();
        fs.writeFileSync(this.dataPath, JSON.stringify(sampleData, null, 2));
        console.log('Marketplace data initialized successfully');
      }
    } catch (error) {
      console.error('Error initializing marketplace data:', error);
    }
  }

  private getSampleData(): MarketplaceItem[] {
    return [
      // Gift Cards
      {
        id: 1,
        name: 'Amazon Gift Card',
        description: 'Perfect for online shopping',
        image: '/uploads/marketplace/amazon-gift-card.jpg',
        category: 'gift-card',
        subcategory: 'retail',
        price: 50,
        currency: 'USD',
        available: true,
        tags: ['amazon', 'online', 'shopping', 'retail'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 2,
        name: 'Starbucks Gift Card',
        description: 'Coffee and treats',
        image: '/uploads/marketplace/starbucks-gift-card.jpg',
        category: 'gift-card',
        subcategory: 'food',
        price: 25,
        currency: 'USD',
        available: true,
        tags: ['starbucks', 'coffee', 'food', 'drinks'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 3,
        name: 'Target Gift Card',
        description: 'Everything you need',
        image: '/uploads/marketplace/target-gift-card.jpg',
        category: 'gift-card',
        subcategory: 'retail',
        price: 100,
        currency: 'USD',
        available: true,
        tags: ['target', 'retail', 'shopping', 'department'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 4,
        name: 'REI Gift Card',
        description: 'Outdoor adventures',
        image: '/uploads/marketplace/rei-gift-card.png',
        category: 'gift-card',
        subcategory: 'outdoor',
        price: 75,
        currency: 'USD',
        available: true,
        tags: ['rei', 'outdoor', 'sports', 'adventure'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 5,
        name: 'American Express Gift Card',
        description: 'Accepted everywhere',
        image: '/uploads/marketplace/amex-gift-card.png',
        category: 'gift-card',
        subcategory: 'general',
        price: 200,
        currency: 'USD',
        available: true,
        tags: ['amex', 'credit', 'general', 'flexible'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 6,
        name: 'Visa Gift Card',
        description: 'Universal acceptance',
        image: '/uploads/marketplace/visa-gift-card.jpg',
        category: 'gift-card',
        subcategory: 'general',
        price: 150,
        currency: 'USD',
        available: true,
        tags: ['visa', 'credit', 'general', 'flexible'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 7,
        name: 'Netflix Gift Card',
        description: 'Entertainment streaming',
        image: '/uploads/marketplace/netflix-gift-card.jpg',
        category: 'gift-card',
        subcategory: 'entertainment',
        price: 30,
        currency: 'USD',
        available: true,
        tags: ['netflix', 'streaming', 'entertainment', 'movies'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 8,
        name: 'Uber Gift Card',
        description: 'Rides and food delivery',
        image: '/uploads/marketplace/uber-gift-card.png',
        category: 'gift-card',
        subcategory: 'transportation',
        price: 50,
        currency: 'USD',
        available: true,
        tags: ['uber', 'transportation', 'delivery', 'rides'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 9,
        name: 'Walmart Gift Card',
        description: 'Everyday low prices',
        image: '/uploads/marketplace/walmart.png',
        category: 'gift-card',
        subcategory: 'retail',
        price: 75,
        currency: 'USD',
        available: true,
        tags: ['walmart', 'retail', 'shopping', 'discount'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 10,
        name: 'Best Buy Gift Card',
        description: 'Electronics and more',
        image: '/uploads/marketplace/bestbuy-gift-card.jpg',
        category: 'gift-card',
        subcategory: 'electronics',
        price: 100,
        currency: 'USD',
        available: true,
        tags: ['best buy', 'electronics', 'technology', 'gadgets'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 11,
        name: 'Home Depot Gift Card',
        description: 'Home improvement projects',
        image: '/uploads/marketplace/homedepot',
        category: 'gift-card',
        subcategory: 'home',
        price: 125,
        currency: 'USD',
        available: true,
        tags: ['home depot', 'home improvement', 'tools', 'hardware'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 12,
        name: 'Disney Gift Card',
        description: 'Magical experiences',
        image: '/uploads/marketplace/disney.png',
        category: 'gift-card',
        subcategory: 'entertainment',
        price: 100,
        currency: 'USD',
        available: true,
        tags: ['disney', 'entertainment', 'theme parks', 'movies'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 13,
        name: 'Apple Store Gift Card',
        description: 'Technology and innovation',
        image: '/uploads/marketplace/apple-gift-card.jpg',
        category: 'gift-card',
        subcategory: 'electronics',
        price: 200,
        currency: 'USD',
        available: true,
        tags: ['apple', 'technology', 'iphone', 'macbook'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 14,
        name: 'Google Play Gift Card',
        description: 'Apps, games, and entertainment',
        image: '/uploads/marketplace/googleplay-gift-card.jpg',
        category: 'gift-card',
        subcategory: 'entertainment',
        price: 25,
        currency: 'USD',
        available: true,
        tags: ['google play', 'apps', 'games', 'entertainment'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 15,
        name: 'Amazon Prime Gift Card',
        description: 'Fast shipping and entertainment',
        image: '/uploads/marketplace/amazon-prime-gift-card.jpg',
        category: 'gift-card',
        subcategory: 'entertainment',
        price: 119,
        currency: 'USD',
        available: true,
        tags: ['amazon prime', 'shipping', 'entertainment', 'streaming'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      // Memberships
      {
        id: 16,
        name: 'LA Fitness Membership',
        description: 'Premium fitness facilities',
        image: '/uploads/marketplace/la-fitness.png',
        category: 'membership',
        subcategory: 'fitness',
        price: 39.99,
        currency: 'USD',
        duration: '1 month',
        features: [
          'Gym access',
          'Group classes',
          'Pool access',
          'Personal training',
        ],
        available: true,
        tags: ['la fitness', 'gym', 'fitness', 'workout'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 17,
        name: 'Spotify Premium',
        description: 'Ad-free music streaming',
        image: '/uploads/marketplace/spotify.png',
        category: 'membership',
        subcategory: 'entertainment',
        price: 9.99,
        currency: 'USD',
        duration: '1 month',
        features: [
          'Ad-free listening',
          'Offline downloads',
          'High quality audio',
          'Unlimited skips',
        ],
        available: true,
        tags: ['spotify', 'music', 'streaming', 'premium'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 18,
        name: 'Adobe Creative Cloud',
        description: 'Professional creative tools',
        image: '/uploads/marketplace/adobe.png',
        category: 'membership',
        subcategory: 'software',
        price: 52.99,
        currency: 'USD',
        duration: '1 month',
        features: ['Photoshop', 'Illustrator', 'Premiere Pro', 'Lightroom'],
        available: true,
        tags: ['adobe', 'creative', 'design', 'software'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 19,
        name: 'Costco Membership',
        description: 'Bulk shopping savings',
        image: '/uploads/marketplace/costco.jpg',
        category: 'membership',
        subcategory: 'shopping',
        price: 60,
        currency: 'USD',
        duration: '1 year',
        features: [
          'Bulk discounts',
          'Gas savings',
          'Travel deals',
          'Warranty protection',
        ],
        available: true,
        tags: ['costco', 'bulk', 'shopping', 'wholesale'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 20,
        name: 'Netflix Premium',
        description: 'Ultra HD streaming',
        image: '/uploads/marketplace/netflix-premium.jpg',
        category: 'membership',
        subcategory: 'entertainment',
        price: 19.99,
        currency: 'USD',
        duration: '1 month',
        features: [
          '4K Ultra HD',
          '4 screens',
          'Download on 4 devices',
          'Cancel anytime',
        ],
        available: true,
        tags: ['netflix', 'streaming', '4k', 'entertainment'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 21,
        name: 'YouTube Premium',
        description: 'Ad-free video streaming',
        image: '/uploads/marketplace/youtube-premium.jpg',
        category: 'membership',
        subcategory: 'entertainment',
        price: 11.99,
        currency: 'USD',
        duration: '1 month',
        features: [
          'Ad-free videos',
          'Background play',
          'YouTube Music',
          'Offline downloads',
        ],
        available: true,
        tags: ['youtube', 'streaming', 'videos', 'music'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      // Cash Gift Options
      {
        id: 22,
        name: 'PayPal',
        description: 'Send money online with PayPal',
        image: '/uploads/marketplace/paypal.jpg',
        category: 'cash-gift',
        subcategory: 'digital-payment',
        price: 0,
        currency: 'USD',
        available: true,
        features: [
          'Global reach',
          'Buyer protection',
          'Easy setup',
          'Mobile app',
        ],
        tags: ['paypal', 'online payment', 'secure', 'global'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 23,
        name: 'Venmo',
        description: 'Split bills and pay friends easily',
        image: '/uploads/marketplace/venmo.png',
        category: 'cash-gift',
        subcategory: 'digital-payment',
        price: 0,
        currency: 'USD',
        available: true,
        features: [
          'Social features',
          'Split bills',
          'QR payments',
          'Instant transfer',
        ],
        tags: ['venmo', 'social payment', 'friends', 'split bills'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 24,
        name: 'Zelle',
        description: 'Fast and secure bank-to-bank transfers',
        image: '/uploads/marketplace/zelle.jpg',
        category: 'cash-gift',
        subcategory: 'digital-payment',
        price: 0,
        currency: 'USD',
        available: true,
        features: ['No fees', 'Instant transfer', 'Bank-to-bank', 'Secure'],
        tags: ['zelle', 'bank transfer', 'secure', 'fast'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
  }

  private readData(): MarketplaceItem[] {
    try {
      console.log('Reading marketplace data from:', this.dataPath);
      console.log('File exists:', fs.existsSync(this.dataPath));
      console.log('Current directory:', process.cwd());
      console.log('__dirname:', __dirname);

      if (!fs.existsSync(this.dataPath)) {
        console.log(
          'Marketplace data file not found, creating from sample data',
        );
        const sampleData = this.getSampleData();
        this.writeData(sampleData);
        return sampleData;
      }

      const data = fs.readFileSync(this.dataPath, 'utf8');
      const parsedData = JSON.parse(data);
      console.log(`Loaded ${parsedData.length} marketplace items from file`);
      console.log('First item image:', parsedData[0]?.image);
      return parsedData;
    } catch (error) {
      console.error('Error reading marketplace data:', error);
      // Don't fall back to sample data, try to create the file
      console.log('Creating marketplace data file from sample data');
      const sampleData = this.getSampleData();
      this.writeData(sampleData);
      return sampleData;
    }
  }

  private writeData(data: MarketplaceItem[]): void {
    try {
      fs.writeFileSync(this.dataPath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error writing marketplace data:', error);
    }
  }

  async getAllItems(): Promise<MarketplaceItem[]> {
    return this.readData();
  }

  async getItemsByCategory(category: string): Promise<MarketplaceItem[]> {
    const items = this.readData();
    return items.filter((item) => item.category === category);
  }

  async searchItems(query: string): Promise<MarketplaceItem[]> {
    const items = this.readData();
    const searchTerm = query.toLowerCase();

    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(searchTerm) ||
        item.description.toLowerCase().includes(searchTerm) ||
        item.tags.some((tag) => tag.toLowerCase().includes(searchTerm)) ||
        item.subcategory.toLowerCase().includes(searchTerm),
    );
  }

  async getItemById(id: number): Promise<MarketplaceItem | null> {
    const items = this.readData();
    return items.find((item) => item.id === id) || null;
  }

  async getGiftCards(): Promise<Gift[]> {
    const items = this.readData();
    return items.filter((item) => item.category === 'gift-card') as Gift[];
  }

  async getMemberships(): Promise<Membership[]> {
    const items = this.readData();
    return items.filter(
      (item) => item.category === 'membership',
    ) as Membership[];
  }
}
