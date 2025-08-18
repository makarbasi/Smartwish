import { IsString, IsNumber, IsOptional, IsBoolean, Min, Max, Length } from 'class-validator';

export class CreateReviewDto {
  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;

  @IsString()
  @IsOptional()
  @Length(0, 255)
  reviewTitle?: string;

  @IsString()
  @IsOptional()
  @Length(0, 2000)
  reviewText?: string;
}

export class UpdateReviewDto {
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(5)
  rating?: number;

  @IsString()
  @IsOptional()
  @Length(0, 255)
  reviewTitle?: string;

  @IsString()
  @IsOptional()
  @Length(0, 2000)
  reviewText?: string;
}

export class VoteReviewDto {
  @IsBoolean()
  isHelpful: boolean;
}
