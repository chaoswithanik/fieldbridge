import { DataTypes, QueryTypes } from 'sequelize';
import { env } from '../src/config/env.js';
import { resolveCropName } from '../shared/crop-catalog.js';

const tables = ['crop_listings', 'purchase_requirements'].map((name) => env.database.tablePrefix + name);

export async function up({ context: query }) {
  for (const table of tables) {
    const columns = await query.describeTable(table);
    for (const column of ['crop_id', 'variety_id']) {
      if (!columns[column]) await query.addColumn(table, column, { type: DataTypes.STRING(50), allowNull: true });
    }
    const quoted = query.queryGenerator.quoteTable(table);
    const names = await query.sequelize.query(
      `SELECT DISTINCT BINARY crop_name AS name FROM ${quoted} WHERE crop_id IS NULL`,
      { type: QueryTypes.SELECT },
    );
    for (const row of names) {
      const original = row.name.toString();
      const selected = resolveCropName(original);
      if (selected) await query.sequelize.query(
        `UPDATE ${quoted} SET crop_id = :cropId, variety_id = :varietyId, crop_name = :cropName
         WHERE crop_id IS NULL AND BINARY crop_name = BINARY :original`,
        { replacements: { ...selected, original } },
      );
    }
  }
  if (!(await query.showIndex(tables[0])).some((index) => index.name === 'listing_catalog_match'))
    await query.addIndex(tables[0], ['crop_id', 'unit', 'status', 'variety_id'], { name: 'listing_catalog_match' });
}

export async function down({ context: query }) {
  await query.removeIndex(tables[0], 'listing_catalog_match');
  for (const table of tables) {
    await query.removeColumn(table, 'variety_id');
    await query.removeColumn(table, 'crop_id');
  }
}
