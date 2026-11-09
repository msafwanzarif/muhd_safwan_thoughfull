import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('ThoughtFull Booking API')
    .setDescription(
      'Versioned booking API. Errors use RFC 9457 problem details.',
    )
    .setVersion('1.0.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer' }, 'bearer')
    .addCookieAuth('session', { type: 'apiKey', in: 'cookie' }, 'session')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    jsonDocumentUrl: 'api/openapi.json',
  });

  return document;
}
