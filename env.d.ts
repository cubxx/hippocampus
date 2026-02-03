type MaybeGetter<T> = T | (() => T);
type DataOrError<T> = { data: T; error: null } | { data: null; error: Error };
type ApiResult<T extends (...e: any) => any> = Extract<
  Awaited<ReturnType<T>>,
  { error: null }
>['data'];
