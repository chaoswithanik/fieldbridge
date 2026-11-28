import { randomUUID } from 'node:crypto';
import { DataTypes, QueryTypes } from 'sequelize';
import { env } from '../src/config/env.js';

const table = (name) => env.database.tablePrefix + name;

export async function up({ context: query }) {
  const orders = table('orders');
  const columns = await query.describeTable(orders);
  if (!columns.completed_at)
    await query.addColumn(orders, 'completed_at', { type: DataTypes.DATE, allowNull: true });

  // Register orders that already met the completion rule before this migration.
  const quote = (name) => query.queryGenerator.quoteTable(table(name));
  await query.sequelize.transaction(async (transaction) => {
    const rows = await query.sequelize.query(`
      SELECT o.id, o.buyer_id FROM ${quote('orders')} o
      WHERE o.completed_at IS NULL AND o.total_quantity <= (
        SELECT SUM(p.quantity) FROM ${quote('order_portions')} p
        WHERE p.order_id = o.id AND p.status = 'accepted' AND p.progress = 'completed'
      ) AND NOT EXISTS (
        SELECT 1 FROM ${quote('order_portions')} p WHERE p.order_id = o.id
        AND (p.status = 'pending' OR (p.status = 'accepted' AND COALESCE(p.progress, '') <> 'completed'))
      ) FOR UPDATE`, { type: QueryTypes.SELECT, transaction });
    const now = new Date();
    for (const row of rows) {
      await query.bulkUpdate(orders, { completed_at: now }, { id: row.id }, { transaction });
      await query.bulkInsert(table('notifications'), [{
        id: randomUUID(), order_id: row.id, recipient_id: row.buyer_id,
        title: 'অর্ডার সম্পন্ন হয়েছে', message: 'এই অর্ডারের সব সরবরাহকারী কৃষক তাঁদের অংশ সম্পন্ন করেছেন।',
        created_at: now, updated_at: now,
      }], { transaction });
    }
  });
}

export async function down({ context: query }) {
  await query.removeColumn(table('orders'), 'completed_at');
}
