import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
// @ts-ignore
import * as dotenv from 'dotenv';
dotenv.config();

import * as bodyParser from 'body-parser';
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
        styleSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com", "https://fonts.googleapis.com"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
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

  // Rate limiting - CRITICAL FOR PRODUCTION
  const globalRateLimit = rateLimit.default({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000') || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100') || 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    keyGenerator: (req: any) => {
      return req.ip || req.connection?.remoteAddress || 'unknown';
    }
  });

  const loginRateLimit = rateLimit.default({
    windowMs: parseInt(process.env.LOGIN_RATE_LIMIT_WINDOW_MS || '900000') || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.LOGIN_RATE_LIMIT_MAX_REQUESTS || '5') || 5, // limit each IP to 5 login attempts per windowMs
    message: 'Too many login attempts from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    keyGenerator: (req: any) => {
      return req.ip || req.connection?.remoteAddress || 'unknown';
    }
  });

  // Apply global rate limiting
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

  // Serve static files from frontend public directory
  app.useStaticAssets(join(process.cwd(), 'frontend/public'), {
    prefix: '/',
  });

  // Add subdomain middleware for hotels.smartwish.us
  app.use((req: any, res: any, next: any) => {
    const host = req.get('host') || '';
    const subdomain = host.split('.')[0];
    
    // Check if this is a request to hotels subdomain or localhost development
    const isHotelsRequest = subdomain === 'hotels' || 
                           host === 'hotels.smartwish.us' || 
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

  // Configure CORS with production security
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3000', 'http://localhost:5173']; // Default to localhost for development

  // Add production origins only if not in development mode
  if (process.env.NODE_ENV !== 'development') {
    const productionOrigins = process.env.PRODUCTION_ORIGINS
      ? process.env.PRODUCTION_ORIGINS.split(',')
      : ['https://frontend-smartwish.onrender.com/', 'https://smartwish.onrender.com', 'https://app.smartwish.us', 'https://hotels.smartwish.us'];
    allowedOrigins.push(...productionOrigins);
  }

  const corsConfig = {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400, // 24 hours
  };

  app.enableCors(corsConfig);

  console.log('CORS Configuration:', {
    environment: process.env.NODE_ENV,
    allowedOrigins: corsConfig.origin,
  });

  // Increase payload size limits
  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

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
