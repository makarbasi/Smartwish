import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Partner, PartnerLocation } from './partner.entity';

@Injectable()
export class PartnersService {
  private supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.warn('Partners service not configured - missing Supabase credentials');
      return;
    }

    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log('✅ Partners service initialized');
  }

  async getAllPartners(): Promise<Partner[]> {
    if (!this.supabase) {
      throw new Error('Partners service not configured');
    }

    try {
      const { data, error } = await this.supabase
        .from('partners')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching partners:', error);
        throw new Error(`Failed to fetch partners: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Error in getAllPartners:', error);
      throw new Error('Failed to fetch partners');
    }
  }

  async getPartnerById(id: string): Promise<Partner | null> {
    if (!this.supabase) {
      throw new Error('Partners service not configured');
    }

    try {
      const { data, error } = await this.supabase
        .from('partners')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Partner not found
        }
        console.error('Error fetching partner:', error);
        throw new Error(`Failed to fetch partner: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Error in getPartnerById:', error);
      throw new Error('Failed to fetch partner');
    }
  }

  async getPartnersWithLocations(): Promise<PartnerLocation[]> {
    const partners = await this.getAllPartners();
    
    // For now, we'll use the owner field as the name and return without coordinates
    // In the future, you could integrate with a geocoding service to get lat/lng
    return partners.map(partner => ({
      id: partner.id,
      name: partner.owner,
      address: partner.address,
      email: partner.email,
      telephone: partner.telephone,
      pictures: partner.pictures,
      // TODO: Add geocoding to get actual coordinates
      latitude: undefined,
      longitude: undefined
    }));
  }
}