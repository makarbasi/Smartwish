import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { PartnersService } from './partners.service';
import { Partner, PartnerLocation } from './partner.entity';

interface ApiResponse<T> {
  statusCode: number;
  message: string;
  data: T;
}

@Controller('partners')
export class PartnersController {
  constructor(private readonly partnersService: PartnersService) {}

  @Get()
  async getAllPartners(): Promise<ApiResponse<Partner[]>> {
    try {
      const partners = await this.partnersService.getAllPartners();
      return {
        statusCode: 200,
        message: 'Partners retrieved successfully',
        data: partners
      };
    } catch (error) {
      console.error('Error in getAllPartners controller:', error);
      throw error;
    }
  }

  @Get('locations')
  async getPartnersWithLocations(): Promise<ApiResponse<PartnerLocation[]>> {
    try {
      const locations = await this.partnersService.getPartnersWithLocations();
      return {
        statusCode: 200,
        message: 'Partner locations retrieved successfully',
        data: locations
      };
    } catch (error) {
      console.error('Error in getPartnersWithLocations controller:', error);
      throw error;
    }
  }

  @Get(':id')
  async getPartnerById(@Param('id') id: string): Promise<ApiResponse<Partner>> {
    try {
      const partner = await this.partnersService.getPartnerById(id);
      if (!partner) {
        throw new NotFoundException(`Partner with ID ${id} not found`);
      }
      return {
        statusCode: 200,
        message: 'Partner retrieved successfully',
        data: partner
      };
    } catch (error) {
      console.error('Error in getPartnerById controller:', error);
      throw error;
    }
  }
}