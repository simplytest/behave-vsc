import { execa } from "execa";

interface Options
{
    cwd?: string;
}

export async function spawn(executable: string, args: string[], options?: Options)
{
    const { exitCode, stdout, stderr } = await execa(executable, args, { ...options, reject: false });
    return { status: exitCode, stdout, stderr };
}
