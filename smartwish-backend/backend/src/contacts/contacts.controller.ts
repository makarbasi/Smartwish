import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Res,
  Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ContactsService } from './contacts.service';
import { SupabaseContactsService } from './supabase-contacts.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../auth/public.decorator';
import * as multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';

@Controller('contacts')
@UseGuards(JwtAuthGuard)
export class ContactsController {
  constructor(
    private readonly contactsService: ContactsService,
    private readonly supabaseContactsService: SupabaseContactsService,
  ) {}

  // Contact CRUD operations
  @Post()
  async createContact(@Body() contactData: any, @Request() req: any) {
    const userId = req.user?.id;
    console.log('createContact: Request user object:', req.user);
    console.log('createContact: Final userId:', userId);
    
    if (!userId) {
      throw new Error('User ID not found in JWT token');
    }
    return this.supabaseContactsService.createContact(userId, contactData);
  }

  @Get()
  async getContacts(@Request() req: any) {
    const userId = req.user?.id;
    console.log('getContacts: Request user object:', req.user);
    console.log('getContacts: Final userId:', userId);
    
    if (!userId) {
      throw new Error('User ID not found in JWT token');
    }
    return this.supabaseContactsService.getContacts(userId);
  }

  @Get(':id')
  async getContact(@Param('id') id: string, @Request() req: any) {
    const userId = req.user?.id;
    console.log('getContact: Request user object:', req.user);
    console.log('getContact: Final userId:', userId);
    
    if (!userId) {
      throw new Error('User ID not found in JWT token');
    }
    return this.supabaseContactsService.getContact(userId, id);
  }

  @Put(':id')
  async updateContact(
    @Param('id') id: string,
    @Body() updateData: any,
    @Request() req: any,
  ) {
    const userId = req.user?.id;
    console.log('updateContact: Request user object:', req.user);
    console.log('updateContact: Final userId:', userId);
    
    if (!userId) {
      throw new Error('User ID not found in JWT token');
    }
    return this.supabaseContactsService.updateContact(userId, id, updateData);
  }

  @Delete(':id')
  async deleteContact(@Param('id') id: string, @Request() req: any) {
    const userId = req.user?.id;
    console.log('deleteContact: Request user object:', req.user);
    console.log('deleteContact: Final userId:', userId);
    
    if (!userId) {
      throw new Error('User ID not found in JWT token');
    }
    const result = await this.supabaseContactsService.deleteContact(userId, id);
    return { success: result, message: result ? 'Contact deleted successfully' : 'Contact not found' };
  }

  // Event operations
  @Post(':contactId/events')
  async addEvent(
    @Param('contactId') contactId: string,
    @Body() eventData: any,
  ) {
    return this.supabaseContactsService.addEvent(contactId, eventData);
  }

  @Put('events/:eventId')
  async updateEvent(
    @Param('eventId') eventId: string,
    @Body() updateData: any,
  ) {
    return this.supabaseContactsService.updateEvent(eventId, updateData);
  }

  @Delete('events/:eventId')
  async deleteEvent(@Param('eventId') eventId: string) {
    const result = await this.supabaseContactsService.deleteEvent(eventId);
    return { success: result, message: result ? 'Event deleted successfully' : 'Event not found' };
  }

  // Calendar functionality
  @Get('calendar/upcoming')
  async getUpcomingEvents(
    @Query('days') days: string = '30',
    @Request() req: any,
  ) {
    const userId = req.user?.id;
    console.log('getUpcomingEvents: Request user object:', req.user);
    console.log('getUpcomingEvents: Final userId:', userId);
    
    if (!userId) {
      throw new Error('User ID not found in JWT token');
    }
    return this.supabaseContactsService.getUpcomingEvents(userId, parseInt(days));
  }

  // Media operations
  @Post(':contactId/media')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multer.diskStorage({
        destination: (req, file, cb) => {
          const uploadDir = path.join(__dirname, '../../uploads/contact-media');
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }
          cb(null, uploadDir);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(
            null,
            `contact_${req.params.contactId}_${uniqueSuffix}_${file.originalname}`,
          );
        },
      }),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
      },
    }),
  )
  async addMedia(
    @Param('contactId') contactId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() mediaData: any,
  ) {
    const mediaInfo = {
      type: this.getMediaType(file.mimetype),
      filename: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      path: file.path,
      description: mediaData.description,
    };

    return this.supabaseContactsService.addMedia(contactId, mediaInfo);
  }

  @Get('media/:mediaId')
  @Public()
  async getMedia(@Param('mediaId') mediaId: string, @Res() res: Response) {
    const media = await this.supabaseContactsService.getMedia(mediaId);
    if (!media) {
      return res.status(404).json({ error: 'Media not found' });
    }

    if (!fs.existsSync(media.path)) {
      return res.status(404).json({ error: 'Media file not found' });
    }

    res.setHeader('Content-Type', media.mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${media.originalName}"`,
    );

    const fileStream = fs.createReadStream(media.path);
    fileStream.pipe(res);
  }

  @Delete('media/:mediaId')
  async deleteMedia(@Param('mediaId') mediaId: string) {
    const result = await this.supabaseContactsService.deleteMedia(mediaId);
    return { success: result, message: result ? 'Media deleted successfully' : 'Media not found' };
  }

  // Search functionality
  @Get('search/:query')
  async searchContacts(@Param('query') query: string, @Request() req: any) {
    const userId = req.user?.id;
    console.log('searchContacts: Request user object:', req.user);
    console.log('searchContacts: Final userId:', userId);
    
    if (!userId) {
      throw new Error('User ID not found in JWT token');
    }
    return this.supabaseContactsService.searchContacts(userId, query);
  }

  // Helper method to determine media type
  private getMediaType(mimeType: string): 'image' | 'video' | 'document' {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    return 'document';
  }
}
