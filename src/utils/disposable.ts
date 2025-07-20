import { Disposable } from "vscode";

export function dispose<T extends Disposable>(disposables: T[])
{
    while (disposables.length > 0)
    {
        const disposable = disposables.pop();
        disposable?.dispose();
    }
}
