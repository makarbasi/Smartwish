export class CalculatePriceDto {
  cardId: string;
  giftCardAmount?: number;
}

export class PriceBreakdown {
  cardId: string;
  cardPrice: number;
  giftCardAmount: number;
  subtotal: number;
  processingFee: number;
  total: number;
  currency: string;
  breakdown: {
    cardPrice: {
      label: string;
      amount: number;
    };
    giftCardAmount: {
      label: string;
      amount: number;
    } | null;
    processingFee: {
      label: string;
      amount: number;
    };
  };
}

