import van from 'vanjs-core';
import { reactive, replace } from 'vanjs-ext';

export const useHash = () => {
  const hash = van.state(location.hash.slice(1));
  window.addEventListener(
    'hashchange',
    () => (hash.val = location.hash.slice(1)),
  );
  return hash;
};

export const usePromiseFn = <P extends unknown[], T>(
  fn: (...e: P) => Promise<T>,
) => {
  const store = reactive<
    { loading: boolean; fn(...e: P): void } & (
      | { error: string; data: null }
      | { error: null; data: T }
    )
  >({
    loading: false,
    error: '',
    data: null,
    fn(...e) {
      store.loading = true;
      store.error = null;
      fn(...e)
        .then(
          (res) => (store.data = res),
          (err) => (store.error = '' + err),
        )
        .finally(() => (store.loading = false));
    },
  });
  return store;
};

export const useCRUD = <T extends object>(opts: {
  C: () => Promise<T>;
  R: (query: TableQuery) => Promise<T[]>;
  U: (item: T) => Promise<Partial<T>>;
  D: (item: T) => Promise<void>;
}) => {
  const store = reactive({
    query: { qs: 20, qn: 1 },
    items: [] as T[],
    C: usePromiseFn(() =>
      opts.C().then((res) => {
        store.items.push(res);
      }),
    ),
    R: usePromiseFn(
      (): Promise<void> =>
        opts.R(store.query).then((res) => {
          replace(store.items, res);
        }),
    ),
    U: usePromiseFn((item: T) =>
      opts.U(item).then((res) => {
        Object.assign(item, res);
      }),
    ),
    D: usePromiseFn(
      async (item: T) =>
        confirm('Are you sure') &&
        opts.D(item).then(() => {
          const i = store.items.indexOf(item);
          if (i != -1) store.items.splice(i, 1);
          else console.warn(`item is not in store: ${item}`);
        }),
    ),
  });
  return store;
};
export const useToast = () => {
  type Toast = { type: LogLevel; text: string };
  const store = reactive({
    items: [] as Toast[],
    handle(item: Toast) {
      const show = van.state(true);
      setTimeout(() => {
        show.val = false;
        setTimeout(() => {
          const items = store.items;
          const i = items.indexOf(item);
          if (i === -1) return;
          items.splice(i, 1);
        }, 3e2);
      }, 3e3);
      return show;
    },
    show(text: string, type: LogLevel = 'info') {
      store.items.push({ text, type });
    },
  });
  return store;
};
