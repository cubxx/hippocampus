import staticPlugin from '@elysiajs/static';
import { Elysia, t, ValidationError } from 'elysia';
import { createEmptyCard, fsrs, generatorParameters, Rating } from 'ts-fsrs';
import { db } from './db';

const FSRS = fsrs(
  generatorParameters({ enable_short_term: true, enable_fuzz: false }),
);

const deck = new Elysia({ prefix: '/deck' })
  .get(
    '/',
    ({ query }) =>
      db
        .selectFrom('deck')
        .selectAll()
        .limit(query.qn)
        .offset((query.qs - 1) * query.qn)
        .execute(),
    {
      query: t.Object({
        qn: t.Integer({ minimum: 1, default: 1 }),
        qs: t.Integer({ minimum: 1, default: 20 }),
      }),
    },
  )
  .post(
    '/',
    async ({ body }) => {
      const row = await db
        .insertInto('deck')
        .values(body)
        .returningAll()
        .executeTakeFirstOrThrow();
      return row;
    },
    { body: t.Object({ name: t.String() }) },
  )
  .patch(
    '/:id',
    async ({ params, body }) => {
      const row = await db
        .updateTable('deck')
        .where('id', '=', params.id)
        .set(body)
        .returningAll()
        .executeTakeFirstOrThrow();
      return row;
    },
    {
      params: t.Object({ id: t.Integer() }),
      body: t.Object({ name: t.String() }),
    },
  )
  .delete(
    '/:id',
    async ({ params }) => {
      await db.deleteFrom('deck').where('id', '=', params.id).execute();
      return;
    },
    { params: t.Object({ id: t.Integer() }) },
  );
const template = new Elysia({ prefix: '/template' })
  .get(
    '/',
    ({ query }) =>
      db
        .selectFrom('template')
        .selectAll()
        .limit(query.qn)
        .offset((query.qs - 1) * query.qn)
        .execute(),
    {
      query: t.Object({
        qn: t.Integer({ minimum: 1, default: 1 }),
        qs: t.Integer({ minimum: 1, default: 20 }),
      }),
    },
  )
  .post(
    '/',
    async ({ body }) => {
      const row = await db
        .insertInto('template')
        .values(body)
        .returningAll()
        .executeTakeFirstOrThrow();
      return row;
    },
    { body: t.Object({ name: t.String(), content: t.String() }) },
  )
  .patch(
    '/:id',
    async ({ params, body }) => {
      const row = await db
        .updateTable('template')
        .where('id', '=', params.id)
        .set(body)
        .returningAll()
        .executeTakeFirstOrThrow();
      return row;
    },
    {
      params: t.Object({ id: t.Integer() }),
      body: t.Object(
        { name: t.Optional(t.String()), content: t.Optional(t.String()) },
        { minProperties: 1 },
      ),
    },
  )
  .delete(
    '/:id',
    async ({ params }) => {
      await db.deleteFrom('template').where('id', '=', params.id).execute();
      return;
    },
    { params: t.Object({ id: t.Integer() }) },
  );
const card = new Elysia({ prefix: '/card' })
  .get(
    '/',
    ({ query }) =>
      db
        .selectFrom('card')
        .innerJoin('fsrs', 'card.id', 'card_fsrs.card_id')
        .selectAll('card')
        .select(['fsrs.due', 'card_fsrs.scheduled_days'])
        .limit(query.qn)
        .offset((query.qs - 1) * query.qn)
        .execute(),
    {
      query: t.Object({
        qn: t.Integer({ minimum: 1, default: 1 }),
        qs: t.Integer({ minimum: 1, default: 20 }),
      }),
    },
  )
  .post(
    '/',
    async ({ body }) => {
      const card = createEmptyCard();

      await db.transaction().execute(async (trx) => {
        const row = await trx
          .insertInto('card')
          .values(body)
          .returning('id')
          .executeTakeFirstOrThrow();
        await trx
          .insertInto('fsrs')
          .values({
            ...card,
            due: +card.due,
            last_review: card.last_review?.getTime(),
            card_id: row.id,
          })
          .returningAll()
          .execute();
      });
    },
    {
      body: t.Object({
        deck_id: t.Integer(),
        template_id: t.Integer(),
        front: t.String(),
        back: t.String(),
      }),
    },
  )
  .patch(
    '/:id',
    async ({ params, body }) => {
      const row = await db
        .updateTable('card')
        .where('id', '=', params.id)
        .set(body)
        .returningAll()
        .executeTakeFirstOrThrow();
      return row;
    },
    {
      params: t.Object({ id: t.Integer() }),
      body: t.Object(
        {
          deck_id: t.Optional(t.Integer()),
          template_id: t.Optional(t.Integer()),
          front: t.Optional(t.String()),
          back: t.Optional(t.String()),
        },
        { minProperties: 1 },
      ),
    },
  )
  .patch(
    '/:id/fsrs',
    async ({ params, body }) => {
      const card = await db
        .selectFrom('fsrs')
        .selectAll()
        .where('card_id', '=', params.id)
        .executeTakeFirstOrThrow();

      const scheduling_cards = FSRS.repeat(card, body.date);
      const item = scheduling_cards[Rating.Easy];
      const new_card = item.card;
      const new_log = item.log;

      await db
        .updateTable('fsrs')
        .where('card_id', '=', params.id)
        .set({
          ...new_card,
          due: +new_card.due,
          last_review: new_card.last_review?.getTime(),
        })
        .execute();
    },
    {
      params: t.Object({ id: t.Integer() }),
      body: t.Object({ date: t.Integer() }),
    },
  )
  .delete(
    '/:id',
    async ({ params }) => {
      await db.deleteFrom('card').where('id', '=', params.id).execute();
      return;
    },
    { params: t.Object({ id: t.Integer() }) },
  );
const app = new Elysia()
  .use(staticPlugin({ assets: 'dist', prefix: '/' }))
  .use(deck)
  .use(template)
  .use(card)
  .onError(({ error, set }) => {
    if (error instanceof ValidationError) {
      set.status = 418;
    }
    set.status = 500;
    return { error };
  })
  .listen(process.env.PORT ?? 3000);

export type App = typeof app;
