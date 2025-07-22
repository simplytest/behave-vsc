import { fromPromise as make } from "neverthrow";

export function fromPromise<T, E = unknown>(promise: Promise<T>)
{
    return make(promise, error => error as E);
}
