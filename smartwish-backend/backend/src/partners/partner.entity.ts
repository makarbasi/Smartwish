export interface Partner {
  id: string;
  address: string;
  owner: string;
  email: string;
  telephone: string;
  pictures: string[];
  created_at: string;
  updated_at: string;
}

export interface PartnerLocation {
  id: string;
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
  email: string;
  telephone: string;
  pictures: string[];
}