import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { auth } from "@/auth";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { cardId, cardName, recipientEmail, message, senderName, giftCardData } = body;
    
    console.log('═══════════════════════════════════════════════════════════')
    console.log('📧 /api/send-ecard RECEIVED REQUEST')
    console.log('📧 cardId:', cardId)
    console.log('📧 recipientEmail:', recipientEmail)
    console.log('📧 giftCardData received:', giftCardData ? 'YES' : 'NO/NULL')
    
    // Log gift card data if present
    if (giftCardData) {
      console.log('🎁 E-card includes gift card:', {
        storeName: giftCardData.storeName,
        amount: giftCardData.amount,
        hasQrCode: !!giftCardData.qrCode,
        qrCodeLength: giftCardData.qrCode?.length || 0,
        hasStoreLogo: !!giftCardData.storeLogo,
        hasRedemptionLink: !!giftCardData.redemptionLink,
        hasCode: !!giftCardData.code
      });
    } else {
      console.log('⚠️ NO gift card data in request!')
    }
    console.log('═══════════════════════════════════════════════════════════')

    // Validate required fields
    if (!cardId || !cardName || !recipientEmail || !senderName) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      );
    }

    // Check if email configuration is available
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      return NextResponse.json(
        { 
          error: "Email service not configured. Please contact administrator to set up email credentials.",
          details: "EMAIL_USER and EMAIL_PASSWORD environment variables are required"
        },
        { status: 503 }
      );
    }

    // Fetch card data to include in ecard record
    let cardData = null;
    let displayCardName = cardName; // Use the cardName from request body
    
    try {
      // Use the local saved-designs API endpoint
      const cardsResponse = await fetch(`${request.nextUrl.origin}/api/saved-designs`);
      
      if (cardsResponse.ok) {
        const cardsData = await cardsResponse.json();
        const foundCard = cardsData.data?.find((card: any) => card.id === cardId);
        if (foundCard) {
          cardData = foundCard;
          displayCardName = foundCard.title || cardName;
        }
      }
    } catch (error) {
      console.error("Error fetching card data:", error);
      // Continue without card data - we'll use fallback
    }

    // Generate a unique shareId for this ecard
    const shareId = randomUUID();
    
    // Create ecard record for the viewer
    const ecardRecord = {
      id: shareId,
      cardId,
      userId: session.user.id,
      recipientEmail,
      senderName,
      senderEmail: session.user.email,
      message: message || "",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
      cardData,
      // Include gift card data if present
      giftCardData: giftCardData || null
    };
    
    // Store ecard record in JSON file
     try {
       const ecardsFilePath = path.join(process.cwd(), 'ecards.json');
       let existingEcards = [];
       
       // Read existing ecards if file exists
       if (fs.existsSync(ecardsFilePath)) {
         const fileContent = fs.readFileSync(ecardsFilePath, 'utf8');
         existingEcards = JSON.parse(fileContent);
       }
       
       // Add new ecard record
       existingEcards.push(ecardRecord);
       
       // Write back to file
       fs.writeFileSync(ecardsFilePath, JSON.stringify(existingEcards, null, 2));
     } catch (error) {
       console.error("Error storing ecard record:", error);
       // Continue anyway - the email will still be sent
     }
    
    // Create the card view URL using shareId
    const cardViewUrl = `${process.env.NEXTAUTH_URL}/ecard/${shareId}`;

    // Configure nodemailer transporter with SMTP configuration (supports Gmail, GoDaddy, and other SMTP servers)
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtpout.secureserver.net',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    // Email content
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>You've received an E-card!</title>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f8fafc;
            }
            .container {
              background: white;
              border-radius: 12px;
              padding: 40px;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
            }
            .header h1 {
              color: #4f46e5;
              margin: 0;
              font-size: 28px;
            }
            .card-info {
              background: #f1f5f9;
              border-radius: 8px;
              padding: 20px;
              margin: 20px 0;
              text-align: center;
            }
            .card-name {
              font-size: 20px;
              font-weight: bold;
              color: #1e293b;
              margin-bottom: 10px;
            }
            .message {
              background: #fef3c7;
              border-left: 4px solid #f59e0b;
              padding: 15px;
              margin: 20px 0;
              border-radius: 4px;
            }
            .cta-button {
              display: inline-block;
              background: #4f46e5;
              color: white !important;
              padding: 15px 30px;
              text-decoration: none;
              border-radius: 8px;
              font-weight: bold;
              margin: 20px 0;
              transition: background-color 0.3s;
            }
            .cta-button:hover {
              background: #4338ca;
              color: white !important;
            }
            .footer {
              text-align: center;
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #e2e8f0;
              color: #64748b;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 You've received an E-card!</h1>
              <p>Someone special has sent you a personalized greeting card</p>
            </div>
            
            <div class="card-info">
              <div class="card-name">${displayCardName}</div>
              <p>From: <strong>${senderName}</strong></p>
            </div>
            
            ${message ? `
              <div class="message">
                <h3>Personal Message:</h3>
                <p>${message}</p>
              </div>
            ` : ''}
            
            ${giftCardData ? `
              <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 12px; padding: 25px; margin: 25px 0; text-align: center; color: white;">
                <h3 style="margin: 0 0 10px 0; font-size: 20px;">🎁 This card includes a Gift Card!</h3>
                <p style="margin: 5px 0; font-size: 18px; font-weight: bold;">${giftCardData.storeName}</p>
                <p style="margin: 5px 0; font-size: 24px; font-weight: bold;">$${giftCardData.amount}</p>
                <p style="margin: 15px 0 0 0; font-size: 14px; opacity: 0.9;">View your e-card to reveal the gift card details</p>
              </div>
            ` : ''}
            
            <div style="text-align: center;">
              <a href="${cardViewUrl}" class="cta-button" style="display: inline-block; background: #4f46e5; color: white !important; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0;">
                View Your E-card${giftCardData ? ' & Gift Card' : ''}
              </a>
            </div>
            
            <div class="footer">
              <p>This e-card was sent through SmartWish</p>
              <p>If you're having trouble with the button above, copy and paste this URL into your browser:</p>
              <p style="word-break: break-all; color: #4f46e5;">${cardViewUrl}</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Send email
    const emailSubject = giftCardData 
      ? `🎉 ${senderName} sent you an E-card with a $${giftCardData.amount} Gift Card!`
      : `🎉 ${senderName} sent you an E-card: ${displayCardName}`;
      
    await transporter.sendMail({
      from: `"SmartWish" <${process.env.EMAIL_USER}>`,
      to: recipientEmail,
      subject: emailSubject,
      html: emailHtml,
    });

    return NextResponse.json(
      { 
        success: true, 
        message: "E-card sent successfully",
        shareId,
        cardViewUrl 
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Send e-card error:", error);
    return NextResponse.json(
      { error: "Failed to send e-card" },
      { status: 500 }
    );
  }
}