import { Database } from 'bun:sqlite';
import { CompiledQuery, Kysely } from 'kysely';
import { BunSqliteDialect } from 'kysely-bun-sqlite';
import path from 'node:path';
import type { SchemaType } from '../scripts/create-db';

export const db_dir = process.env.DB_DIR ?? './db';
export const db = new Kysely<SchemaType>({
  dialect: new BunSqliteDialect({
    database: new Database(path.join(db_dir, 'app.db')),
    async onCreateConnection(connection) {
      await connection.executeQuery(
        CompiledQuery.raw('PRAGMA foreign_keys = ON'),
      );
    },
  }),
});
