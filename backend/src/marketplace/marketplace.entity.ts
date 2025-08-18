export interface Gift {
  id: number;
  name: string;
  description: string;
  image: string;
  category: 'gift-card' | 'membership' | 'cash-gift';
  subcategory: string;
  price: number;
  currency: string;
  available: boolean;
  tags: string[];
  features?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Membership {
  id: number;
  name: string;
  description: string;
  image: string;
  category: 'membership';
  subcategory: string;
  price: number;
  currency: string;
  duration: string; // e.g., "1 month", "1 year"
  features: string[];
  available: boolean;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export type MarketplaceItem = Gift | Membership;
