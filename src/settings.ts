import { workspace, WorkspaceFolder } from "vscode";

function setting<T>(name: string)
{
    return (root?: WorkspaceFolder) => workspace.getConfiguration("behave", root).get<T>(name)!;
}

export const settings = {
    arguments: setting<string[]>("arguments"),
    autoDiscover: setting<boolean>("autoDiscover"),
    diffRegex: setting<string[]>("diffRegex"),
    allowedFiles: setting<string>("allowedFiles"),
    codeLens: setting<boolean>("codeLens"),
};
