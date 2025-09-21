import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(
  request: NextRequest,
  { params }: { params: { shareId: string } }
) {
  try {
    const { shareId } = params;

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