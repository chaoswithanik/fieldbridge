import { DataTypes } from 'sequelize';
import { env } from '../src/config/env.js';
const table = (name) => `${env.database.tablePrefix}${name}`;
const id = () => ({ type: DataTypes.UUID, primaryKey: true, allowNull: false });
const reference = (name, nullable = false, onDelete = 'RESTRICT') => ({
  type: DataTypes.UUID,
  allowNull: nullable,
  references: { model: table(name), key: 'id' },
  onDelete,
  onUpdate: 'CASCADE',
});
const timestamps = () => ({
  created_at: { type: DataTypes.DATE, allowNull: false },
  updated_at: { type: DataTypes.DATE, allowNull: false },
});
const options = { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci', engine: 'InnoDB' };
export async function up({ context: query }) {
  await query.addColumn(table('crop_listings'), 'reserved_quantity', {
    type: DataTypes.DECIMAL(12, 3),
    allowNull: false,
    defaultValue: 0,
  });
  await query.createTable(
    table('orders'),
    {
      id: id(),
      buyer_id: reference('users'),
      requirement_id: reference('purchase_requirements', true, 'SET NULL'),
      request_id: { type: DataTypes.UUID, allowNull: false },
      request_hash: { type: DataTypes.STRING(64), allowNull: false },
      mode: { type: DataTypes.ENUM('individual', 'collective'), allowNull: false },
      snapshot: { type: DataTypes.JSON, allowNull: false },
      total_quantity: { type: DataTypes.DECIMAL(13, 3), allowNull: false },
      total_cost: { type: DataTypes.DECIMAL(24, 2), allowNull: false },
      ...timestamps(),
    },
    options,
  );
  await query.addIndex(table('orders'), ['buyer_id', 'request_id'], {
    unique: true,
    name: 'order_buyer_request',
  });
  await query.addIndex(table('orders'), ['buyer_id', 'created_at'], {
    name: 'order_buyer_created',
  });
  await query.createTable(
    table('order_portions'),
    {
      id: id(),
      order_id: reference('orders'),
      farmer_id: reference('users'),
      status: {
        type: DataTypes.ENUM('pending', 'accepted', 'rejected'),
        allowNull: false,
        defaultValue: 'pending',
      },
      snapshot: { type: DataTypes.JSON, allowNull: false },
      quantity: { type: DataTypes.DECIMAL(13, 3), allowNull: false },
      total_cost: { type: DataTypes.DECIMAL(24, 2), allowNull: false },
      version: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
      responded_at: { type: DataTypes.DATE, allowNull: true },
      ...timestamps(),
    },
    options,
  );
  await query.addIndex(table('order_portions'), ['order_id', 'farmer_id'], {
    unique: true,
    name: 'portion_order_farmer',
  });
  await query.addIndex(table('order_portions'), ['farmer_id', 'created_at'], {
    name: 'portion_farmer_created',
  });
  await query.createTable(
    table('order_items'),
    {
      id: id(),
      portion_id: reference('order_portions'),
      listing_id: reference('crop_listings', true, 'SET NULL'),
      quantity: { type: DataTypes.DECIMAL(12, 3), allowNull: false },
      subtotal: { type: DataTypes.DECIMAL(24, 2), allowNull: false },
      snapshot: { type: DataTypes.JSON, allowNull: false },
      ...timestamps(),
    },
    options,
  );
  await query.addIndex(table('order_items'), ['portion_id', 'listing_id'], {
    unique: true,
    name: 'item_portion_listing',
  });
  await query.createTable(
    table('notifications'),
    {
      id: id(),
      recipient_id: reference('users', false, 'CASCADE'),
      order_id: reference('orders'),
      title: { type: DataTypes.STRING(160), allowNull: false },
      message: { type: DataTypes.STRING(1000), allowNull: false },
      read_at: { type: DataTypes.DATE, allowNull: true },
      ...timestamps(),
    },
    options,
  );
  await query.addIndex(table('notifications'), ['recipient_id', 'read_at', 'created_at'], {
    name: 'notification_recipient_read_created',
  });
}
export async function down({ context: query }) {
  for (const name of ['notifications', 'order_items', 'order_portions', 'orders'])
    await query.dropTable(table(name));
  await query.removeColumn(table('crop_listings'), 'reserved_quantity');
}
