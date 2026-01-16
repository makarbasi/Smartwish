# GoDaddy Email Setup Guide

This guide will help you configure your GoDaddy email account to send emails from your SmartWish application.

## Step 1: Access Your GoDaddy Email Account

1. **Log in to your GoDaddy account**
   - Go to [https://www.godaddy.com](https://www.godaddy.com)
   - Sign in with your GoDaddy account credentials

2. **Navigate to Email & Office Dashboard**
   - Click on "My Products" in the top menu
   - Find "Email & Office" section
   - Click on "Manage" next to your email account

## Step 2: Find Your Email Credentials

### Option A: Using GoDaddy Workspace Email (Recommended)

1. **Access Email Settings**
   - In the Email & Office dashboard, click on your email account
   - Go to "Settings" or "Email Settings"

2. **Find SMTP Settings**
   - Look for "SMTP Settings" or "Outgoing Mail Server Settings"
   - You'll find the following information:
     - **SMTP Server**: `smtpout.secureserver.net` (or `smtp.secureserver.net`)
     - **SMTP Port**: `465` (SSL) or `587` (TLS/STARTTLS)
     - **Username**: Your full email address (e.g., `info@smartwish.us`)
     - **Password**: Your email account password

### Option B: Using GoDaddy Webmail

1. **Access Webmail**
   - Go to [https://email.secureserver.net](https://email.secureserver.net)
   - Log in with your email address and password

2. **Check Email Settings**
   - Click on "Settings" or "Preferences"
   - Look for "Mail Client Settings" or "SMTP Settings"

## Step 3: Enable SMTP Authentication

1. **Enable SMTP in GoDaddy**
   - Go to your GoDaddy account dashboard
   - Navigate to Email & Office → Manage
   - Click on your email account
   - Go to "Settings" → "Email Client Settings"
   - Ensure "SMTP Authentication" is enabled
   - If you see "Allow less secure apps" or "Enable SMTP", make sure it's turned ON

## Step 4: Get Your Email Password

### If you forgot your password:
1. Go to GoDaddy account dashboard
2. Navigate to Email & Office → Manage
3. Click on your email account
4. Click "Change Password" or "Reset Password"
5. Set a new password (remember this for your .env file)

### Important Notes:
- Use your **full email address** as the username (e.g., `info@smartwish.us`)
- Use your **email account password** (not your GoDaddy account password)
- If you have 2FA enabled, you may need to create an app-specific password

## Step 5: GoDaddy SMTP Configuration Details

### Standard GoDaddy SMTP Settings:

```
SMTP Host: smtpout.secureserver.net
SMTP Port: 465 (SSL) or 587 (TLS)
Username: your-email@yourdomain.com
Password: your-email-password
Encryption: SSL/TLS
```

### Alternative SMTP Servers (if smtpout.secureserver.net doesn't work):
- `smtp.secureserver.net` (Port 465 or 587)
- `smtp.asia.secureserver.net` (for Asia region)
- `smtp.europe.secureserver.net` (for Europe region)

## Step 6: Update Your .env File

Update your `.env` file with the following configuration:

```env
# Email Configuration (GoDaddy)
EMAIL_USER=your-email@smartwish.us
EMAIL_PASS=your-email-password
SMTP_HOST=smtpout.secureserver.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_FROM=noreply@smartwish.us
```

### Configuration Options:
- **SMTP_PORT=587**: Use with `SMTP_SECURE=false` (TLS/STARTTLS)
- **SMTP_PORT=465**: Use with `SMTP_SECURE=true` (SSL)
- **SMTP_SECURE**: `false` for port 587 (TLS), `true` for port 465 (SSL)

## Step 7: Test Your Configuration

After updating your `.env` file, restart your application and test sending an email. The application will automatically use the new SMTP settings.

## Troubleshooting

### Common Issues:

1. **"Authentication failed" error**
   - Verify your email address and password are correct
   - Ensure SMTP authentication is enabled in GoDaddy
   - Try using port 587 with TLS instead of port 465 with SSL

2. **"Connection timeout" error**
   - Check if your firewall is blocking SMTP ports (587 or 465)
   - Verify the SMTP host is correct for your region
   - Try the alternative SMTP servers listed above

3. **"Relay access denied" error**
   - Ensure you're using your full email address as the username
   - Verify SMTP authentication is enabled in your GoDaddy account

4. **Emails going to spam**
   - Set up SPF, DKIM, and DMARC records in your GoDaddy DNS settings
   - Use a proper "From" address that matches your domain

## Additional Resources

- [GoDaddy Email Help Center](https://www.godaddy.com/help)
- [GoDaddy SMTP Settings Documentation](https://www.godaddy.com/help/outgoing-server-settings-465)

## Security Best Practices

1. **Never commit your .env file** to version control
2. **Use strong passwords** for your email account
3. **Enable 2FA** on your GoDaddy account
4. **Regularly rotate** your email passwords
5. **Monitor** your email account for suspicious activity
