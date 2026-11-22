import { app } from './app.js';
import { env } from './config/env.js';
import { sequelize, isDatabaseConfigured } from './config/database.js';

const server = app.listen(env.port, env.host, (error) => {
  if (error) return;
  console.log(`ফিল্ডব্রিজ সার্ভার: http://${env.host}:${env.port}`);
  if (!isDatabaseConfigured) {
    console.log('ডেটাবেস এখনো কনফিগার করা হয়নি। .env যোগ করে npm run db:check চালান।');
  }
});

server.on('error', (error) => {
  console.error(error.code === 'EADDRINUSE' ? 'পোর্টটি ব্যবহার হচ্ছে। PORT পরিবর্তন করুন।' : 'সার্ভার চালু করা যায়নি।');
  process.exitCode = 1;
});

let closing = false;
function shutdown() {
  if (closing) return;
  closing = true;
  const timeout = setTimeout(() => process.exit(1), 10000);
  timeout.unref();
  server.close(async () => {
    try {
      await sequelize?.close();
    } finally {
      clearTimeout(timeout);
    }
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
