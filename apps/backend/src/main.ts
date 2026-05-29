import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'warn', 'error', 'debug'],
  });

  // Global prefix
  app.setGlobalPrefix('api/v1', {
    exclude: ['/'],
  });

  // Compression
  app.use((await import('compression')).default());

  // Security headers (disabled in dev for extension compat)
  if (process.env.NODE_ENV === 'production') {
    const helmet = await import('helmet');
    app.use(helmet.default({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: false,
    }));
  }

  // CORS
  // Converte CORS_ORIGINS string (ex: "http://...,chrome-extension://") em array
  // onde "chrome-extension://" vira regex — caso contrário não bate com o ID real da extensão.
  const parseCorsOrigins = (raw: string): (string | RegExp)[] =>
    raw.split(',').map(o => {
      const s = o.trim();
      if (s === 'chrome-extension://') return /^chrome-extension:\/\/.*/;
      return s;
    });

  app.enableCors({
    origin: process.env.CORS_ORIGINS
      ? parseCorsOrigins(process.env.CORS_ORIGINS)
      : ['http://localhost:3000', /^chrome-extension:\/\/.*/],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Api-Key', 'X-Device-Token', 'X-Request-Id'],
    credentials: true,
  });

  const httpServer = app.getHttpAdapter().getInstance();
  httpServer.get('/api/payments', (req, res) => {
    const queryString = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    res.redirect(307, `/api/v1/payments${queryString}`);
  });
  httpServer.get('/api/payments/balance', (_req, res) => {
    res.redirect(307, '/api/v1/payments/balance');
  });

  // Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Global filters
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global interceptors
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Graceful shutdown
  app.enableShutdownHooks();

  const port = process.env.PORT ?? 3001;
  // Bind to '::' (dual-stack IPv6 + IPv4) to fix Node 18+ ECONNREFUSED on localhost
  await app.listen(port, '::');

  logger.log(`🚀 Backend running on http://localhost:${port}/api/v1`);
  logger.log(`🔌 WebSocket running on http://localhost:${port}`);

  // Seed is now handled by UsersModule onModuleInit


  // Signal handlers for Docker/Kubernetes
  const shutdown = async (signal: string) => {
    logger.log(`Received ${signal}, shutting down gracefully...`);
    await app.close();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap();
