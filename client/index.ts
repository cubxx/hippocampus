import { edenTreaty } from '@elysiajs/eden';
import van from 'vanjs-core';
import type { App } from '../server';
import { list, reactive } from 'vanjs-ext';

const { div, ul, li, label, input } = van.tags;
const app = edenTreaty<App>(`/api`);

type MaybeGetter<T> = T | (() => T);
type ApiResult<T extends (...e: any) => any> = Extract<
  Awaited<ReturnType<T>>,
  { error: null }
>['data'];

const hash = van.state(location.hash.slice(1));
window.addEventListener(
  'hashchange',
  () => (hash.val = location.hash.slice(1)),
);
const usePromise = <T>(p: MaybeGetter<Promise<T>>) => {
  const promise = typeof p === 'function' ? van.derive(p) : van.state(p);
  const store = reactive<
    | { loading: true; state: 'pending' }
    | { loading: false; state: 'fulfilled'; value: T }
    | { loading: false; state: 'rejected'; reason: unknown }
  >({ loading: true, state: 'pending' });
  van.derive(() => {
    Object.assign(store, { loading: true, state: 'pending' });
    promise.val.then(
      (value) => {
        Object.assign(store, { loading: false, state: 'fulfilled', value });
      },
      (reason) => {
        Object.assign(store, { loading: false, state: 'rejected', reason });
      },
    );
  });
  return store;
};

const DeckList = () => {
  const query = reactive({ qn: 1, qs: 20 });
  const p = usePromise(() => app.deck.get({ $query: query }));
  const decks = reactive<ApiResult<typeof app.deck.get>>([]);
  van.derive(() => {
    p.loading
      ? decks.unshift({ id: -1, create_at: Date.now(), name: 'Loading...' })
      : p.state === 'fulfilled'
        ? p.value
        : [p.reason];
  });
  return list(
    () => ul({ class: 'list' }),
    decks,
    (deck) => li({ class: 'list-row' }),
  );
};
van.add(document.body, div({ id: 'app' }, DeckList()));
