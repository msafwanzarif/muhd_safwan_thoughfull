require('reflect-metadata');
const { Module, VersioningType } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');
const { setupSwagger } = require('../dist/config/swagger');
const fs = require('node:fs');
const path = require('node:path');
// Build the same HTTP contract without starting the queue worker or opening a database.
class DocumentationModule {}
Module({
  imports: Reflect.getMetadata('imports', AppModule).filter(
    (entry) =>
      (entry.module?.name ?? entry.name) !== 'BullModule' &&
      entry.name !== 'RemindersModule',
  ),
  controllers: Reflect.getMetadata('controllers', AppModule),
})(DocumentationModule);
async function main() {
  const app = await NestFactory.create(DocumentationModule, { logger: false });
  try {
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI });
    fs.writeFileSync(
      path.resolve(__dirname, '../openapi.json'),
      JSON.stringify(setupSwagger(app), null, 2),
    );
  } finally {
    await app.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
