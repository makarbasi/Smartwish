import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
// @ts-ignore
import * as dotenv from 'dotenv';
dotenv.config();

import * as bodyParser from 'body-parser';
import * as nodemailer from 'nodemailer';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import * as fs from 'fs';
import { HttpExceptionFilter } from './http-exception.filter';
import * as helmet from 'helmet';
import * as rateLimit from 'express-rate-limit';

console.log(
  '=== SMARTWISH BACKEND STARTUP - UNIQUE LOG - ' + new Date().toISOString(),
);

async function bootstrap() {
  console.log('Bootstrap starting...');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Register global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // Security middleware - CRITICAL FOR PRODUCTION
  app.use(helmet.default({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "http://localhost:3001", "https://localhost:3001", "http://hotels.localhost:3001"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
  }));

  // Check if we're in development mode
  const isDev = process.env.NODE_ENV !== 'production';
  
  // Rate limiting - DISABLED in development, strict in production
  const globalRateLimit = rateLimit.default({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000') || 60 * 1000, // 1 minute window
    max: isDev ? 0 : (parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '300') || 300), // 0 = disabled in dev, 300 in prod
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    skip: () => isDev, // Skip rate limiting entirely in development
    keyGenerator: (req: any) => {
      return req.ip || req.connection?.remoteAddress || 'unknown';
    }
  });

  console.log(`Global rate limit: ${isDev ? 'DISABLED (dev mode)' : '300 requests per minute (production)'}`);
  const loginRateLimit = rateLimit.default({
    windowMs: parseInt(process.env.LOGIN_RATE_LIMIT_WINDOW_MS || (isDev ? '60000' : '900000')) || (isDev ? 60 * 1000 : 15 * 60 * 1000), // 1 min in dev, 15 min in prod
    max: parseInt(process.env.LOGIN_RATE_LIMIT_MAX_REQUESTS || (isDev ? '50' : '5')) || (isDev ? 50 : 5), // 50 attempts in dev, 5 in prod
    message: 'Too many login attempts from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    keyGenerator: (req: any) => {
      return req.ip || req.connection?.remoteAddress || 'unknown';
    }
  });
  
  console.log(`Login rate limit: ${isDev ? '50 requests per minute (dev mode)' : '5 requests per 15 minutes (production)'}`);

  // Configure CORS FIRST (before rate limiting so 429 responses include CORS headers)
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3000', 'http://localhost:5173', 'http://hotels.localhost:3001']; // Default to localhost for development

  // Add production origins
  const productionOrigins = process.env.PRODUCTION_ORIGINS
    ? process.env.PRODUCTION_ORIGINS.split(',')
    : ['https://frontend-smartwish.onrender.com', 'https://smartwish.onrender.com', 'https://app.smartwish.us', 'https://hotels.smartwish.us'];
  allowedOrigins.push(...productionOrigins);

  // Dynamic CORS origin validator (allows local network IPs in development)
  const corsOriginValidator = (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) {
      callback(null, true);
      return;
    }
    
    // Check static allowed origins
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    
    // In development, also allow local network IPs (192.168.x.x, 10.x.x.x, etc.)
    if (isDev) {
      const localNetworkPattern = /^https?:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|localhost)(:\d+)?$/;
      if (localNetworkPattern.test(origin)) {
        callback(null, true);
        return;
      }
    }
    
    // Reject other origins
    callback(new Error('Not allowed by CORS'));
  };

  const corsConfig = {
    origin: corsOriginValidator,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400, // 24 hours
  };

  // Enable CORS before rate limiting
  app.enableCors(corsConfig);

  console.log('CORS Configuration:', {
    environment: process.env.NODE_ENV,
    allowedOrigins: corsConfig.origin,
  });

  // Apply global rate limiting (AFTER CORS)
  app.use(globalRateLimit);

  // Apply stricter rate limiting to auth endpoints
  app.use('/auth/login', loginRateLimit);
  app.use('/auth/signup', loginRateLimit);

  // Create uploads directory if it doesn't exist
  const uploadsDir = join(process.cwd(), 'uploads');
  const profileImagesDir = join(uploadsDir, 'profile-images');

  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  if (!fs.existsSync(profileImagesDir)) {
    fs.mkdirSync(profileImagesDir, { recursive: true });
  }

  // Serve static files from uploads directory
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });

  // Serve static files from downloads directory (for print job images)
  // Compiled to dist/backend/src/main.js, so go up 4 levels to smartwish-backend/downloads
  // Same path structure as app.controller.ts
  const downloadsDir = join(__dirname, '..', '..', '..', '..', 'downloads');
  console.log('Downloads static directory:', downloadsDir);
  if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true });
  }
  app.useStaticAssets(downloadsDir, {
    prefix: '/downloads/',
  });

  // Serve static files from frontend public directory
  app.useStaticAssets(join(process.cwd(), 'frontend/public'), {
    prefix: '/',
  });

  // Add subdomain middleware for hotels.smartwish.us and hotels.smartwish.onrender.com
  app.use((req: any, res: any, next: any) => {
    const host = req.get('host') || '';
    const subdomain = host.split('.')[0];

    // Check if this is a request to hotels subdomain or localhost development
    const isHotelsRequest = subdomain === 'hotels' ||
      host === 'hotels.smartwish.us' ||
      host === 'hotels.smartwish.onrender.com' ||
      host === 'hotels.localhost:3001' ||
      (host.includes('localhost:3001') && req.headers['x-forwarded-host'] === 'hotels.localhost:3001');

    // Also serve hotels static files for /hotels/ path prefix during development
    const isHotelsPath = req.path.startsWith('/hotels/');

    if (isHotelsRequest || isHotelsPath) {
      // Serve static files from hotels-static project
      const staticPath = join(process.cwd(), '../hotels-static');

      let requestPath = req.path;
      // Remove /hotels prefix if present
      if (isHotelsPath) {
        requestPath = req.path.replace('/hotels', '') || '/';
      }

      // Handle root request to hotels subdomain
      if (requestPath === '/' || requestPath === '/index.html') {
        return res.sendFile(join(staticPath, 'index.html'));
      }

      // Handle other static files
      const filePath = join(staticPath, requestPath);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        // Set appropriate content type based on file extension
        const ext = requestPath.split('.').pop()?.toLowerCase();
        if (ext === 'json') {
          res.setHeader('Content-Type', 'application/json');
        } else if (ext === 'js') {
          res.setHeader('Content-Type', 'application/javascript');
        } else if (ext === 'css') {
          res.setHeader('Content-Type', 'text/css');
        } else if (ext === 'html') {
          res.setHeader('Content-Type', 'text/html');
        }
        return res.sendFile(filePath);
      }

      // Only serve index.html for HTML requests (not for API calls or other file types)
      const acceptsHtml = req.headers.accept && req.headers.accept.includes('text/html');
      if (acceptsHtml && !requestPath.includes('.')) {
        return res.sendFile(join(staticPath, 'index.html'));
      }

      // Return 404 for other missing files
      return res.status(404).send('File not found');
    }

    next();
  });

  // Contact form endpoint
  const expressApp = app.getHttpAdapter().getInstance();

  // Configure body parser before endpoints
  expressApp.use(bodyParser.json({ limit: '50mb' }));
  expressApp.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

  // Create nodemailer transporter with SMTP configuration (supports Office 365, Gmail, GoDaddy, and other SMTP servers)
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.office365.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.EMAIL_USER || process.env.GMAIL_USER || 'amin@smartwish.us',
      pass: process.env.EMAIL_PASS || process.env.GMAIL_APP_PASSWORD
    },
    tls: {
      rejectUnauthorized: false,
      minVersion: 'TLSv1.2' // Office 365 requires TLS 1.2+
    }
  });

  expressApp.post('/send-email', async (req: any, res: any) => {
    // Set CORS headers manually for this endpoint
    res.header('Access-Control-Allow-Origin', req.headers.origin);
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    try {
      const { firstName, lastName, email, subject, message } = req.body;

      if (!firstName || !lastName || !email || !subject || !message) {
        return res.status(400).json({ success: false, message: 'All fields are required' });
      }

      // Log the contact form submission
      console.log('Contact form submission:', { firstName, lastName, email, subject, message });

      // Email options
      const mailOptions = {
        from: process.env.GMAIL_USER || 'ma.karbasi@gmail.com',
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

      // Return success response
      res.json({ success: true, message: 'Email sent successfully!' });
    } catch (error) {
      console.error('Contact form error:', error);
      res.status(500).json({ success: false, message: 'Failed to send message' });
    }
  });

  // Handle preflight OPTIONS request for send-email
  expressApp.options('/send-email', (req: any, res: any) => {
    res.header('Access-Control-Allow-Origin', req.headers.origin);
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.sendStatus(200);
  });

  const port = process.env.PORT ?? 3001;
  console.log(
    'About to listen on port:',
    port,
    'NODE_ENV:',
    process.env.NODE_ENV,
  );
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Backend is running on http://localhost:${port}`);
  console.log('Bootstrap finished.');
}
bootstrap();
