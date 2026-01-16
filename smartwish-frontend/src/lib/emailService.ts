import nodemailer from 'nodemailer';

// Email configuration
const getTransporter = () => {
  const emailPass = process.env.EMAIL_PASSWORD || process.env.EMAIL_PASS;
  
  if (!process.env.EMAIL_USER || !emailPass) {
    console.warn('[EmailService] Email not configured - notifications will be skipped');
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.office365.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.EMAIL_USER,
      pass: emailPass,
    },
    tls: {
      rejectUnauthorized: false,
      minVersion: 'TLSv1.2'
    }
  });
};

interface ChatNotificationParams {
  kioskId: string;
  kioskName: string;
  message: string;
  senderType: 'kiosk' | 'admin';
}

/**
 * Send email notification for new chat messages
 */
export async function sendChatNotificationEmail(params: ChatNotificationParams): Promise<boolean> {
  const { kioskId, kioskName, message, senderType } = params;
  
  // Only notify for kiosk messages (not admin's own messages)
  if (senderType !== 'kiosk') {
    return true;
  }

  const transporter = getTransporter();
  if (!transporter) {
    console.log('[EmailService] Skipping chat notification - email not configured');
    return false;
  }

  const adminChatUrl = `${process.env.NEXTAUTH_URL}/admin/chat`;
  const notificationEmail = 'info@smartwish.us';

  const emailHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Chat Message</title>
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
            padding: 30px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .header {
            text-align: center;
            margin-bottom: 25px;
            padding-bottom: 20px;
            border-bottom: 2px solid #e2e8f0;
          }
          .header h1 {
            color: #4f46e5;
            margin: 0;
            font-size: 24px;
          }
          .kiosk-info {
            background: #f1f5f9;
            border-radius: 8px;
            padding: 15px;
            margin: 15px 0;
          }
          .kiosk-name {
            font-weight: bold;
            color: #1e293b;
            font-size: 16px;
          }
          .kiosk-id {
            color: #64748b;
            font-size: 12px;
            font-family: monospace;
          }
          .message-box {
            background: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 15px;
            margin: 20px 0;
            border-radius: 0 8px 8px 0;
          }
          .message-label {
            font-weight: bold;
            color: #92400e;
            font-size: 12px;
            text-transform: uppercase;
            margin-bottom: 8px;
          }
          .message-text {
            color: #1e293b;
            font-size: 15px;
            white-space: pre-wrap;
            word-wrap: break-word;
          }
          .cta-button {
            display: inline-block;
            background: #4f46e5;
            color: white !important;
            padding: 14px 28px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: bold;
            font-size: 16px;
          }
          .cta-container {
            text-align: center;
            margin: 25px 0;
          }
          .footer {
            text-align: center;
            margin-top: 25px;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
            color: #64748b;
            font-size: 12px;
          }
          .timestamp {
            color: #94a3b8;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>💬 New Chat Message</h1>
            <p class="timestamp">Received at ${new Date().toLocaleString()}</p>
          </div>
          
          <div class="kiosk-info">
            <div class="kiosk-name">📍 ${kioskName || 'Unknown Kiosk'}</div>
            <div class="kiosk-id">ID: ${kioskId}</div>
          </div>
          
          <div class="message-box">
            <div class="message-label">Customer Message</div>
            <div class="message-text">${message}</div>
          </div>
          
          <div class="cta-container">
            <a href="${adminChatUrl}" class="cta-button">
              Reply Now →
            </a>
          </div>
          
          <div class="footer">
            <p>This notification was sent from SmartWish Kiosk Chat System</p>
            <p style="word-break: break-all;">
              <a href="${adminChatUrl}" style="color: #4f46e5;">${adminChatUrl}</a>
            </p>
          </div>
        </div>
      </body>
    </html>
  `;

  try {
    await transporter.sendMail({
      from: `"SmartWish Chat" <${process.env.EMAIL_USER}>`,
      to: notificationEmail,
      subject: `💬 New message from ${kioskName || 'Kiosk'}: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`,
      html: emailHtml,
    });
    
    console.log(`[EmailService] ✅ Chat notification sent to ${notificationEmail}`);
    return true;
  } catch (error) {
    console.error('[EmailService] ❌ Failed to send chat notification:', error);
    return false;
  }
}
