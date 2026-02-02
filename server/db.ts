import { Kysely } from 'kysely';
import { BunSqliteDialect } from 'kysely-bun-sqlite';
import { Database } from 'bun:sqlite';
import type { SchemaType } from '../scripts/create-db';

export const db = new Kysely<SchemaType>({
  dialect: new BunSqliteDialect({
    database: new Database(process.env.DB_URL ?? 'app.db'),
  }),
});
