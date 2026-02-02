import { sql, type ColumnDataType, type ColumnDefinitionBuilder } from 'kysely';
import { db } from './db';
import type { Card } from 'ts-fsrs';
import type { CreateTableBuilder, Generated } from 'kysely';

type ColumnParams = [
  type: ColumnDataType,
  build?: (builder: ColumnDefinitionBuilder) => ColumnDefinitionBuilder,
];

const BUILD_KEY = '$build';
const table = <T extends { [K: string]: ColumnParams }>(
  columns: T,
  build: (
    builder: CreateTableBuilder<string, Extract<keyof T, string>>,
  ) => CreateTableBuilder<string, Extract<keyof T, string>>,
): T => {
  //@ts-ignore
  columns[BUILD_KEY] = build;
  return columns;
};
const column = {
  id: (c: ColumnDefinitionBuilder) => c.autoIncrement().primaryKey(),
  create_at: (c: ColumnDefinitionBuilder) =>
    c.defaultTo(sql`strftime('%s','now')`).notNull(),
  notNull: (c: ColumnDefinitionBuilder) => c.notNull(),
  foreignKey: (ref: string) => (c: ColumnDefinitionBuilder) =>
    c.references(ref).onDelete('cascade').notNull(),
};
const schema = {
  deck: {
    id: ['integer', column.id],
    create_at: ['integer', column.create_at],
    name: ['text', column.notNull],
  },
  template: {
    id: ['integer', column.id],
    create_at: ['integer', column.create_at],
    name: ['text', column.notNull],
    /**
     * @example
     * `{{front}}<hr>{{back}}`
     */
    content: ['text', column.notNull],
  },
  card: {
    id: ['integer', column.id],
    create_at: ['integer', column.create_at],
    deck_id: ['integer', column.foreignKey('deck.id')],
    template_id: ['integer', column.foreignKey('template.id')],
    /**
     * @example
     * `This is a pic {{media:123}}`
     */
    front: ['text', column.notNull],
    back: ['text', column.notNull],
  },
  media: {
    id: ['integer', column.id],
    create_at: ['integer', column.create_at],
    mime: ['text', column.notNull],
    size: ['integer', column.notNull],
    path: ['text', column.notNull],
  },
  card_media: table(
    {
      card_id: ['integer', column.foreignKey('card.id')],
      media_id: ['integer', column.foreignKey('media.id')],
    },
    (t) => t.addPrimaryKeyConstraint('card_media_pk', ['card_id', 'media_id']),
  ),
  fsrs: {
    card_id: ['integer', column.foreignKey('card.id')],
    due: ['integer', column.notNull],
    stability: ['real', column.notNull],
    difficulty: ['real', column.notNull],
    scheduled_days: ['integer', column.notNull],
    learning_steps: ['integer', column.notNull],
    reps: ['integer', column.notNull],
    lapses: ['integer', column.notNull],
    state: ['integer', column.notNull],
    last_review: ['integer'],
    elapsed_days: ['integer', column.notNull],
  } satisfies Record<keyof Card | 'card_id', ColumnParams>,
} satisfies Record<string, { [K: string]: ColumnParams }>;
type Schema = typeof schema;

type ColumnType = {
  text: string;
  integer: number;
  real: number;
};
const __typecheck__: Record<
  Schema extends Record<string, Record<string, [infer T, ...any[]]>>
    ? T
    : never,
  unknown
> = {} as ColumnType;
export type SchemaType = {
  [Table in keyof Schema]: {
    [Column in keyof Schema[Table]]: Schema[Table][Column] extends [
      infer T extends keyof ColumnType,
      ...any[],
    ]
      ? Column extends 'id' | 'create_at' | 'last_review'
        ? Generated<ColumnType[T]>
        : ColumnType[T]
      : never;
  };
};

// create table
for (const [table, columns] of Object.entries(schema)) {
  const builder = db.schema.createTable(table);
  for (const [column, params] of Object.entries(columns)) {
    column === BUILD_KEY
      ? params(builder)
      : builder.addColumn(column, params[0], params[1]);
  }
  await builder.execute();
}
// create row
await db
  .insertInto('template')
  .values({ name: 'Basic', content: '{{front}}<hr>{{back}}' })
  .execute();
