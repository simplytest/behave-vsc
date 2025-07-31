import { workspace, WorkspaceFolder } from "vscode";

function setting<T>(name: string, fallback: T)
{
    return (root?: WorkspaceFolder) => workspace.getConfiguration("behave", root).get<T>(name, fallback);
}

export const settings = {
    arguments: setting<string[]>("arguments", []),
    allowedFiles: setting<string>("allowedFiles", "**/*.feature"),
    discoverSteps: setting<boolean>("discoverSteps", false),
    autoDiscover: setting<boolean>("autoDiscover", true),
    diffRegex: setting<string[]>("diffRegex", ["Expected: (.*)[\\s\\S]*but: was (.*)"]),
};
