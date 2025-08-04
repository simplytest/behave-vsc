import { WorkspaceFolder } from "vscode";
import { fileCache } from "../cache";
import { LOG } from "../log";
import { settings } from "../settings";
import { err, Ok, ok, Result } from "../utils/expected";
import { spawn } from "../utils/process";
import { getExecutable } from "../utils/python";
import { Enforce } from "../utils/traits";
import { parseFile } from "./parser";

export interface CommandOptions
{
    output?: string;
    include?: string[];

    dry?: boolean;
    capture?: boolean;
    skipPython?: boolean;
}

export interface Command
{
    executable: string;
    args: string[];
}

export function buildCommand(workspace: WorkspaceFolder, options: Enforce<CommandOptions, "skipPython">): Ok<Command>;
export function buildCommand(workspace: WorkspaceFolder, options?: CommandOptions): Result<Command>;

export function buildCommand(workspace: WorkspaceFolder, options?: CommandOptions)
{
    const args: string[] = [];

    if (!options?.skipPython)
    {
        args.push("-m", "behave");
    }

    if (!options?.capture)
    {
        args.push("--no-capture");
    }

    if (options?.output)
    {
        args.push("--outfile", options.output, "--format", "json");
    }

    if (options?.dry)
    {
        args.push("--dry-run", "--show-timings", "--show-source", "--no-junit", "--no-summary");
    } else
    {
        args.push(...settings.arguments(workspace));
    }

    if (options?.include)
    {
        args.push(...options.include);
    }

    const executable = options?.skipPython ? ok("") : getExecutable(workspace);

    if (executable.isErr())
    {
        return err(executable.error);
    }

    LOG.trace(`Command is: ${executable.value} ${args}`);

    return ok({ executable: executable.value, args } satisfies Command);
}

export enum Error
{
    BadStatus,
}

export interface AnalyzeOptions
{
    skipCache?: boolean;
}

export async function analyze(file: string, workspace: WorkspaceFolder, options?: AnalyzeOptions)
{
    const previous = options?.skipCache ? err() : await fileCache(file, workspace, { checkExpired: true });

    if (previous.isOk())
    {
        LOG.debug("Using previous result", file);
        return parseFile(previous.value.path, workspace);
    }

    const cache = await fileCache(file, workspace);

    if (cache.isErr())
    {
        return err(cache.error);
    }

    const command = buildCommand(workspace, { dry: true, output: cache.value.path, include: [file] });

    if (command.isErr())
    {
        return err(command.error);
    }

    const { executable, args } = command.value;
    const { status, stdout, stderr } = await spawn(executable, args, { cwd: workspace.uri.fsPath });

    if (status !== 0)
    {
        LOG.error("Behave failed", stdout, stderr);
        return err(Error.BadStatus);
    }

    return parseFile(cache.value.path, workspace);
}
