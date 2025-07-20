import { execa } from "execa";
import { err, ok, Result as Res } from "neverthrow";

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

export function spawn(executable: string, args: string[], options?: Options)
{
    const { signal, abort } = new AbortController();
    const process = execa(executable, args, { ...options, reject: false, cancelSignal: signal });

    const result = new Promise<Res<Result, Error>>(async (resolve) =>
    {
        const { exitCode, stdout, stderr } = await process;

        if (!exitCode)
        {
            return resolve(err(Error.FailedToStart));
        }

        return resolve(ok({ status: exitCode, stdout, stderr } as Result));
    });

    return { result, abort };
}
