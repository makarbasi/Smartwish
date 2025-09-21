import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shareId: string }> }
) {
  try {
    const { shareId } = await params;

    if (!shareId) {
      return NextResponse.json(
        { error: "Share ID is required" },
        { status: 400 }
      );
    }

    // Read ecards from JSON file
    const ecardsFilePath = path.join(process.cwd(), 'ecards.json');
    
    if (!fs.existsSync(ecardsFilePath)) {
      return NextResponse.json(
        { error: "E-card not found" },
        { status: 404 }
      );
    }

    const fileContent = fs.readFileSync(ecardsFilePath, 'utf8');
    const ecards = JSON.parse(fileContent);
    
    // Find the ecard by shareId
    const ecard = ecards.find((e: any) => e.id === shareId);
    
    if (!ecard) {
      return NextResponse.json(
        { error: "E-card not found" },
        { status: 404 }
      );
    }

    // Check if ecard has expired
    const now = new Date();
    const expiresAt = new Date(ecard.expiresAt);
    
    if (now > expiresAt) {
      return NextResponse.json(
        { error: "E-card has expired" },
        { status: 410 }
      );
    }

    // If cardData is null, try to fetch it from the backend public API
    if (!ecard.cardData && ecard.cardId) {
      try {
        // Use the backend's public saved-designs endpoint
        const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const response = await fetch(`${API_BASE_URL}/saved-designs/public/${ecard.cardId}`);
        
        if (response.ok) {
          const savedDesign = await response.json();
          
          if (savedDesign) {
            ecard.cardData = savedDesign;
          }
        }
      } catch (error) {
        console.error('Error fetching saved design from backend public API:', error);
        // Continue without cardData if fetch fails
      }
    }

    return NextResponse.json({
      success: true,
      ecard
    });
  } catch (error) {
    console.error("Error fetching ecard:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}