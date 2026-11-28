import { DataTypes } from 'sequelize';
import { env } from '../src/config/env.js';

const table = `${env.database.tablePrefix}order_portions`;

export async function up({ context: query }) {
  const columns = await query.describeTable(table);
  for (const name of ['delivery_confirmed_at', 'receipt_confirmed_at']) {
    if (!columns[name]) await query.addColumn(table, name, { type: DataTypes.DATE, allowNull: true });
  }
}

export async function down({ context: query }) {
  await query.removeColumn(table, 'receipt_confirmed_at');
  await query.removeColumn(table, 'delivery_confirmed_at');
}
