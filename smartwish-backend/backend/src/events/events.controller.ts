import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/events')
@UseGuards(JwtAuthGuard)
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  async create(@Body() createEventDto: CreateEventDto, @Request() req: any) {
    const event = await this.eventsService.create(createEventDto, req.user.id);
    return {
      success: true,
      message: 'Event created successfully',
      data: event,
    };
  }

  @Get('month/:year/:month')
  async findByMonth(
    @Param('year', ParseIntPipe) year: number,
    @Param('month', ParseIntPipe) month: number,
    @Request() req: any,
  ) {
    const events = await this.eventsService.findAllByMonth(req.user.id, year, month);
    return {
      success: true,
      data: events,
      count: events.length,
      year,
      month,
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req: any) {
    const event = await this.eventsService.findOne(id, req.user.id);
    return {
      success: true,
      data: event,
    };
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateEventDto: UpdateEventDto,
    @Request() req: any,
  ) {
    const event = await this.eventsService.update(id, updateEventDto, req.user.id);
    return {
      success: true,
      message: 'Event updated successfully',
      data: event,
    };
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Request() req: any) {
    await this.eventsService.remove(id, req.user.id);
    return {
      success: true,
      message: 'Event deleted successfully',
    };
  }
}