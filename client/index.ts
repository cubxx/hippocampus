import { edenTreaty } from '@elysiajs/eden';
import van, { type ChildDom, type State } from 'vanjs-core';
import type { Api } from '../server';
import { list, reactive, replace, type ValueType } from 'vanjs-ext';
import { useApi, useHash, usePromise } from './hook';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

const { div, ul, li, label, input, button, span } = van.tags;
const api = edenTreaty<Api>('/').api;
const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
const hash = useHash();

const ApiButton = <P extends unknown[], T>(p: {
  class?: string;
  text: ChildDom;
  fetch: Parameters<typeof useApi<P, T>>[0];
  onClick(store: ReturnType<typeof useApi<P, T>>): void;
  render?(btn: HTMLButtonElement): HTMLElement;
}) => {
  p.render ??= (btn) =>
    div(
      {
        class: cn(
          !!store.error && 'tooltip tooltip-bottom tooltip-open tooltip-error',
        ),
        'data-tip': () => '' + (store.error ?? ''),
      },
      btn,
    );
  const store = useApi(p.fetch);
  const btn = button(
    {
      class: cn('btn', p.class),
      onclick(e: Event) {
        e.stopImmediatePropagation();
        store.loading || p.onClick(store);
      },
    },
    span({
      class: 'loading loading-spinner',
      hidden: () => !store.loading,
    }),
    span(
      { hidden: () => store.loading && p.class?.includes('btn-square') },
      p.text,
    ),
  );
  return p.render(btn);
};
const List = <T extends { id: number }[]>(p: {
  fetch(query: {
    qn: number;
    qs: number;
  }): ReturnType<Parameters<typeof useApi<[], T>>[0]>;
  row(item: State<ValueType<T>>): ChildDom;
  onSelect(item: ValueType<T>): void;
}) => {
  const query = reactive({ qn: 1, qs: 20 });
  const store = useApi(() => p.fetch(query));
  store.fetch();

  const items = reactive([] as unknown as T);
  const tip = van.derive(() =>
    store.loading
      ? 'Loading...'
      : store.data
        ? (replace(items, store.data), items.length)
          ? ''
          : 'Empty list'
        : '' + store.error,
  );
  return div(
    { class: 'h-[calc(100dvh_-_4rem)] overflow-y-auto scale-100' }, // create stacking context
    ApiButton({
      class: 'btn-primary btn-circle btn-xl',
      text: '+',
      fetch: (name: string) => api.deck.post({ name }),
      async onClick(store) {
        const name = prompt('new name');
        if (!name) return;
        await store.fetch(name);
        store.data && items.push(store.data);
      },
      render: (btn) => div({ class: 'fab' }, btn),
    }),
    div(
      { class: 'mx-4 my-2 text-center text-lg', hidden: () => !tip.val },
      tip,
    ),
    list(
      () => ul({ class: 'list' }),
      items,
      (item, deleter) =>
        li(
          {
            class: 'list-row items-center py-2',
            onclick: () => p.onSelect(item.val),
          },
          p.row(item),
          ApiButton({
            class: 'btn-square btn-ghost btn-secondary',
            text: 'Edit',
            fetch: (id: number, name: string) => api.deck[id]!.patch({ name }),
            async onClick(store) {
              const name = prompt('new name');
              if (!name) return;
              await store.fetch(item.val.id, name);
              store.data && Object.assign(item.val, store.data);
            },
          }),
          ApiButton({
            class: 'btn-square btn-ghost btn-accent',
            text: 'Del',
            fetch: (id: number) => api.deck[id]!.delete(),
            async onClick(store) {
              if (!confirm('Are you sure')) return;
              await store.fetch(item.val.id);
              store.error || deleter();
            },
          }),
        ),
    ),
  );
};

const DeckList = (p: { onSelect(deck_id: number): void }) => {
  const query = reactive({ qn: 1, qs: 20 });
  const deck_store = useApi(() => api.deck.get({ $query: query }));
  const decks = reactive<typeof deck_store.data & {}>([]);
  deck_store.fetch();

  const deck_tip = van.derive(() =>
    deck_store.loading
      ? 'Loading...'
      : deck_store.data
        ? (replace(decks, deck_store.data), decks.length)
          ? ''
          : 'Empty list'
        : '' + deck_store.error,
  );
  return div(
    { class: 'h-[calc(100dvh_-_4rem)] overflow-y-auto scale-100' }, // create stacking context
    ApiButton({
      class: 'btn-primary btn-circle btn-xl',
      text: '+',
      fetch: (name: string) => api.deck.post({ name }),
      async onClick(store) {
        const name = prompt('new name');
        if (!name) return;
        await store.fetch(name);
        store.data && decks.push(store.data);
      },
      render: (btn) => div({ class: 'fab' }, btn),
    }),
    div(
      { class: 'mx-4 my-2 text-center text-lg', hidden: () => !deck_tip.val },
      deck_tip,
    ),
    list(
      () => ul({ class: 'list' }),
      decks,
      (deck, deleter) =>
        li(
          {
            class: 'list-row items-center py-2',
            onclick: () => p.onSelect(deck.val.id),
          },
          div({ class: 'text-lg' }, () => deck.val.name),
          div({ class: 'text-right' }, () =>
            new Date(deck.val.create_at * 1e3).toLocaleString(),
          ),
          ApiButton({
            class: 'btn-square btn-ghost btn-secondary',
            text: 'Edit',
            fetch: (id: number, name: string) => api.deck[id]!.patch({ name }),
            async onClick(store) {
              const name = prompt('new name');
              if (!name) return;
              await store.fetch(deck.val.id, name);
              store.data && Object.assign(deck.val, store.data);
            },
          }),
          ApiButton({
            class: 'btn-square btn-ghost btn-accent',
            text: 'Del',
            fetch: (id: number) => api.deck[id]!.delete(),
            async onClick(store) {
              if (!confirm('Are you sure')) return;
              await store.fetch(deck.val.id);
              store.error || deleter();
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
      fetch: (query) => api.deck.get({ $query: query }),
      row: (item) => [
        div({ class: 'text-lg' }, () => item.val.name),
        div({ class: 'text-right' }, () =>
          new Date(item.val.create_at * 1e3).toLocaleString(),
        ),
      ],
      onSelect(item) {
        deck_id = item.id;
      },
    }),
  card: () =>
    List({
      fetch: (query) => api.card.get({ $query: { ...query, deck_id } }),
      row: (item) => div(() => JSON.stringify(item.val)),
      onSelect(item) {},
    }),
  media: () =>
    List({
      fetch: (query) => api.media.get({ $query: query }),

      row: (item) => div(() => JSON.stringify(item.val)),
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
