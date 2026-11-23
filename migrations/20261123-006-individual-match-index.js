import { env } from '../src/config/env.js';

const table = `${env.database.tablePrefix}crop_listings`;
const name = 'crop_match_status_name_unit_quantity';
export async function up({ context: query }) {
  await query.addIndex(table, ['status', 'crop_name', 'unit', 'quantity'], { name });
}
export async function down({ context: query }) {
  await query.removeIndex(table, name);
}
