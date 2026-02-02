import type { EdenFetchError } from '@elysiajs/eden';
import van from 'vanjs-core';
import { calc, noreactive, reactive } from 'vanjs-ext';

export const useHash = () => {
  const hash = van.state(location.hash.slice(1));
  window.addEventListener(
    'hashchange',
    () => (hash.val = location.hash.slice(1)),
  );
  return hash;
};

export const usePromise = <T>(p: MaybeGetter<Promise<T>>) => {
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

export const useApi = <P extends unknown[], T>(
  fetch: (
    ...e: P
  ) => Promise<
    { data: T; error: null } | { data: null; error: EdenFetchError }
  >,
) => {
  const store = reactive<
    (
      | { loading: true; data?: null; error?: null }
      | { loading: false; data: T; error?: null }
      | { loading: false; data?: null; error: EdenFetchError | unknown }
    ) & { fetch: (...e: P) => Promise<void> }
  >({
    loading: false,
    error: null,
    fetch: noreactive(async (...e) => {
      store.loading = true;
      await fetch(...e).then(
        (res) => {
          store.data = res.data;
          store.error = res.error;
        },
        (err) => {
          store.error = err;
        },
      );
      store.loading = false;
    }),
  });
  return store;
};
