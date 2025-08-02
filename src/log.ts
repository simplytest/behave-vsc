import { env, LogOutputChannel, Uri, window } from "vscode";

function init(log: LogOutputChannel)
{
    log.show();

    const panic = async (message: string, ...args: any[]) =>
    {
        log.error(`[Panic] ${message}`, ...args);

        const result = window.showErrorMessage(
            "Panic!",
            { modal: true, detail: "Please check the output window and report an issue" },
            "Report Issue",
        );

        if (await result !== "Report Issue")
        {
            return;
        }

        log.show();
        env.openExternal(Uri.parse("https://github.com/simplytest/behave-vsc/issues"));
    };

    const showInfo = (message: string, ...params: any[]) =>
    {
        log.info(message, ...params);
        window.showInformationMessage(message);
    };

    const showError = async (message: string, ...params: any[]) =>
    {
        log.error(message, ...params);

        if (await window.showErrorMessage(message, "Open Log") !== "Open Log")
        {
            return;
        }

        log.show();
    };

    return { ...log, panic, showInfo, showError };
}

export const LOG = init(window.createOutputChannel("Behave", { log: true }));
