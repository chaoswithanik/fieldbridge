import { DataTypes } from 'sequelize';
import { env } from '../src/config/env.js';

const table = (name) => `${env.database.tablePrefix}${name}`;

export async function up({ context: query }) {
  const timestamps = () => ({
    created_at: { type: DataTypes.DATE, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false },
  });
  const options = { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci', engine: 'InnoDB' };
  const userReference = () => ({
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: table('users'), key: 'id' },
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  });
  await query.createTable(
    table('users'),
    {
      id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
      role: { type: DataTypes.ENUM('farmer', 'buyer', 'admin'), allowNull: false },
      full_name: { type: DataTypes.STRING(100), allowNull: false },
      phone: { type: DataTypes.STRING(11), allowNull: false, unique: true },
      email: { type: DataTypes.STRING(254), allowNull: true, unique: true },
      password_hash: { type: DataTypes.STRING(255), allowNull: false },
      phone_verified_at: { type: DataTypes.DATE, allowNull: false },
      ...timestamps(),
    },
    options,
  );
  await query.createTable(
    table('farmer_profiles'),
    {
      user_id: { ...userReference(), primaryKey: true },
      nid: { type: DataTypes.STRING(17), allowNull: false, unique: true },
      district: { type: DataTypes.STRING(80), allowNull: false },
      upazila: { type: DataTypes.STRING(80), allowNull: false },
      village: { type: DataTypes.STRING(100), allowNull: false },
      farm_address: { type: DataTypes.STRING(500), allowNull: false },
      farm_name: { type: DataTypes.STRING(120), allowNull: true },
      avatar_filename: { type: DataTypes.STRING(50), allowNull: true },
      ...timestamps(),
    },
    options,
  );
  await query.createTable(
    table('phone_verifications'),
    {
      id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
      phone: { type: DataTypes.STRING(11), allowNull: false, unique: true },
      code_hash: { type: DataTypes.STRING(64), allowNull: false },
      expires_at: { type: DataTypes.DATE, allowNull: false },
      next_send_at: { type: DataTypes.DATE, allowNull: false },
      attempts: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      consumed_at: { type: DataTypes.DATE, allowNull: true },
      ...timestamps(),
    },
    options,
  );
  await query.createTable(
    table('auth_sessions'),
    {
      id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
      user_id: userReference(),
      token_hash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
      expires_at: { type: DataTypes.DATE, allowNull: false },
      ...timestamps(),
    },
    options,
  );
  await query.addIndex(table('auth_sessions'), ['expires_at']);
}

export async function down({ context: query }) {
  for (const name of ['auth_sessions', 'phone_verifications', 'farmer_profiles', 'users'])
    await query.dropTable(table(name));
}
