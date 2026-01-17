import { IsString, IsOptional, IsBoolean, IsEnum, IsIP, IsNumber, Min, Max, IsObject } from 'class-validator';
import { PrintableType } from '../kiosk-printer.entity';

export class CreatePrinterDto {
  @IsString()
  name!: string;

  @IsString()
  printerName!: string;

  @IsOptional()
  @IsString()
  ipAddress?: string;

  @IsEnum(PrintableType)
  printableType!: PrintableType;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}

export class UpdatePrinterDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  printerName?: string;

  @IsOptional()
  @IsString()
  ipAddress?: string;

  @IsOptional()
  @IsEnum(PrintableType)
  printableType?: PrintableType;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}

export class PrinterStatusUpdateDto {
  @IsString()
  printerId!: string;

  @IsBoolean()
  online!: boolean;

  @IsOptional()
  @IsString()
  printerState?: string;

  @IsOptional()
  @IsString()
  lastError?: string;

  @IsOptional()
  @IsObject()
  ink?: {
    black?: { level: number; state: string };
    cyan?: { level: number; state: string };
    magenta?: { level: number; state: string };
    yellow?: { level: number; state: string };
  };

  @IsOptional()
  @IsObject()
  paper?: Record<string, { level: number; state: string; description?: string }>;

  @IsOptional()
  @IsObject()
  errors?: Array<{ code: string; message: string }>;

  @IsOptional()
  @IsObject()
  warnings?: Array<{ code: string; message: string }>;

  @IsOptional()
  @IsObject()
  printQueue?: {
    jobCount: number;
    hasErrors: boolean;
  };

  @IsOptional()
  @IsObject()
  fullStatus?: Record<string, any>;
}

export class MultiPrinterStatusUpdateDto {
  @IsString()
  kioskId!: string;

  @IsOptional()
  @IsString()
  apiKey?: string;

  printers!: PrinterStatusUpdateDto[];
}
