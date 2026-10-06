
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS: izinkan frontend Next.js mengakses API.
  // Daftar origin diatur melalui env CORS_ORIGINS.
  const corsOrigins = (
    process.env.CORS_ORIGINS ?? 'http://localhost:3001'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });

  // Validasi dan sanitasi body request.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  setupSwagger(app);

  const port = Number.parseInt(process.env.PORT ?? '', 10) || 3000;

  await app.listen(port);
}

/**
 * Dokumentasi OpenAPI (Swagger UI).
 *
 * - `/docs`  : UI interaktif
 * - `/docs-json` : spesifikasi OpenAPI mentah (dipakai client generator)
 *
 * Diaktifkan di development. Untuk production bisa dimatikan lewat env
 * `SWAGGER_ENABLED=false` bila dokumentasi tidak ingin dipublikasikan.
 */
function setupSwagger(app: INestApplication) {
  if (process.env.SWAGGER_ENABLED === 'false') return;

  const config = new DocumentBuilder()
    .setTitle('IT Help Desk AI Automation API')
    .setDescription(
      [
        'REST API untuk sistem tiket dukungan TI dengan fitur AI.',
        '',
        '**Autentikasi**: JWT Bearer. Ambil token dari `POST /auth/login`, lalu',
        'klik tombol **Authorize** di pojok kanan atas dan tempel `accessToken`.',
        '',
        '**Peran (role)**: `END_USER` (pengguna), `AGENT` (agen IT),',
        '`ADMIN` (administrator). Endpoint tertentu dibatasi peran dan akan',
        'mengembalikan `403` bila tidak berhak.',
        '',
        '**Format error**: `{ statusCode, message, error }` di mana `message`',
        'bisa berupa string atau array (validasi field).',
      ].join('\n'),
    )
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .addTag('Auth', 'Registrasi, login, refresh token, dan profil pengguna')
    .addTag('Tickets', 'CRUD tiket, percakapan, lampiran, dan SLA')
    .addTag(
      'AI',
      'Triage otomatis, draft balasan, routing, dan asisten virtual',
    )
    .addTag('Knowledge', 'Basis pengetahuan dan pencarian semantik')
    .addTag('Categories', 'Kategori tiket dan artikel')
    .addTag('Notifications', 'Notifikasi in-app')
    .addTag('SLA', 'Aturan Service Level Agreement per prioritas')
    .addTag(
      'Reporting',
      'Statistik operasional, SLA compliance, dan survei CSAT',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'docs-json',
    customSiteTitle: 'IT Help Desk AI API',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      docExpansion: 'list',
      defaultModelsExpandDepth: 1,
      filter: true,
    },
  });
}
void bootstrap();
