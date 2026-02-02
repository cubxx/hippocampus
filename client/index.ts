import { edenTreaty } from '@elysiajs/eden';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Grades, Rating, State, type Grade } from 'ts-fsrs';
import van, { type ChildDom, type ValidChildDomValue } from 'vanjs-core';
import { list, reactive } from 'vanjs-ext';
import type { Api } from '../server';
import { useCRUD, useHash, usePromiseFn, useToast } from './hook';

const {
  div,
  button,
  select,
  option,
  input,
  textarea,
  span,
  dialog,
  table,
  thead,
  tbody,
  th,
  tr,
  td,
  img,
  video,
  audio,
} = van.tags;
const { api } = edenTreaty<Api>('./');
const safe = <T>(
  res: { data: T; error: null } | { data: null; error: Error },
) => {
  if (res.error == null) return res.data;
  toast.show('' + res.error, 'error');
  throw res.error;
};
const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
const unix_timestamp_to_ymd = (() => {
  const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return (time: number) => {
    const t = Temporal.Instant.fromEpochMilliseconds(
      time * 1e3,
    ).toZonedDateTimeISO(TZ);
    return `${t.year}-${t.month}-${t.day}`;
  };
})();
const hash = useHash();
const toast = useToast();

const deck_crud = useCRUD({
  R: (query) => api.deck.get({ $query: query }).then(safe),
  async C() {
    const name = prompt('name');
    if (!name) throw Error('Empty name');
    return await api.deck.post({ name }).then(safe);
  },
  async U(item) {
    const name = prompt('new name', item.name);
    if (!name) throw Error('Empty name');
    return await api.deck[item.id]!.patch({ name }).then(safe);
  },
  async D(item) {
    await api.deck[item.id]!.delete().then(safe);
  },
});
const template_crud = useCRUD({
  R: (query) => api.template.get({ $query: query }).then(safe),
  async C() {
    const name = prompt('name');
    if (!name) throw Error('Empty name');
    const content = prompt('content');
    if (!content) throw Error('Empty content');
    return await api.template.post({ name, content }).then(safe);
  },
  async U(item) {
    const name = prompt('new name', item.name);
    if (!name) throw Error('Empty name');
    const content = prompt('new content', item.content);
    if (!content) throw Error('Empty content');
    return await api.template[item.id]!.patch({ name, content }).then(safe);
  },
  async D(item) {
    await api.template[item.id]!.delete();
  },
});

const Button = <P extends unknown[]>(p: {
  class?: string;
  text: ChildDom;
  onClick(): Promise<void>;
}) => {
  const store = reactive({ loading: false, error: '' });
  van.derive(() => store.error && toast.show(store.error, 'error'));

  const btn = button(
    {
      class: cn('btn', p.class),
      async onclick(e: Event) {
        e.stopImmediatePropagation();
        if (store.loading) return;
        store.loading = true;
        store.error = '';
        await p.onClick().catch((err) => (store.error = '' + err));
        store.loading = false;
      },
    },
    span({ class: 'loading loading-spinner', hidden: () => !store.loading }),
    span(
      {
        hidden: () =>
          store.loading &&
          (btn.classList.contains('btn-square') ||
            btn.classList.contains('btn-circle')),
      },
      p.text,
    ),
  );
  return btn;
};
const Table = <T extends object, K extends (keyof T & string)[]>(props: {
  model: ReturnType<typeof useCRUD<T>>;
  keys: K;
  topbar?: (btn: HTMLButtonElement) => HTMLElement;
  rows: { [P in K[0]]: (value: T[P]) => ValidChildDomValue };
  onRow?(item: T): void;
}) => {
  props.topbar ??= (btn) => div({ class: 'm-4 flex' }, btn);
  const tbl = table(
    { class: 'table table-zebra' },
    thead(tr(props.keys.map((k) => th(k)))),
    list(tbody, props.model.items, (item) =>
      tr(
        { onclick: () => props.onRow?.(item.val) },
        props.keys.map((k) => td(() => props.rows[k](item.val[k]))),
        td(
          { class: 'join' },
          Button({
            class: 'join-item btn-square btn-secondary',
            text: 'U',
            async onClick() {
              await props.model.U.fn(item.val);
            },
          }),
          Button({
            class: 'join-item btn-square btn-accent',
            text: 'D',
            async onClick() {
              await props.model.D.fn(item.val);
            },
          }),
        ),
      ),
    ),
  );
  return div(
    props.topbar(
      Button({
        class: 'btn-primary flex-1',
        text: 'C',
        async onClick() {
          await props.model.C.fn();
        },
      }),
    ),
    div({ class: 'text-center' }, () => {
      const { R } = props.model;
      return R.loading ? 'Loading...' : (R.error ?? '');
    }),
    div({ class: 'overflow-x-auto' }, tbl),
  );
};

const MEDIA_TYPE_COMPS = {
  image: (src) =>
    img({ style: 'width:100%;height:400px', alt: src, 'data-src': src }),
  video: (src) => video({ controls: true, preload: 'none', 'data-src': src }),
  audio: (src) =>
    audio({ class: 'pt-10', controls: true, preload: 'none', 'data-src': src }),
} satisfies Record<string, (src: string) => HTMLElement>;
const Media = <T extends string | undefined = undefined>(props: {
  id: number;
  mime?: T;
}): T extends string ? HTMLElement : Promise<HTMLElement> => {
  const url = './api/media/' + props.id,
    mime =
      props.mime ??
      fetch(url).then((res) => res.headers.get('content-type') ?? '');
  const render = (mime: string) =>
    MEDIA_TYPE_COMPS[
      (mime.split('/', 1)[0] ?? '') as keyof typeof MEDIA_TYPE_COMPS
    ]?.(url) ?? `Unknown MIME: ${mime}`;
  //@ts-ignore
  return typeof mime === 'string' ? render(mime) : mime.then(render);
};
const Study = () => {
  template_crud.items.length || template_crud.R.fn();

  let grade: Grade | null = null;

  const deck_id = van.derive(() =>
    hash.val.startsWith('study-') ? +hash.val.slice(6) : NaN,
  );
  const crud = useCRUD({
    R: () =>
      api.card
        .get({ $query: { deck_id: deck_id.val, qn: 1, qs: 1e2, learn: '' } })
        .then(safe),
    C() {
      throw Error('Unsupport');
    },
    async U(item) {
      if (grade == null) throw Error('grade is null');
      await api.card[item.id]!.fsrs.patch({ date: Date.now(), grade }).then(
        safe,
      );
      // goto next card
      grade = null;
      if ((card.val = crud.items[crud.items.indexOf(item) + 1]) == null)
        location.hash = 'deck';

      return item;
    },
    D() {
      throw Error('Unsupport');
    },
  });

  van.derive(() => {
    Number.isNaN(deck_id.val) || crud.R.fn();
  });
  const card = van.derive(() => {
    crud.items.length;
    return crud.items[0];
  });

  const parse_template = (
    tmpl: string,
    data: Record<'front' | 'back' | `media:${number}`, string>,
  ) =>
    (Object.keys(data) as (keyof typeof data)[]).reduce(
      (acc, k) => acc.replace(`{{${k}}}`, data[k]!),
      tmpl,
    );
  const content_idx = van.state<0 | 1>(0);
  const contents = van.state<string[] | null>(null);
  van.derive(async () => {
    if (card.val == null) {
      contents.val = null;
      return;
    }

    const tmpl = template_crud.items.length
      ? template_crud.items.find((e) => e.id === card.val!.template_id)
      : null;
    if (tmpl == null) {
      contents.val = null;
      return;
    }

    const medias = await Promise.all(
      (card.val.front + card.val.back)
        .matchAll(/\{\{media:(\d+)\}\}/g)
        .map(([_, id]) => id?.length && +id)
        .filter((e) => e != null)
        .map((id) =>
          Media({ id }).then((el) => {
            el.style = ''; //@ts-ignore
            el.src = el.dataset.src;
            return { id, html: el.outerHTML };
          }),
        ),
    );
    contents.val = parse_template(tmpl.content, {
      front: card.val.front,
      back: card.val.back,
      ...medias.reduce(
        (obj, { id, html }) => {
          obj[`media:${id}`] = html;
          return obj;
        },
        {} as Record<string, string>,
      ),
    }).split('<next>', 2);
  });

  const grade_level_map = {
    [Rating.Again]: 'error',
    [Rating.Hard]: 'warning',
    [Rating.Good]: 'info',
    [Rating.Easy]: 'success',
  } satisfies Record<Grade, LogLevel>;
  return div(
    { class: 'text-center' },
    div(
      { hidden: () => !!card.val, class: 'h-full flex-center text-error' },
      'No cards to study',
    ),
    div(
      { hidden: () => !card.val, class: 'h-full' },
      // div({ id: 'stat' }),
      div(
        {
          id: 'front',
          hidden: () => content_idx.val,
          class: 'h-full overflow-y-auto flex flex-col',
        },
        div({
          class: 'flex-1 flex-center',
          innerHTML: () => contents.val?.[content_idx.val] ?? 'No content',
        }),
        button(
          {
            class: 'btn btn-soft btn-primary m-4',
            onclick() {
              content_idx.val = 1;
            },
          },
          'Flip',
        ),
      ),
      div(
        {
          id: 'back',
          hidden: () => !content_idx.val,
          class: 'h-full overflow-y-auto flex flex-col',
        },
        div({
          class: 'flex-1 flex-center',
          innerHTML: () => contents.val?.[content_idx.val] ?? 'No content',
        }),
        div(
          { class: 'm-4 grid grid-cols-4 gap-2' },
          Grades.map((e) =>
            Button({
              class: `btn btn-soft btn-${grade_level_map[e]}`,
              text: Rating[e],
              async onClick() {
                if (card.val == null) return;
                content_idx.val = 0;
                grade = e;
                await crud.U.fn(card.val);
              },
            }),
          ),
        ),
      ),
    ),
  );
};

// init
const routes: Record<string, MaybeGetter<HTMLElement>> = {
  deck() {
    deck_crud.items.length || deck_crud.R.fn();

    return Table({
      model: deck_crud,
      keys: ['id', 'name', 'create_at'],
      rows: {
        id: (v) => v,
        name: (v) => v,
        create_at: unix_timestamp_to_ymd,
      },
      onRow(item) {
        location.hash = 'study-' + item.id;
      },
    });
  },
  template() {
    template_crud.items.length || template_crud.R.fn();

    return Table({
      model: template_crud,
      keys: ['id', 'name', 'content', 'create_at'],
      rows: {
        id: (v) => v,
        name: (v) => v,
        content: (v) => v,
        create_at: unix_timestamp_to_ymd,
      },
    });
  },
  card() {
    deck_crud.items.length || deck_crud.R.fn();
    template_crud.items.length || template_crud.R.fn();

    const deck_id = van.state(-1);
    van.derive(
      () => deck_crud.R.loading || (deck_id.val = deck_crud.items[0]?.id ?? -1),
    );

    const editor = reactive({
      data: {
        deck_id: -1,
        template_id: -1,
        front: '',
        back: '',
      } as CardEditable,
      set(data: CardEditable) {
        editable_keys.forEach(
          <T extends keyof CardEditable>(k: T) => (editor.data[k] = data[k]),
        );
      },
      show() {
        editor.cancel();
        diag.showModal();
        return new Promise<void>((resolve, reject) => {
          editor.ok = resolve;
          editor.cancel = () => reject('Cancel');
        }).finally(() => diag.close());
      },
      ok() {},
      cancel() {},
    });
    const editable_keys = Object.keys(editor.data) as (keyof CardEditable)[];
    const upload_files = usePromiseFn((files: FileList) =>
      api.media.post({ files }).then(safe),
    );
    const diag = dialog(
      { class: 'modal' },
      div(
        { class: 'modal-box flex-center gap-2' },
        list(
          () =>
            select({
              class: 'select',
              value: () => editor.data.deck_id,
              onchange(e) {
                editor.data.deck_id = e.target.value;
              },
            }),
          deck_crud.items,
          (item) => option({ value: () => item.val.id }, () => item.val.name),
        ),
        list(
          () =>
            select({
              class: 'select',
              value: () => editor.data.template_id,
              onchange(e) {
                editor.data.template_id = e.target.value;
              },
            }),
          template_crud.items,
          (item) => option({ value: () => item.val.id }, () => item.val.name),
        ),
        input({
          type: 'file',
          class: 'file-input',
          multiple: true,
          async onchange(e) {
            const files: FileList = e.target.files;
            if (!files.length) return;

            await upload_files.fn(files);
            if (upload_files.error != null) {
              toast.show(upload_files.error, 'error');
              return;
            }

            let inseted_text = '';
            for (let i = 0; i < files.length; i++) {
              const data = upload_files.data[i]!;
              if (data.status === 'fulfilled')
                inseted_text += `\n{{media:${data.value.id}}}`;
              else
                toast.show(
                  `Failed to upload ${files[i]!.name}: ${data.reason}`,
                  'error',
                );
            }

            editor.data.front += inseted_text;
          },
        }),
        textarea({
          class: 'textarea',
          placeholder: 'front',
          value: () => editor.data.front,
          onchange(e) {
            editor.data.front = e.target.value;
          },
        }),
        textarea({
          class: 'textarea',
          placeholder: 'back',
          value: () => editor.data.back,
          onchange(e) {
            editor.data.back = e.target.value;
          },
        }),
        div(
          { class: 'modal-action' },
          button({ class: 'btn', onclick: () => editor.cancel() }, 'Cancel'),
          button({ class: 'btn', onclick: () => editor.ok() }, 'OK'),
        ),
      ),
    );

    const crud = useCRUD({
      R: (query) =>
        api.card.get({ $query: { ...query, deck_id: deck_id.val } }).then(safe),
      async C() {
        if (deck_id.val == -1) throw Error('No decks');
        const template_id = template_crud.items[0]?.id ?? -1;
        if (template_id == -1) throw Error('No templates');

        editor.set({ deck_id: deck_id.val, template_id, front: '', back: '' });
        await editor.show();

        if (editor.data.front && editor.data.back)
          return await api.card.post(editor.data).then(safe);
        throw Error('No content');
      },
      async U(item) {
        editor.set(item);
        await editor.show();
        const card = await api.card[item.id]!.patch(editor.data).then(safe);
        card.deck_id !== deck_id.val && crud.R.fn(); // update current cards
        return card;
      },
      async D(item) {
        await api.card[item.id]!.delete();
      },
    });
    van.derive(() => {
      deck_id.val != -1 && crud.R.fn();
    });

    return div(
      Table({
        model: crud,
        keys: ['id', 'front', 'back', 'state', 'due', 'create_at'],
        rows: {
          id: (v) => v,
          front: (v) => v,
          back: (v) => v,
          state: (v) => State[v],
          due: (v) => unix_timestamp_to_ymd(v / 1e3),
          create_at: unix_timestamp_to_ymd,
        },
        topbar: (btn) =>
          div(
            { class: 'm-4 flex gap-4' },
            // select deck
            list(
              () =>
                select({
                  class: 'select w-1/2',
                  value: () => deck_id.val,
                  onchange(e) {
                    deck_id.val = e.target.value;
                  },
                }),
              deck_crud.items,
              (item) =>
                option({ value: () => item.val.id }, () => item.val.name),
            ),
            // create btn
            btn,
          ),
      }),
      // dialog
      diag,
    );
  },
  media() {
    const media_types: MediaTypes = ['image', 'audio', 'video'];
    const type = van.state<MediaTypes[number]>(media_types[0]);
    const crud = useCRUD({
      R: (query) =>
        api.media.get({ $query: { ...query, type: type.val } }).then(safe),
      C() {
        throw Error('Not Impl');
      },
      U() {
        throw Error('Not Impl');
      },
      async D(item) {
        await api.media[item.id]!.delete();
      },
    });
    van.derive(crud.R.fn);

    const ob = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target as ReturnType<
          (typeof MEDIA_TYPE_COMPS)[keyof typeof MEDIA_TYPE_COMPS]
        >;
        el.src = el.dataset['src']!;
        if (el instanceof HTMLImageElement) {
          el.onload = () => {
            el.style = '';
            el.onload = null;
          };
        } else el.load();
        ob.unobserve(el);
      }
    });

    return div(
      { class: 'flex flex-col' },
      div(
        { class: 'm-4 flex gap-4' },
        select(
          {
            class: 'select w-full',
            value: () => type.val,
            onchange(e) {
              type.val = e.target.value;
            },
          },
          media_types.map((e) => option(e)),
        ),
      ),
      div(
        { class: 'flex-1 overflow-y-auto' },
        div(
          { class: 'w-full text-center', hidden: () => !crud.R.loading },
          'Loading...',
        ),
        list(
          () =>
            div({
              class:
                'columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4 p-4 pt-0',
            }),
          crud.items,
          (item) =>
            div(
              { class: 'break-inside-avoid relative' },
              () => {
                const el = Media(item.val);
                return typeof el === 'string' ? el : (ob.observe(el), el);
              },
              span(
                {
                  class:
                    'absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded',
                },
                () => unix_timestamp_to_ymd(item.val.create_at),
              ),
            ),
        ),
      ),
    );
  },
  study: Study,
};
const route_names = Object.keys(routes);
location.hash ||= route_names[0]!; // first route

const root = div(
  { id: 'app', class: 'h-dvh' },
  div(
    { class: 'dock bg-neutral font-bold' },
    route_names.map((name) =>
      name === 'study'
        ? null
        : button(
            {
              class: () =>
                hash.val === name ? 'dock-active text-primary' : '',
              onclick: () => (location.hash = name),
            },
            name[0]?.toUpperCase() + name.slice(1),
          ),
    ),
  ),
);
van.derive(() => {
  for (const name of route_names) {
    const hidden = !hash.val.startsWith(name);
    let route = routes[name]!;
    if (typeof route === 'function') {
      if (hidden) continue;
      van.add(root, (routes[name] = route = route())); // lazy load
      route.setAttribute('data-route', name);
      route.style.height = 'calc(100dvh - 4rem - env(safe-area-inset-bottom))';
    } else route.hidden = hidden;
  }
});
van.add(
  document.body,
  root,
  list(
    () => div({ class: 'toast z-10' }),
    toast.items,
    (item) => {
      const show = toast.handle(item.val);
      return div(
        {
          class: () =>
            cn(
              `alert alert-${item.val.type} transition-all duration-300`,
              show.val
                ? 'translate-x-0 opacity-100'
                : 'translate-x-5 opacity-0',
            ),
        },
        () => item.val.text,
      );
    },
  ),
);
