type MaybeGetter<T> = T | (() => T);
type ApiResult<T extends (...e: any) => any> = Extract<
  Awaited<ReturnType<T>>,
  { error: null }
>['data'];
