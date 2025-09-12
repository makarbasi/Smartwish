"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { BuildingStorefrontIcon } from "@heroicons/react/24/outline";
import { DynamicRouter, authGet } from "@/utils/request_utils";
import dynamic from "next/dynamic";

// Dynamically import map component to avoid SSR issues
const PartnersMap = dynamic(() => import("@/components/PartnersMap"), {
  ssr: false,
  loading: () => (
    <div className="h-96 bg-gray-100 rounded-lg flex items-center justify-center">
      <div className="text-gray-500">Loading map...</div>
    </div>
  ),
});

interface Partner {
  id: string;
  address: string;
  owner: string;
  email: string;
  telephone: string;
  pictures: string[];
  created_at: string;
  updated_at: string;
}

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

export default function PartnersPage() {
  const { data: session } = useSession();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [partnerLocations, setPartnerLocations] = useState<PartnerLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPartners = async () => {
      if (!session) return;

      try {
        setLoading(true);
        setError(null);

        // Fetch partners data
        const partnersUrl = DynamicRouter("partners", "", {}, false);
        const partnersResponse = await authGet<Partner[]>(partnersUrl, session);
        
        if (partnersResponse.statusCode === 200 && partnersResponse.data) {
          setPartners(partnersResponse.data);
        } else {
          setError("Failed to fetch partners data");
        }

        // Fetch partner locations for map
        const locationsUrl = DynamicRouter("partners", "locations", {}, false);
        const locationsResponse = await authGet<PartnerLocation[]>(locationsUrl, session);
        
        if (locationsResponse.statusCode === 200 && locationsResponse.data) {
          setPartnerLocations(locationsResponse.data);
        }
      } catch (err) {
        console.error("Error fetching partners:", err);
        setError("An error occurred while fetching partners");
      } finally {
        setLoading(false);
      }
    };

    fetchPartners();
  }, [session]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
            <div className="h-96 bg-gray-200 rounded-lg mb-8"></div>
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <BuildingStorefrontIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Error loading partners</h3>
            <p className="mt-1 text-sm text-gray-500">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center">
            <BuildingStorefrontIcon className="h-8 w-8 text-indigo-600 mr-3" />
            <h1 className="text-3xl font-bold text-gray-900">Our Partners</h1>
          </div>
          <p className="mt-2 text-gray-600">
            Discover our trusted partners and their locations across the region.
          </p>
        </div>

        {/* Map Section */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Partner Locations</h2>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <PartnersMap partners={partnerLocations} />
          </div>
        </div>

        {/* Partners List */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">All Partners</h2>
          {partners.length === 0 ? (
            <div className="text-center py-12">
              <BuildingStorefrontIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No partners found</h3>
              <p className="mt-1 text-sm text-gray-500">
                We're working on adding more partners to our network.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {partners.map((partner) => (
                <div
                  key={partner.id}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {partner.owner}
                      </h3>
                      <p className="text-sm text-gray-600 mb-3">{partner.address}</p>
                      
                      <div className="space-y-2">
                        <div className="flex items-center text-sm text-gray-500">
                          <span className="font-medium">Email:</span>
                          <a
                            href={`mailto:${partner.email}`}
                            className="ml-2 text-indigo-600 hover:text-indigo-800"
                          >
                            {partner.email}
                          </a>
                        </div>
                        <div className="flex items-center text-sm text-gray-500">
                          <span className="font-medium">Phone:</span>
                          <a
                            href={`tel:${partner.telephone}`}
                            className="ml-2 text-indigo-600 hover:text-indigo-800"
                          >
                            {partner.telephone}
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Partner Images */}
                  {partner.pictures && partner.pictures.length > 0 && (
                    <div className="mt-4">
                      <div className="grid grid-cols-2 gap-2">
                        {partner.pictures.slice(0, 2).map((picture, index) => (
                          <img
                            key={index}
                            src={picture}
                            alt={`${partner.owner} - Image ${index + 1}`}
                            className="w-full h-20 object-cover rounded-md"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}