import { fromPromise as make } from "neverthrow";

export function fromPromise<T, E = unknown>(promise: Thenable<T>)
{
    return make(promise, error => error as E);
}
