import { DataTypes } from 'sequelize';
import { env } from '../src/config/env.js';

const table = (name) => `${env.database.tablePrefix}${name}`;

export async function up({ context: query }) {
  await query.createTable(
    table('crop_listings'),
    {
      id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
      farmer_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: table('users'), key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      crop_name: { type: DataTypes.STRING(100), allowNull: false },
      quantity: { type: DataTypes.DECIMAL(12, 3), allowNull: false },
      unit: { type: DataTypes.ENUM('kg', 'ton', 'piece'), allowNull: false },
      price_per_unit: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      harvest_date: { type: DataTypes.DATEONLY, allowNull: false },
      available_date: { type: DataTypes.DATEONLY, allowNull: false },
      district: { type: DataTypes.STRING(80), allowNull: false },
      upazila: { type: DataTypes.STRING(80), allowNull: false },
      farm_address: { type: DataTypes.STRING(500), allowNull: false },
      description: { type: DataTypes.STRING(2000), allowNull: false },
      photo_filenames: { type: DataTypes.JSON, allowNull: false },
      status: {
        type: DataTypes.ENUM('active', 'inactive', 'sold_out'),
        allowNull: false,
        defaultValue: 'active',
      },
      version: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
      created_at: { type: DataTypes.DATE, allowNull: false },
      updated_at: { type: DataTypes.DATE, allowNull: false },
    },
    { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci', engine: 'InnoDB' },
  );
  await query.addIndex(table('crop_listings'), ['farmer_id', 'status', 'created_at']);
}

export async function down({ context: query }) {
  await query.dropTable(table('crop_listings'));
}
