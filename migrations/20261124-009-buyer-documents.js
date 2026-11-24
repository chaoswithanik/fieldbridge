import { DataTypes } from 'sequelize';
import { env } from '../src/config/env.js';
import { buyerDocumentTypes } from '../src/services/buyer-documents.js';

const table = (name) => `${env.database.tablePrefix}${name}`;

export async function up({ context: query }) {
  await query.createTable(
    table('buyer_documents'),
    {
      id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
      buyer_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: table('buyer_profiles'), key: 'user_id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      document_type: { type: DataTypes.ENUM(...buyerDocumentTypes), allowNull: false },
      filename: { type: DataTypes.STRING(50), allowNull: false, unique: true },
      content_type: { type: DataTypes.STRING(100), allowNull: false },
      application_version: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      created_at: { type: DataTypes.DATE, allowNull: false },
      updated_at: { type: DataTypes.DATE, allowNull: false },
    },
    { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci', engine: 'InnoDB' },
  );
  await query.addIndex(table('buyer_documents'), ['buyer_id', 'application_version'], {
    name: 'buyer_docs_buyer_version',
  });
}

export async function down({ context: query }) {
  await query.dropTable(table('buyer_documents'));
}
