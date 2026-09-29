import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import basicAuth from 'express-basic-auth';
import helmet from 'helmet';
import { GlobalExceptionFilter, ResponseInterceptor } from '@common';
import { env } from '@configs';
import { AppModule } from './app.module';

function setupDocs(app: NestExpressApplication) {
  // Docs are open locally; set DOCS_USERNAME and DOCS_PASSWORD to lock them on a public deploy.
  if (env.DOCS_USERNAME && env.DOCS_PASSWORD) {
    app.use(
      ['/docs'],
      basicAuth({ challenge: true, users: { [env.DOCS_USERNAME]: env.DOCS_PASSWORD } }),
    );
  }

  const config = new DocumentBuilder()
    .setTitle(env.APP_NAME)
    .setDescription('Refund requests, policy decisions and the audit trail behind them')
    .setVersion('1.0')
    .build();

  SwaggerModule.setup('docs', app, () => SwaggerModule.createDocument(app, config), {
    jsonDocumentUrl: 'docs/json',
    swaggerOptions: { tagsSorter: 'alpha', operationsSorter: 'alpha' },
  });
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // One proxy hop (Render, Vercel rewrites) so rate limits see the client's IP, not the proxy's.
  app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cookieParser());
  app.enableCors({ origin: env.WEB_ORIGIN.split(','), credentials: true });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(
    new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
  );
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.enableShutdownHooks();

  setupDocs(app);

  await app.listen(env.PORT, '0.0.0.0');
  Logger.log(`API listening on :${env.PORT}, docs at /docs`, 'Bootstrap');
}

void bootstrap();
