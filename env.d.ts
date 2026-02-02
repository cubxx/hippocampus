/// <reference types='temporal-spec/global' />

type MaybeGetter<T> = T | (() => T);
type DataOrError<T> = { data: T; error: null } | { data: null; error: Error };
type ApiResult<T extends (...e: any) => any> = Extract<
  Awaited<ReturnType<T>>,
  { error: null }
>['data'];

type TableQuery = { qs: number; qn: number };
type CardEditable = {
  deck_id: number;
  template_id: number;
  front: string;
  back: string;
};
type LogLevel = 'info' | 'warning' | 'error' | 'success';
