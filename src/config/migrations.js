import { Umzug, SequelizeStorage } from 'umzug';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { env } from './env.js';

export function migrationRunner(connection) {
  return new Umzug({
    migrations: {
      glob: ['*.js', { cwd: fileURLToPath(new URL('../../migrations/', import.meta.url)) }],
      resolve: ({ name, path, context }) => ({
        name,
        up: async () => (await import(pathToFileURL(path).href)).up({ context }),
        down: async () => (await import(pathToFileURL(path).href)).down({ context }),
      }),
    },
    context: connection.getQueryInterface(),
    storage: new SequelizeStorage({
      sequelize: connection,
      tableName: `${env.database.tablePrefix}SequelizeMeta`,
    }),
    logger: undefined,
  });
}
