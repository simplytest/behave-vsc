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
        allowedFiles: setting("allowedFiles", "**/*.feature"),
        autoDiscover: setting("autoDiscover", false),
        arguments: setting<string[]>("arguments", []),
    };
}

export const settings = init();
