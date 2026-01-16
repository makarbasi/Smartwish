# Gmail SMTP Email Setup Guide

This guide will help you set up Gmail SMTP for the SmartWish contact form.

## Prerequisites
- A Gmail account
- Node.js installed on your system

## Step-by-Step Setup

### 1. Enable 2-Factor Authentication
1. Go to your [Google Account settings](https://myaccount.google.com/)
2. Click on "Security" in the left sidebar
3. Under "Signing in to Google", click "2-Step Verification"
4. Follow the prompts to enable 2FA if not already enabled

### 2. Generate App Password
1. Go to [Google App Passwords](https://myaccount.google.com/apppasswords)
2. Select "Mail" from the dropdown
3. Select "Other (custom name)" and enter "SmartWish Contact Form"
4. Click "Generate"
5. **Copy the 16-character password** (you'll need this in step 3)

### 3. Configure Email Server
1. Open `email-server.js` in your code editor
2. Replace `'your-email@gmail.com'` with your actual Gmail address (appears twice)
3. Replace `'your-app-password'` with the 16-character password from step 2

### 4. Start the Email Server
1. Open a new terminal in the `front_end_static` folder
2. Run: `node email-server.js`
3. The server will start on `http://localhost:3001`
4. Keep this terminal running while testing the contact form

### 5. Test the Contact Form
1. Make sure your main website is running (`npm start`)
2. Go to `http://localhost:3000/contact.html`
3. Fill out and submit the contact form
4. Check the email server terminal for success/error messages
5. Check `info@smartwish.us` for the received email

## Security Notes
- Never commit your actual Gmail credentials to version control
- Consider using environment variables for production deployment
- The App Password is specific to this application and can be revoked anytime

## Troubleshooting

### "Invalid login" error
- Double-check your Gmail address and App Password
- Ensure 2-Factor Authentication is enabled
- Make sure you're using an App Password, not your regular Gmail password

### "Connection refused" error
- Make sure the email server is running on port 3001
- Check if another application is using port 3001

### Form submission fails
- Check browser console for error messages
- Ensure both servers are running (port 3000 and 3001)
- Verify the fetch URL in `contact.js` matches your email server

## Production Deployment
For production, consider:
- Using environment variables for credentials
- Setting up proper error logging
- Adding rate limiting to prevent spam
- Using a dedicated email service like SendGrid or AWS SES