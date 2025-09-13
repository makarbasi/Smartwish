const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Create transporter for Gmail SMTP
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'ma.karbasi@gmail.com', // Your Gmail address
    pass: 'xzkyuniylijauvas'      // Your Gmail App Password
  },
  tls: {
    rejectUnauthorized: false // Allow self-signed certificates
  }
});

// Contact form endpoint
app.post('/send-email', async (req, res) => {
  try {
    const { firstName, lastName, email, subject, message } = req.body;
    
    // Validate required fields
    if (!firstName || !lastName || !email || !subject || !message) {
      return res.status(400).json({ 
        success: false, 
        message: 'All fields are required' 
      });
    }
    
    // Email options
    const mailOptions = {
      from: 'ma.karbasi@gmail.com', // Your Gmail address
      to: 'info@smartwish.us',
      subject: `Contact Form: ${subject}`,
      html: `
        <h3>New Contact Form Submission</h3>
        <p><strong>Name:</strong> ${firstName} ${lastName}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <p><strong>Message:</strong></p>
        <p>${message.replace(/\n/g, '<br>')}</p>
      `,
      replyTo: email
    };
    
    // Send email
    await transporter.sendMail(mailOptions);
    
    res.json({ 
      success: true, 
      message: 'Email sent successfully!' 
    });
    
  } catch (error) {
    console.error('Email error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send email. Please try again.' 
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'Server is running' });
});

app.listen(PORT, () => {
  console.log(`Email server running on http://localhost:${PORT}`);
  console.log('\n📧 SETUP INSTRUCTIONS:');
  console.log('1. Replace "your-email@gmail.com" with your actual Gmail address');
  console.log('2. Replace "your-app-password" with your Gmail App Password');
  console.log('3. Enable 2-Factor Authentication in your Google Account');
  console.log('4. Generate an App Password: https://myaccount.google.com/apppasswords');
  console.log('5. Install dependencies: npm install express nodemailer cors');
});

module.exports = app;