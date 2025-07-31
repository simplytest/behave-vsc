import { LOG } from "../log";

export function externalPromise<T>()
{
    let resolvePromise = (_: T | PromiseLike<T>) =>
    {
        LOG.panic("Resolve called before promise was created");
    };

    return { promise: new Promise<T>(resolve => resolvePromise = resolve), resolve: resolvePromise };
}
