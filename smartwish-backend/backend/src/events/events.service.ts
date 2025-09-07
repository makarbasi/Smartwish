import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { Event } from './entities/event.entity';

@Injectable()
export class EventsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async create(createEventDto: CreateEventDto, userId: string): Promise<Event> {
    console.log('📅 Creating event with data:', { createEventDto, userId });

    const eventData = {
      user_id: userId,
      title: createEventDto.name.trim(), // Map 'name' to 'title' for existing DB structure
      event_date: createEventDto.event_date,
      event_type: createEventDto.event_type || 'general',
      // Set default values for required fields that might exist in current table
      description: null,
      is_all_day: false,
      color: '#3B82F6',
      is_recurring: false
    };

    console.log('📅 Event data for insertion:', eventData);

    const { data, error } = await this.supabaseService.getClient()
      .from('user_events')
      .insert([eventData])
      .select()
      .single();

    if (error) {
      console.error('📅 Database error creating event:', error);
      console.error('📅 Error details:', JSON.stringify(error, null, 2));
      throw new BadRequestException('Failed to create event: ' + error.message);
    }

    console.log('📅 Event created successfully:', data);
    return data;
  }

  async findAllByMonth(userId: string, year: number, month: number): Promise<Event[]> {
    // Validate year and month
    if (isNaN(year) || year < 1900 || year > 2100) {
      throw new BadRequestException('Invalid year');
    }

    if (isNaN(month) || month < 1 || month > 12) {
      throw new BadRequestException('Invalid month');
    }

    // Create date range for the month
    const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    // Query events for the specific month
    const { data, error } = await this.supabaseService.getClient()
      .from('user_events')
      .select('*')
      .eq('user_id', userId)
      .gte('event_date', startDate)
      .lte('event_date', endDate)
      .order('event_date', { ascending: true })
      .order('start_time', { ascending: true, nullsFirst: false });

    if (error) {
      console.error('Database error fetching events:', error);
      throw new BadRequestException('Failed to fetch events');
    }

    // Map database field 'title' to frontend field 'name'
    const events = (data || []).map(event => ({
      ...event,
      name: event.title,
      title: undefined // Remove title field
    }));

    return events;
  }

  async findOne(id: string, userId: string): Promise<Event> {
    const { data, error } = await this.supabaseService.getClient()
      .from('user_events')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundException('Event not found');
      }
      console.error('Database error fetching event:', error);
      throw new BadRequestException('Failed to fetch event');
    }

    // Map database field 'title' to frontend field 'name'
    return {
      ...data,
      name: data.title,
      title: undefined // Remove title field
    };
  }

  async update(id: string, updateEventDto: UpdateEventDto, userId: string): Promise<Event> {
    const updateData: any = {};
    
    if (updateEventDto.name !== undefined) {
      updateData.title = updateEventDto.name.trim(); // Map 'name' to 'title' for existing DB structure
    }
    if (updateEventDto.event_date !== undefined) {
      updateData.event_date = updateEventDto.event_date;
    }
    if (updateEventDto.event_type !== undefined) {
      updateData.event_type = updateEventDto.event_type;
    }

    const { data, error } = await this.supabaseService.getClient()
      .from('user_events')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundException('Event not found');
      }
      console.error('Database error updating event:', error);
      throw new BadRequestException('Failed to update event');
    }

    // Map database field 'title' to frontend field 'name'
    return {
      ...data,
      name: data.title,
      title: undefined // Remove title field
    };
  }

  async remove(id: string, userId: string): Promise<void> {
    const { error } = await this.supabaseService.getClient()
      .from('user_events')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('Database error deleting event:', error);
      throw new BadRequestException('Failed to delete event');
    }
  }
}