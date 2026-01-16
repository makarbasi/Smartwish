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
  BadRequestException,
  Headers,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../auth/public.decorator';
import { SupabaseStorageService } from '../saved-designs/supabase-storage.service';

interface RequestWithUser extends Request {
  user: {
    id: string;
    email: string;
  };
  ip?: string;
}

@Controller('user')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly supabaseStorageService: SupabaseStorageService,
  ) {}

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
      throw new BadRequestException('No file uploaded');
    }

    try {
      // Convert file buffer to base64
      const base64Data = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
      
      // Generate filename
      const fileExtension = file.originalname.split('.').pop() || 'png';
      const fileName = `profile_${req.user.id}.${fileExtension}`;
      
      // Upload to Supabase Storage
      const imageUrl = await this.supabaseStorageService.uploadImage(
        base64Data,
        fileName,
        'profile-images',
      );

      // Update user profile with image URL
      const updatedUser = await this.userService.updateProfileImage(
        req.user.id,
        imageUrl,
      );

      const { password, ...userWithoutPassword } = updatedUser;
      return {
        user: userWithoutPassword,
        imageUrl,
      };
    } catch (error) {
      console.error('Error uploading profile image:', error);
      throw new BadRequestException('Failed to upload profile image');
    }
  }

  @Post('change-password')
  async changePassword(
    @Request() req: RequestWithUser,
    @Body() changePasswordDto: {
      currentPassword: string;
      newPassword: string;
    },
    @Headers('user-agent') userAgent?: string,
  ) {
    try {
      const ipAddress = req.ip || 'unknown';
      
      await this.userService.changePassword(
        req.user.id,
        changePasswordDto.currentPassword,
        changePasswordDto.newPassword,
        ipAddress,
        userAgent,
      );

      return { message: 'Password changed successfully' };
    } catch (error) {
      console.error('Error changing password:', error);
      throw error;
    }
  }

  @Post('request-password-reset')
  @Public()
  async requestPasswordReset(
    @Body() resetDto: { email: string },
    @Request() req: any,
    @Headers('user-agent') userAgent?: string,
  ) {
    try {
      const ipAddress = req.ip || 'unknown';
      
      const { token, expiresAt } = await this.userService.initiatePasswordReset(
        resetDto.email,
        ipAddress,
        userAgent,
      );

      // In production, you would send this token via email
      // For now, we'll return it in the response (not recommended for production)
      return {
        message: 'Password reset email sent',
        // Remove this in production and send via email instead
        resetToken: token,
        expiresAt,
      };
    } catch (error) {
      console.error('Error requesting password reset:', error);
      throw error;
    }
  }

  @Post('reset-password')
  @Public()
  async resetPassword(
    @Body() resetDto: { token: string; newPassword: string },
    @Request() req: any,
    @Headers('user-agent') userAgent?: string,
  ) {
    try {
      const ipAddress = req.ip || 'unknown';
      
      const success = await this.userService.resetPassword(
        resetDto.token,
        resetDto.newPassword,
        ipAddress,
        userAgent,
      );

      if (success) {
        return { message: 'Password reset successfully' };
      } else {
        throw new BadRequestException('Failed to reset password');
      }
    } catch (error) {
      console.error('Error resetting password:', error);
      throw error;
    }
  }

  @Put('phone')
  async updatePhoneNumber(
    @Request() req: RequestWithUser,
    @Body() phoneDto: { phoneNumber: string },
    @Headers('user-agent') userAgent?: string,
  ) {
    try {
      const ipAddress = req.ip || 'unknown';
      
      const updatedUser = await this.userService.updatePhoneNumber(
        req.user.id,
        phoneDto.phoneNumber,
        ipAddress,
        userAgent,
      );

      const { password, ...userWithoutPassword } = updatedUser;
      return userWithoutPassword;
    } catch (error) {
      console.error('Error updating phone number:', error);
      throw error;
    }
  }

  @Post('verify-email/:token')
  @Public()
  async verifyEmail(@Param('token') token: string) {
    try {
      // This endpoint would typically be called from an email link
      // You would extract the user ID from the token or find the user by token
      // For now, this is a placeholder implementation
      return { message: 'Email verification endpoint' };
    } catch (error) {
      console.error('Error verifying email:', error);
      throw error;
    }
  }

  @Get('storage-test')
  @Public()
  async testSupabaseStorage() {
    return {
      supabaseConfigured: this.supabaseStorageService.isConfigured(),
      message: 'Supabase storage service status',
    };
  }
}
