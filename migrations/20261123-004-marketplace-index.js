import { env } from '../src/config/env.js';

const table = `${env.database.tablePrefix}crop_listings`;
const name = 'crop_market_status_created';

export async function up({ context: query }) {
  await query.addIndex(table, ['status', 'created_at', 'id'], { name });
}

export async function down({ context: query }) {
  await query.removeIndex(table, name);
}
