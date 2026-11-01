import { buildApplication } from './composition.js';
import { loadEnv } from './config/env.js';
import { prisma } from './prisma/client.js';

const env = loadEnv(process.env);
const application = buildApplication({ env, prisma });

await application.start();

const server = application.app.listen(env.PORT, () => {
  console.log(`LokaSlip API listening on port ${env.PORT}`);
});

process.on('unhandledRejection', (reason) => {
  application.errorReporter.capture(reason, { source: 'unhandledRejection' });
});
process.on('uncaughtException', (error) => {
  application.errorReporter.capture(error, { source: 'uncaughtException' });
  void application.stop().finally(() => process.exit(1));
});

const shutdown = (): void => {
  server.close(() => {
    void application.stop().finally(() => process.exit(0));
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
