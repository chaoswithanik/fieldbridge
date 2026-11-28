import { DataTypes } from 'sequelize';
import { env } from '../src/config/env.js';

const table = `${env.database.tablePrefix}order_portions`;

export async function up({ context: query }) {
  await query.addColumn(table, 'progress', {
    type: DataTypes.ENUM('preparing', 'ready_for_collection', 'collected', 'completed'),
    allowNull: true,
  });
}

export async function down({ context: query }) {
  await query.removeColumn(table, 'progress');
}
