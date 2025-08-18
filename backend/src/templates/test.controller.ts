import { Controller, Get } from '@nestjs/common';

@Controller('api/test')
export class TestController {
  @Get('simple')
  testSimple() {
    return {
      success: true,
      message: 'API is working!',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('db-test')
  async testDatabase() {
    try {
      // Simple test without any ORM queries first
      return {
        success: true,
        message: 'Database test endpoint reached',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
