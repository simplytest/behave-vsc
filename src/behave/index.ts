import { execa } from "execa";
import { err, ok, Result } from "neverthrow";
import { window } from "vscode";
import * as python from "../utils/python";

export enum Error
{
    Unknown,
}

export async function execute(args: string[], cwd: string): Promise<Result<string, Error | python.Error>>
{
    const executable = python.getExecutable();

    if (executable.isErr())
    {
        return err(executable.error);
    }

    const { stdout, stderr, failed } = await execa(executable.value, ["-m", "behave", ...args], { cwd });

    if (failed)
    {
        window.showErrorMessage(`Failed to execute "behave ${args.join(" ")}": ${stderr}`);
        return err(Error.Unknown);
    }

    return ok(stdout);
}
