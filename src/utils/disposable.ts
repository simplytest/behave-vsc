import { Disposable } from "vscode";

export function dispose<T extends Disposable>(disposables: T[])
{
    while (disposables.length > 0)
    {
        disposables.pop()?.dispose();
    }
}

export function disposables()
{
    const disposables: Disposable[] = [];

    return {
        track: <T extends Disposable>(value?: T) => value && disposables.push(value),
        dispose: <T extends [...any[]]>(...params: T): T extends [infer U] ? U : T =>
        {
            dispose(disposables);
            return params.length === 1 ? params[0] : params as any;
        },
    };
}
