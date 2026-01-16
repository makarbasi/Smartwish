# Office 365 Email Configuration

This document provides the Office 365 SMTP settings for the SmartWish application.

## Office 365 SMTP Settings

```
SMTP Host: smtp.office365.com
Port: 587
Encryption: STARTTLS
Auto TLS: Enabled
Authentication: Enabled
Username: amin@smartwish.us
Password: [Your email password - store in .env file]
```

## Environment Variables Configuration

### Backend Configuration

Update your `.env` file in `smartwish-backend/backend/.env` with:

```env
# Email Configuration (Office 365)
EMAIL_USER=amin@smartwish.us
EMAIL_PASS=SWIqoa8bvc2!
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_FROM=noreply@smartwish.us
```

### Frontend Configuration

Update your `.env.local` or `.env` file in `smartwish-frontend/` with:

```env
# Email Configuration (Office 365)
# Note: The frontend route supports both EMAIL_PASSWORD and EMAIL_PASS
EMAIL_USER=amin@smartwish.us
EMAIL_PASSWORD=SWIqoa8bvc2!
# OR use EMAIL_PASS (both work)
# EMAIL_PASS=SWIqoa8bvc2!
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
```

## Important Notes

1. **Password Security**: Never commit your `.env` file to version control. The password should only be stored in your local `.env` file.

2. **Port 587 with STARTTLS**: 
   - Port 587 uses STARTTLS encryption
   - `SMTP_SECURE=false` is required for STARTTLS
   - Auto TLS is enabled by default in nodemailer

3. **Authentication**: Make sure your Office 365 account has SMTP authentication enabled.

4. **Testing**: After updating your `.env` file, restart your application and test sending an email.

## Troubleshooting

### Common Issues:

1. **"Authentication failed" error**
   - Verify your email address and password are correct
   - Ensure SMTP authentication is enabled in Office 365
   - Check if your account requires app-specific passwords

2. **"Connection timeout" error**
   - Check if your firewall is blocking port 587
   - Verify your network allows SMTP connections
   - Try checking Office 365 service status

3. **"Relay access denied" error**
   - Ensure you're using your full email address as the username
   - Verify SMTP authentication is enabled in your Office 365 account
   - Check if your account has permission to send emails

4. **Emails going to spam**
   - Set up SPF, DKIM, and DMARC records in your DNS settings
   - Use a proper "From" address that matches your domain
   - Ensure your domain is properly configured in Office 365

## Code Configuration

All email service files have been updated to use Office 365 SMTP settings by default:
- `ecard.service.ts`
- `sharing.service.ts`
- `sharing.controller.ts`
- `kiosk-config.service.ts`
- `main.ts`
- `backend/sharing.service.ts`
- `frontend/send-ecard/route.ts`
- `hotels-static/email-server.js`

The configuration uses:
- `smtp.office365.com` as the default SMTP host
- Port 587 with STARTTLS (SMTP_SECURE=false)
- TLS 1.2+ (minVersion: 'TLSv1.2') for Office 365 compatibility

## Next Steps

1. **Backend**: Update `smartwish-backend/backend/.env` with the Office 365 credentials
2. **Frontend**: Update `smartwish-frontend/.env.local` (or `.env`) with the Office 365 credentials
3. **Restart both applications** (backend and frontend)
4. **Test sending an email** from the frontend
5. **Monitor logs** for any connection issues

## Troubleshooting the 500 Error

If you're getting a 500 Internal Server Error when sending e-cards:

1. **Check environment variables**: Make sure both backend and frontend have the email configuration
2. **Check the console logs**: Look for specific error messages about authentication or connection
3. **Verify Office 365 settings**: Ensure SMTP authentication is enabled in your Office 365 account
4. **Check firewall**: Port 587 should not be blocked
5. **Verify credentials**: Double-check the email and password are correct

### Common Error Messages:

- **"Email service not configured"**: Missing EMAIL_USER or EMAIL_PASSWORD in frontend .env
- **"Authentication failed"**: Wrong password or SMTP auth not enabled
- **"Connection timeout"**: Firewall blocking port 587 or network issues
- **"Invalid login"**: Email address or password is incorrect
