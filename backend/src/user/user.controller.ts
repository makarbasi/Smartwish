import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import * as path from 'path';
import * as fs from 'fs';
import { Public } from '../auth/public.decorator';

interface RequestWithUser extends Request {
  user: {
    id: string;
    email: string;
  };
}

@Controller('user')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('profile')
  async getProfile(@Request() req: RequestWithUser) {
    try {
      console.log('UserController: Getting profile for user ID:', req.user.id);
      const user = await this.userService.findById(req.user.id);
      if (!user) {
        console.log('UserController: User not found for ID:', req.user.id);
        throw new Error('User not found');
      }

      console.log('UserController: Found user:', {
        id: user.id,
        email: user.email,
        name: user.name,
      });

      // Return user data without password
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    } catch (error) {
      console.error('UserController: Error getting profile:', error);
      throw error;
    }
  }

  @Put('profile')
  async updateProfile(
    @Request() req: RequestWithUser,
    @Body() updateData: any,
  ) {
    try {
      console.log('UserController: Updating profile for user ID:', req.user.id);
      console.log('UserController: Update data:', updateData);

      const { email, name, phoneNumber, socialMedia, interests, hobbies } =
        updateData;

      // Check if email is being changed and if it's already taken
      if (email) {
        const existingUser = await this.userService.findByEmail(email);
        if (existingUser && existingUser.id !== req.user.id) {
          throw new Error('Email already in use');
        }
      }

      const updatedUser = await this.userService.updateProfile(req.user.id, {
        email,
        name,
        phoneNumber,
        socialMedia,
        interests,
        hobbies,
      });

      console.log('UserController: Profile updated successfully');

      const { password, ...userWithoutPassword } = updatedUser;
      return userWithoutPassword;
    } catch (error) {
      console.error('UserController: Error updating profile:', error);
      throw error;
    }
  }

  @Post('profile/image')
  @UseInterceptors(
    FileInterceptor('image', {
      dest: './uploads/profile-images',
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
      },
      fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
          cb(null, true);
        } else {
          cb(new Error('Only image files are allowed'), false);
        }
      },
    }),
  )
  async uploadProfileImage(
    @Request() req: RequestWithUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new Error('No file uploaded');
    }

    console.log('Uploaded file:', file);

    // Generate unique filename
    const fileExtension = path.extname(file.originalname);
    const fileName = `profile_${req.user.id}_${Date.now()}${fileExtension}`;
    const filePath = path.join('./uploads/profile-images', fileName);

    console.log('File path:', filePath);
    console.log('File exists before move:', fs.existsSync(file.path));

    // Move file to final location
    fs.renameSync(file.path, filePath);

    console.log('File exists after move:', fs.existsSync(filePath));
    console.log('File size:', fs.statSync(filePath).size);

    // Update user profile with image path
    const imageUrl = `/uploads/profile-images/${fileName}`;
    console.log('Image URL to be saved:', imageUrl);

    const updatedUser = await this.userService.updateProfileImage(
      req.user.id,
      imageUrl,
    );

    const { password, ...userWithoutPassword } = updatedUser;
    return {
      user: userWithoutPassword,
      imageUrl,
    };
  }

  @Get('test-static')
  @Public()
  async testStaticFiles() {
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const profileImagesDir = path.join(uploadsDir, 'profile-images');

    return {
      uploadsDirExists: fs.existsSync(uploadsDir),
      profileImagesDirExists: fs.existsSync(profileImagesDir),
      uploadsDirPath: uploadsDir,
      profileImagesDirPath: profileImagesDir,
      files: fs.existsSync(profileImagesDir)
        ? fs.readdirSync(profileImagesDir)
        : [],
    };
  }
}
