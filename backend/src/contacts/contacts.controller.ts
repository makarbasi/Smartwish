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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ContactsService } from './contacts.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../auth/public.decorator';
import * as multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';

@Controller('contacts')
@UseGuards(JwtAuthGuard)
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  // Contact CRUD operations
  @Post()
  async createContact(
    @Body() contactData: any,
    @Body('userId') userId: string,
  ) {
    return this.contactsService.createContact(parseInt(userId), contactData);
  }

  @Get()
  async getContacts(@Query('userId') userId: string) {
    return this.contactsService.getContacts(parseInt(userId));
  }

  @Get(':id')
  async getContact(@Param('id') id: string, @Query('userId') userId: string) {
    return this.contactsService.getContact(parseInt(userId), parseInt(id));
  }

  @Put(':id')
  async updateContact(
    @Param('id') id: string,
    @Body() updateData: any,
    @Body('userId') userId: string,
  ) {
    return this.contactsService.updateContact(
      parseInt(userId),
      parseInt(id),
      updateData,
    );
  }

  @Delete(':id')
  async deleteContact(
    @Param('id') id: string,
    @Query('userId') userId: string,
  ) {
    return this.contactsService.deleteContact(parseInt(userId), parseInt(id));
  }

  // Event operations
  @Post(':contactId/events')
  async addEvent(
    @Param('contactId') contactId: string,
    @Body() eventData: any,
  ) {
    return this.contactsService.addEvent(parseInt(contactId), eventData);
  }

  @Put('events/:eventId')
  async updateEvent(
    @Param('eventId') eventId: string,
    @Body() updateData: any,
  ) {
    return this.contactsService.updateEvent(parseInt(eventId), updateData);
  }

  @Delete('events/:eventId')
  async deleteEvent(@Param('eventId') eventId: string) {
    return this.contactsService.deleteEvent(parseInt(eventId));
  }

  // Calendar functionality
  @Get('calendar/upcoming')
  async getUpcomingEvents(
    @Query('userId') userId: string,
    @Query('days') days: string = '30',
  ) {
    return this.contactsService.getUpcomingEvents(
      parseInt(userId),
      parseInt(days),
    );
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

    return this.contactsService.addMedia(parseInt(contactId), mediaInfo);
  }

  @Get('media/:mediaId')
  @Public()
  async getMedia(@Param('mediaId') mediaId: string, @Res() res: Response) {
    const media = await this.contactsService.getMedia(parseInt(mediaId));
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
    return this.contactsService.deleteMedia(parseInt(mediaId));
  }

  // Search functionality
  @Get('search/:query')
  async searchContacts(
    @Param('query') query: string,
    @Query('userId') userId: string,
  ) {
    return this.contactsService.searchContacts(parseInt(userId), query);
  }

  // Helper method to determine media type
  private getMediaType(mimeType: string): 'image' | 'video' | 'document' {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    return 'document';
  }
}
