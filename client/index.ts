import { edenTreaty } from '@elysiajs/eden';
import van, { type ChildDom, type State } from 'vanjs-core';
import type { Api } from '../server';
import { list, reactive, replace, type ValueType } from 'vanjs-ext';
import { useApi, useHash, usePromise } from './hook';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

const { div, ul, li, label, input, button, span } = van.tags;
const { api } = edenTreaty<Api>('/');
const safe = <T>(
  res: { data: T; error: null } | { data: null; error: Error },
) => {
  if (res.error != null) throw res.error;
  return res.data;
};
const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
const hash = useHash();

const Button = (p: {
  class?: string;
  text: ChildDom;
  action(): Promise<unknown>;
}) => {
  const loading = van.state(false);
  return button(
    {
      class: cn('btn', p.class),
      onclick(e: Event) {
        e.stopImmediatePropagation();
        if (loading.val) return;
        loading.val = true;
        p.action().finally(() => (loading.val = false));
      },
    },
    span({ class: 'loading loading-spinner', hidden: () => !loading.val }),
    span(
      { hidden: () => loading.val && p.class?.includes('btn-square') },
      p.text,
    ),
  );
};
const List = <T extends { id: number }>(p: {
  fetch(query: { qn: number; qs: number }): Promise<T[]>;
  item(item: State<T>): ChildDom;
  onAdd(): Promise<T>;
  onEdit(id: number): Promise<T>;
  onDel(id: number): Promise<void>;
  onSelect(item: T): void;
}) => {
  const store = reactive({
    loading: false,
    data: [] as T[],
    error: null as Error | null,
  });
  const tip = van.derive(() =>
    store.loading
      ? 'Loading...'
      : store.data
        ? store.data.length
          ? ''
          : 'Empty list'
        : '' + store.error,
  );

  const query = reactive({ qn: 1, qs: 20 });
  p.fetch(query)
    .then(
      (res) => (store.data = res ?? []),
      (err) => (store.error = err),
    )
    .finally(() => (store.loading = false));

  return div(
    { class: 'h-[calc(100dvh_-_4rem)] overflow-y-auto scale-100' }, // create stacking context
    div(
      { class: 'fab' },
      Button({
        class: 'btn-primary btn-circle btn-xl',
        text: '+',
        action: () => p.onAdd().then((data) => store.data.push(data), alert),
      }),
    ),
    div(
      { class: 'mx-4 my-2 text-center text-lg', hidden: () => !tip.val },
      tip,
    ),
    list(
      () => ul({ class: 'list' }),
      store.data,
      (item, deleter) =>
        li(
          {
            class: 'list-row items-center py-2',
            onclick: () => p.onSelect(item.val),
          },
          p.item(item),
          Button({
            class: 'btn-square btn-ghost btn-secondary',
            text: 'Edit',
            action: () =>
              p
                .onEdit(item.val.id)
                .then((data) => Object.assign(item.val, data), alert),
          }),
          Button({
            class: 'btn-square btn-ghost btn-accent',
            text: 'Del',
            async action() {
              return (
                confirm('Are you sure') &&
                p.onDel(item.val.id).then(deleter, alert)
              );
            },
          }),
        ),
    ),
  );
};

const Study = () => {
  return div();
};

let deck_id = 0;
const routes: Record<string, MaybeGetter<HTMLElement>> = {
  study: () => Study(),
  deck: () =>
    List({
      fetch: (query) => api.deck.get({ $query: query }).then(safe),
      item: (item) => [
        div({ class: 'text-lg' }, () => item.val.name),
        div({ class: 'text-right' }, () =>
          new Date(item.val.create_at * 1e3).toLocaleString(),
        ),
      ],
      async onAdd() {
        const name = prompt('deck name');
        if (!name) throw Error('Empty name');
        return await api.deck.post({ name }).then(safe);
      },
      async onEdit(id) {
        const name = prompt('new name');
        if (!name) throw Error('Empty name');
        return await api.deck[id]!.patch({ name }).then(safe);
      },
      async onDel(id) {
        await api.deck[id]!.delete().then(safe);
      },
      onSelect(item) {
        deck_id = item.id;
      },
    }),
  card: () =>
    List({
      fetch: (
        query,
      ): Promise<
        {
          id: number;
          create_at: number;
          deck_id: number;
          template_id: number;
          front: string;
          back: string;
        }[]
      > => api.card.get({ $query: { ...query, deck_id } }).then(safe),
      item: (item) => div(() => JSON.stringify(item.val)),
      async onAdd() {
        const template_id = 0;
        const front = '';
        const back = '';
        return await api.card
          .post({ deck_id, template_id, front, back })
          .then(safe);
      },
      async onEdit(id) {
        const deck_id = 0;
        const template_id = 0;
        const front = '';
        const back = '';
        return await api.card[id]!.patch({
          deck_id,
          template_id,
          front,
          back,
        }).then(safe);
      },
      async onDel(id) {
        await api.card[id]!.delete();
      },
      onSelect(item) {},
    }),
  media: () =>
    List({
      fetch: (query) => api.media.get({ $query: query }),

      item: (item) => div(() => JSON.stringify(item.val)),
      onSelect(item) {},
    }),
};
const route_names = Object.keys(routes);
location.hash ||= route_names[0]!; // first route

const root = div(
  { id: 'app' },
  div(
    { class: 'dock bg-neutral font-bold' },
    route_names.map((name) =>
      button(
        {
          class: () => (hash.val === name ? 'dock-active text-primary' : ''),
          onclick: () => (location.hash = name),
        },
        name[0]?.toUpperCase() + name.slice(1),
      ),
    ),
  ),
);
van.derive(() => {
  for (const name of route_names) {
    const hidden = hash.val !== name;
    let route = routes[name]!;
    if (typeof route === 'function')
      // lazy load
      hidden || van.add(root, (routes[name] = route = route()));
    else route.hidden = hidden;
  }
});
van.add(document.body, root);
