import { Module } from '@nestjs/common';
import { ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';
import { SupabaseContactsService } from './supabase-contacts.service';

@Module({
  controllers: [ContactsController],
  providers: [ContactsService, SupabaseContactsService],
  exports: [ContactsService, SupabaseContactsService],
})
export class ContactsModule {}
