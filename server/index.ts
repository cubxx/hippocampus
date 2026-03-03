import staticPlugin from '@elysiajs/static';
import { Elysia, t } from 'elysia';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Grades,
  type Grade,
} from 'ts-fsrs';
import { db, db_dir } from './db';

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
        .limit(query.qs)
        .offset((query.qn - 1) * query.qs)
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
        .limit(query.qs)
        .offset((query.qn - 1) * query.qs)
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
    ({ query }) => {
      let builder = db
        .selectFrom('card')
        .innerJoin('fsrs', 'card.id', 'fsrs.card_id')
        .selectAll(['card', 'fsrs'])
        .where('deck_id', '=', query.deck_id)
        .limit(query.qs)
        .offset((query.qn - 1) * query.qs);
      if (query.learn != null) {
        builder = builder.where('fsrs.due', '<=', Date.now());
      }
      return builder.execute();
    },
    {
      query: t.Object({
        deck_id: t.Integer(),
        qn: t.Integer({ minimum: 1, default: 1 }),
        qs: t.Integer({ minimum: 1, default: 20 }),
        learn: t.Optional(t.Literal('')),
      }),
    },
  )
  .post(
    '/',
    async ({ body }) => {
      const card = createEmptyCard();

      return await db.transaction().execute(async (trx) => {
        const row = await trx
          .insertInto('card')
          .values(body)
          .returningAll()
          .executeTakeFirstOrThrow();
        const fsrs = await trx
          .insertInto('fsrs')
          .values({
            ...card,
            due: +card.due,
            last_review: card.last_review?.getTime(),
            card_id: row.id,
          })
          .returningAll()
          .executeTakeFirstOrThrow();

        const values = body.front
          .matchAll(/\{\{media:(\d+)\}\}/g)
          .map(([_, id]) => id?.length && { card_id: row.id, media_id: +id })
          .filter((e) => !!e)
          .toArray();
        if (values.length)
          await trx.insertInto('card_media').values(values).execute();

        return { ...row, ...fsrs };
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
      const item = scheduling_cards[body.grade];
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
      body: t.Object({
        date: t.Integer(),
        grade: t.UnionEnum(Grades as [Grade, ...Grade[]]),
      }),
    },
  )
  .delete(
    '/:id',
    async ({ params }) => {
      await db.deleteFrom('card').where('id', '=', params.id).execute();
    },
    { params: t.Object({ id: t.Integer() }) },
  );

const media_types: MediaTypes = ['image', 'audio', 'video'];
const media = new Elysia({ prefix: '/media' })
  .get(
    '/',
    ({ query }) =>
      db
        .selectFrom('media')
        .select(['id', 'mime', 'size', 'create_at'])
        .where('mime', 'like', query.type + '/%')
        .limit(query.qs)
        .offset((query.qn - 1) * query.qs)
        .execute(),
    {
      query: t.Object({
        qn: t.Integer({ minimum: 1, default: 1 }),
        qs: t.Integer({ minimum: 1, default: 20 }),
        type: t.UnionEnum(media_types),
      }),
    },
  )
  .get(
    '/:id',
    async ({ params, set }) => {
      const media = await db
        .selectFrom('media')
        .select(['path', 'mime'])
        .where('id', '=', params.id)
        .executeTakeFirstOrThrow();
      const file = Bun.file(media.path, { type: media.mime });
      if (!(await file.exists())) {
        await db.deleteFrom('media').where('id', '=', params.id).execute();
        set.status = 404;
        return `No Found: ${media.path}`;
      }
      set.headers['cache-control'] = 'max-age=31536000';
      return file;
    },
    { params: t.Object({ id: t.Integer() }) },
  )
  .post(
    '/',
    async ({ body }) => {
      const promises = body.files.map(async (file) => {
        const filepath = path.join(db_dir, 'medias', randomUUID());
        await Bun.write(filepath, file);
        return db
          .insertInto('media')
          .values({ path: filepath, mime: file.type, size: file.size })
          .returningAll()
          .executeTakeFirstOrThrow();
      });
      return await Promise.allSettled(promises);
    },
    { body: t.Object({ files: t.Files({ type: media_types }) }) },
  )
  .delete(
    '/:id',
    async ({ params }) => {
      await db.transaction().execute(async () => {
        const media = await db
          .deleteFrom('media')
          .where('id', '=', params.id)
          .returning('path')
          .executeTakeFirstOrThrow();
        await fs.rm(media.path);
      });
    },
    { params: t.Object({ id: t.Integer() }) },
  );

const app = new Elysia()
  .use(staticPlugin({ assets: 'client/dist', prefix: '/' }))
  .group('/api', (grp) => grp.use(deck).use(template).use(card).use(media))
  .onRequest(({ request: req, server }) => {
    console.log(`${req.method} ${req.url.replace(server!.url.href, '/')}`);
  })
  .listen({ port: process.env.PORT ?? 3000, hostname: '127.0.0.1' }, (svr) =>
    console.info(`Listen: ${svr.url}`),
  );

export type Api = typeof app;
