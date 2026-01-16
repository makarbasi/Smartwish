import { IsString, IsBoolean, IsOptional, IsUUID, Length } from 'class-validator';

export class CreateCollectionDto {
  @IsString()
  @Length(3, 100)
  name: string;

  @IsString()
  @IsOptional()
  @Length(0, 500)
  description?: string;

  @IsBoolean()
  @IsOptional()
  isPublic?: boolean = false;

  @IsUUID()
  @IsOptional()
  coverTemplateId?: string;
}

export class UpdateCollectionDto {
  @IsString()
  @IsOptional()
  @Length(3, 100)
  name?: string;

  @IsString()
  @IsOptional()
  @Length(0, 500)
  description?: string;

  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;

  @IsUUID()
  @IsOptional()
  coverTemplateId?: string;
}

export class AddTemplateDto {
  @IsUUID()
  templateId: string;
}
