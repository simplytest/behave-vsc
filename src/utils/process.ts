import { execa } from "execa";
import { err, ok } from "./expected";

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
    const { exitCode, stdout, stderr, failed } = await execa(executable, args, { ...options, reject: false });

    if (failed)
    {
        return err(Error.FailedToStart);
    }

    return ok({ status: exitCode, stdout, stderr } as Result);
}
