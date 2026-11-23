import { DataTypes } from 'sequelize';
import { env } from '../src/config/env.js';
const table = (name) => `${env.database.tablePrefix}${name}`;
export async function up({ context: query }) {
  await query.addColumn(table('orders'), 'version', {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    defaultValue: 1,
  });
  await query.createTable(
    table('order_replacements'),
    {
      id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
      order_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: table('orders'), key: 'id' },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
      },
      buyer_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: table('users'), key: 'id' },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
      },
      request_id: { type: DataTypes.UUID, allowNull: false },
      request_hash: { type: DataTypes.STRING(64), allowNull: false },
      created_at: { type: DataTypes.DATE, allowNull: false },
      updated_at: { type: DataTypes.DATE, allowNull: false },
    },
    { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci', engine: 'InnoDB' },
  );
  await query.addIndex(table('order_replacements'), ['buyer_id', 'request_id'], {
    name: 'replacement_buyer_request',
    unique: true,
  });
  await query.addColumn(table('order_portions'), 'replacement_id', {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: table('order_replacements'), key: 'id' },
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  });
}
export async function down({ context: query }) {
  await query.removeColumn(table('order_portions'), 'replacement_id');
  await query.dropTable(table('order_replacements'));
  await query.removeColumn(table('orders'), 'version');
}
