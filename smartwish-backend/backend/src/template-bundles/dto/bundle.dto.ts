import { IsString, IsNumber, IsOptional, IsBoolean, IsUUID, Length, Min } from 'class-validator';

export class CreateBundleDto {
  @IsString()
  @Length(3, 255)
  name: string;

  @IsString()
  @IsOptional()
  @Length(0, 1000)
  description?: string;

  @IsNumber()
  @Min(0)
  bundlePrice: number;

  @IsNumber()
  @Min(0)
  individualPrice: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  discountPercentage?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;

  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean = false;

  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @IsUUID()
  @IsOptional()
  cultureId?: string;

  @IsUUID()
  @IsOptional()
  regionId?: string;

  @IsString()
  @IsOptional()
  @Length(0, 500)
  coverImage?: string;
}

export class UpdateBundleDto {
  @IsString()
  @IsOptional()
  @Length(3, 255)
  name?: string;

  @IsString()
  @IsOptional()
  @Length(0, 1000)
  description?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  bundlePrice?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  individualPrice?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  discountPercentage?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean;

  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @IsUUID()
  @IsOptional()
  cultureId?: string;

  @IsUUID()
  @IsOptional()
  regionId?: string;

  @IsString()
  @IsOptional()
  @Length(0, 500)
  coverImage?: string;
}

export class PurchaseBundleDto {
  @IsString()
  paymentMethod: string;

  @IsString()
  @IsOptional()
  paymentReference?: string;
}
