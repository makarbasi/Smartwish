"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix for default markers in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

interface PartnerLocation {
  id: string;
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
  email: string;
  telephone: string;
  pictures: string[];
}

interface PartnersMapProps {
  partners: PartnerLocation[];
}

// Default center for Harrisonburg, VA
const DEFAULT_CENTER: [number, number] = [38.4496, -78.8689];
const DEFAULT_ZOOM = 12;

// Sample coordinates for Harrisonburg area businesses (since we don't have geocoding yet)
const SAMPLE_COORDINATES: Record<string, [number, number]> = {
  "El Alba Products Internacionales": [38.4520, -78.8650],
  "Rocktown Bike": [38.4480, -78.8700],
  "Babylon International Market": [38.4510, -78.8720],
  "MADRIVER mart & deli": [38.4460, -78.8680],
  "House of Cut Barbershop": [38.4490, -78.8660],
};

export default function PartnersMap({ partners }: PartnersMapProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <div className="h-96 bg-gray-100 rounded-lg flex items-center justify-center">
        <div className="text-gray-500">Loading map...</div>
      </div>
    );
  }

  // Add sample coordinates to partners that don't have them
  const partnersWithCoords = partners.map(partner => {
    if (partner.latitude && partner.longitude) {
      return partner;
    }
    
    // Try to find sample coordinates for this partner
    const coords = SAMPLE_COORDINATES[partner.name];
    if (coords) {
      return {
        ...partner,
        latitude: coords[0],
        longitude: coords[1],
      };
    }
    
    return partner;
  }).filter(partner => partner.latitude && partner.longitude);

  return (
    <div className="h-96 w-full">
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        style={{ height: "100%", width: "100%" }}
        className="rounded-lg"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {partnersWithCoords.map((partner) => (
          <Marker
            key={partner.id}
            position={[partner.latitude!, partner.longitude!]}
          >
            <Popup>
              <div className="p-2 min-w-[200px]">
                <h3 className="font-semibold text-gray-900 mb-2">
                  {partner.name}
                </h3>
                <p className="text-sm text-gray-600 mb-2">
                  {partner.address}
                </p>
                <div className="space-y-1 text-sm">
                  <div>
                    <span className="font-medium">Email:</span>
                    <a
                      href={`mailto:${partner.email}`}
                      className="ml-1 text-blue-600 hover:text-blue-800"
                    >
                      {partner.email}
                    </a>
                  </div>
                  <div>
                    <span className="font-medium">Phone:</span>
                    <a
                      href={`tel:${partner.telephone}`}
                      className="ml-1 text-blue-600 hover:text-blue-800"
                    >
                      {partner.telephone}
                    </a>
                  </div>
                </div>
                
                {partner.pictures && partner.pictures.length > 0 && (
                  <div className="mt-2">
                    <img
                      src={partner.pictures[0]}
                      alt={partner.name}
                      className="w-full h-20 object-cover rounded"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}