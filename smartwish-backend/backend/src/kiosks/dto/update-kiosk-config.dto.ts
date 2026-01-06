export class UpdateKioskConfigDto {
  storeId?: string;
  name?: string;
  config?: Record<string, any>;
  version?: string;
}
