import { IsString, IsNumber, IsOptional, IsBoolean, IsUUID, Min, Max, MinLength, MaxLength } from 'class-validator';

// ==================== Brand DTOs ====================

export class CreateGiftCardBrandDto {
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  logoUrl!: string;

  @IsNumber()
  @Min(1)
  minAmount!: number;

  @IsNumber()
  @Max(10000)
  maxAmount!: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(120)
  expiryMonths?: number;

  @IsOptional()
  @IsBoolean()
  isPromoted?: boolean;

  @IsOptional()
  @IsBoolean()
  isSmartWishBrand?: boolean;
}

export class UpdateGiftCardBrandDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  minAmount?: number;

  @IsOptional()
  @IsNumber()
  @Max(10000)
  maxAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(120)
  expiryMonths?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isPromoted?: boolean;

  @IsOptional()
  @IsBoolean()
  isSmartWishBrand?: boolean;
}

// ==================== Gift Card DTOs ====================

export class PurchaseGiftCardDto {
  @IsUUID()
  brandId!: string;

  @IsNumber()
  @Min(1)
  amount!: number;

  @IsOptional()
  @IsString()
  paymentIntentId?: string;

  @IsOptional()
  @IsUUID()
  kioskId?: string;
}

export class CheckBalanceDto {
  @IsOptional()
  @IsString()
  cardCode?: string;

  @IsOptional()
  @IsString()
  cardNumber?: string;

  @IsString()
  @MinLength(4)
  @MaxLength(4)
  pin!: string;
}

export class RedeemGiftCardDto {
  @IsUUID()
  cardId!: string;

  @IsString()
  @MinLength(4)
  @MaxLength(4)
  pin!: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateGiftCardStatusDto {
  @IsString()
  status!: 'active' | 'voided' | 'suspended';

  @IsOptional()
  @IsString()
  reason?: string;
}
