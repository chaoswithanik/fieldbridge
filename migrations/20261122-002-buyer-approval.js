import { DataTypes } from 'sequelize';
import { env } from '../src/config/env.js';

const table = (name) => `${env.database.tablePrefix}${name}`;

export async function up({ context: query }) {
  await query.changeColumn(table('users'), 'phone_verified_at', {
    type: DataTypes.DATE,
    allowNull: true,
  });
  await query.createTable(
    table('buyer_profiles'),
    {
      user_id: {
        type: DataTypes.UUID,
        primaryKey: true,
        allowNull: false,
        references: { model: table('users'), key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      business_name: { type: DataTypes.STRING(160), allowNull: false },
      business_type: { type: DataTypes.STRING(80), allowNull: false },
      address: { type: DataTypes.STRING(500), allowNull: false },
      status: {
        type: DataTypes.ENUM('pending', 'approved', 'rejected'),
        allowNull: false,
        defaultValue: 'pending',
      },
      rejection_reason: { type: DataTypes.STRING(500), allowNull: true },
      submitted_at: { type: DataTypes.DATE, allowNull: false },
      reviewed_at: { type: DataTypes.DATE, allowNull: true },
      reviewed_by: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: table('users'), key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      application_version: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
      created_at: { type: DataTypes.DATE, allowNull: false },
      updated_at: { type: DataTypes.DATE, allowNull: false },
    },
    { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci', engine: 'InnoDB' },
  );
  await query.addIndex(table('buyer_profiles'), ['status', 'submitted_at']);
}

export async function down({ context: query }) {
  const [rows] = await query.sequelize.query(
    `SELECT COUNT(*) AS total FROM \`${table('users')}\` WHERE phone_verified_at IS NULL`,
  );
  if (Number(rows[0].total))
    throw new Error('যাচাইবিহীন ফোনের অ্যাকাউন্ট আছে; এই মাইগ্রেশন নিরাপদে ফেরানো যাবে না।');
  await query.dropTable(table('buyer_profiles'));
  await query.changeColumn(table('users'), 'phone_verified_at', {
    type: DataTypes.DATE,
    allowNull: false,
  });
}
