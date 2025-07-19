import { LogLevel, LogOutputChannel, window } from "vscode";

interface ToastParams<T extends string>
{
    message: string;
    actions?: T[];
    detail?: any[];
}

function extend(original: LogOutputChannel)
{
    const unwrap = <T>(value?: T[]) => value || [];
    const concat = (value?: any[]) => unwrap(value).reduce((prev, curr) => [...prev, "\n", curr], value ? ["\n"] : []);

    const toastError = <T extends string>({ message, detail: additional, actions }: ToastParams<T>) =>
    {
        original.error(message, ...concat(additional));
        return window.showErrorMessage(message, ...unwrap(actions));
    };

    const toastInfo = <T extends string>({ message, detail: additional, actions }: ToastParams<T>) =>
    {
        original.info(message, ...concat(additional));
        return window.showInformationMessage(message, ...unwrap(actions));
    };

    original.show();

    return { ...original, toastError, toastInfo };
}

export const LOG = extend(window.createOutputChannel("Behave", { log: true }));
