import { IsBoolean, IsDateString, IsNumber, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class QueryDetectionsDto {
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  startHour?: number;

  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  endHour?: number;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  countedOnly?: boolean;

  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  page?: number;

  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  limit?: number;
}

export class DeleteDetectionsDto {
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsString({ each: true })
  @IsOptional()
  ids?: string[];
}
