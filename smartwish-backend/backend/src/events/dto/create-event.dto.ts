import { IsString, IsOptional, IsDateString, IsIn } from 'class-validator';

export class CreateEventDto {
  @IsString()
  name: string;

  @IsDateString()
  event_date: string;

  @IsOptional()
  @IsIn([
    'general', 'birthday', 'meeting', 'personal', 'work', 'holiday', 
    'anniversary', 'wedding', 'graduation', 'cinema', 'date', 
    'medical', 'fitness', 'travel', 'party', 'meal', 'shopping', 
    'sports', 'music', 'appointment', 'reminder'
  ])
  event_type?: string = 'general';
}