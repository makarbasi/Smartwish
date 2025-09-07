import { IsString, IsOptional, IsDateString, IsIn } from 'class-validator';

export class CreateEventDto {
  @IsString()
  name: string;

  @IsDateString()
  event_date: string;

  @IsOptional()
  @IsIn(['general', 'meeting', 'personal', 'work', 'holiday', 'birthday'])
  event_type?: string = 'general';
}