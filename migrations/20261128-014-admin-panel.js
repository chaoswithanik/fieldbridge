import { DataTypes } from 'sequelize';
import { env } from '../src/config/env.js';
const table = (name) => env.database.tablePrefix + name;

export async function up({ context: query }) {
  for (const [name, column] of [['users', 'blocked'], ['crop_listings', 'hidden_by_admin']]) {
    if (!(await query.describeTable(table(name)))[column])
      await query.addColumn(table(name), column, { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false });
  }
  await query.createTable(table('crop_categories'), {
    id: { type: DataTypes.UUID, primaryKey: true },
    name: { type: DataTypes.STRING(80), unique: true, allowNull: false },
    crop_ids: { type: DataTypes.JSON, allowNull: false },
    version: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
  }, { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' });
}
export async function down({ context: query }) {
  await query.dropTable(table('crop_categories'));
  await query.removeColumn(table('crop_listings'), 'hidden_by_admin');
  await query.removeColumn(table('users'), 'blocked');
}
