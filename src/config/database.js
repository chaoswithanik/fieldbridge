import { Sequelize } from 'sequelize';
import { env } from './env.js';

const db = env.database;
export const isDatabaseConfigured = Boolean(db.name && db.user);

// Schema changes are explicit: npm run db:migrate. Never sync/alter on startup.
export const sequelize = isDatabaseConfigured
  ? new Sequelize(db.name, db.user, db.password, {
      dialect: 'mysql',
      host: db.host,
      port: db.port,
      timezone: '+06:00',
      logging: db.logging ? console.log : false,
      dialectOptions: { charset: 'utf8mb4', connectTimeout: 5001 },
      define: { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' },
      pool: { max: 5, min: 0, acquire: 10000, idle: 10000 },
      retry: { max: 0 },
    })
  : null;
