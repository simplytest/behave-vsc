import { workspace, WorkspaceFolder } from "vscode";

function init()
{
    const setting = <T>(name: string, defaultValue: T) =>
    {
        return (root?: WorkspaceFolder) =>
        {
            return workspace.getConfiguration("behave", root).get<T>(name, defaultValue);
        };
    };

    return {
        expectedRegex: setting<string[]>("expectedRegex", ["Expected: (.*)[\\s\\S]*but: was (.*)"]),
        allowedFiles: setting("allowedFiles", "**/*.feature"),
        discoverSteps: setting("discoverSteps", false),
        autoDiscover: setting("autoDiscover", false),
        arguments: setting<string[]>("arguments", []),
    };
}

export const settings = init();
