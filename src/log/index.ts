import { env, LogOutputChannel, Uri, window } from "vscode";

interface ToastParams<T extends string>
{
    message: string;
    actions?: T[];
    detail?: any[];
}

type LoggerFunction = (message: string, ...args: any[]) => void;
type ToastFunction<T extends string> = (message: string, ...items: T[]) => Thenable<T>;

function toastify<T extends string>(original: LoggerFunction, toast: ToastFunction<T>)
{
    const unwrap = <T>(value?: T[]) => value || [];
    const concat = (value?: any[]) => unwrap(value).reduce((prev, curr) => [...prev, "\n", curr], value ? ["\n"] : []);

    return ({ message, detail, actions }: ToastParams<T>) =>
    {
        original(message, ...concat(detail));
        return toast(message, ...unwrap(actions));
    };
}

function init(original: LogOutputChannel)
{
    original.show();

    const panic = async (message: string, ...args: any[]) =>
    {
        original.error(`[Panic] ${message}`, ...args);

        const result = window.showErrorMessage(
            "Panic!",
            { modal: true, detail: "Please check the output window and report an issue" },
            "Report Issue",
        );

        if (await result !== "Report Issue")
        {
            return;
        }

        env.openExternal(Uri.parse("https://github.com/simplytest/behave-vsc/issues"));
    };

    return {
        ...original,
        panic,
        toastError: toastify(original.error, window.showErrorMessage),
        toastInfo: toastify(original.info, window.showInformationMessage),
    };
}

export const LOG = init(window.createOutputChannel("Behave", { log: true }));
