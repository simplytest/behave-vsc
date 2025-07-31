import { execa } from "execa";
import { err, ok } from "neverthrow";

export enum Error
{
    FailedToStart,
}

interface Result
{
    stdout: string;
    stderr: string;
    status: number;
}

interface Options
{
    cwd?: string;
}

export async function spawn(executable: string, args: string[], options?: Options)
{
    const { exitCode, stdout, stderr } = await execa(executable, args, { ...options, reject: false });

    if (!exitCode)
    {
        return err(Error.FailedToStart);
    }

    return ok({ status: exitCode, stdout, stderr } as Result);
}
