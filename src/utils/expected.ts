import { err, ok } from "neverthrow";
import * as neverthrow from "neverthrow";

export type Ok<T, E = never> = neverthrow.Ok<T, E>;
export type Err<T, E = never> = neverthrow.Err<T, E>;
export type Result<T, E = unknown> = neverthrow.Result<T, E>;

export function fromPromise<T, E = unknown>(promise: Thenable<T>, errorFn: (e: unknown) => E = ((error) => error as E))
{
    return neverthrow.fromPromise(promise, errorFn);
}

export { err, ok };
