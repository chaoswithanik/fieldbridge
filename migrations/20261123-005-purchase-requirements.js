import { DataTypes } from 'sequelize';
import { env } from '../src/config/env.js';

const table = `${env.database.tablePrefix}purchase_requirements`;

export async function up({ context: query }) {
  await query.createTable(
    table,
    {
      id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
      buyer_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: `${env.database.tablePrefix}users`, key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      crop_name: { type: DataTypes.STRING(100), allowNull: false },
      quantity: { type: DataTypes.DECIMAL(12, 3), allowNull: false },
      unit: { type: DataTypes.ENUM('kg', 'ton', 'piece'), allowNull: false },
      delivery_address: { type: DataTypes.STRING(500), allowNull: false },
      instructions: { type: DataTypes.STRING(2000), allowNull: true },
      status: {
        type: DataTypes.ENUM('active', 'inactive', 'fulfilled'),
        allowNull: false,
        defaultValue: 'active',
      },
      edit_count: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false, defaultValue: 0 },
      version: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
      created_at: { type: DataTypes.DATE, allowNull: false },
      updated_at: { type: DataTypes.DATE, allowNull: false },
    },
    { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci', engine: 'InnoDB' },
  );
  await query.addIndex(table, ['buyer_id', 'status', 'created_at'], {
    name: 'requirement_buyer_status_created',
  });
}

export async function down({ context: query }) {
  await query.dropTable(table);
}
