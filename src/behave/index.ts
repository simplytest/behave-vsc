import { execa } from "execa";
import { err, ok, Result } from "neverthrow";
import { window, workspace } from "vscode";
import * as python from "../utils/python";

export enum Error
{
    Unknown,
}

export interface Options
{
    cwd?: string;
}

export async function execute(args: string[], options: Options = {}): Promise<Result<string, Error | python.Error>>
{
    const executable = python.getExecutable();

    if (executable.isErr())
    {
        return err(executable.error);
    }

    if (!options.cwd)
    {
        options.cwd = workspace.workspaceFolders?.[0].uri.fsPath;
    }

    const { stdout, stderr, failed } = await execa(executable.value, ["-m", "behave", ...args], options);

    if (failed)
    {
        window.showErrorMessage(`Failed to execute "behave ${args.join(" ")}": ${stderr}`);
        return err(Error.Unknown);
    }

    return ok(stdout);
}
