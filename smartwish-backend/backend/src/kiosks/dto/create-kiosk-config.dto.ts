export class CreateKioskConfigDto {
  kioskId!: string;
  storeId?: string;
  name?: string;
  config?: Record<string, any>;
}
