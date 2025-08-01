import { debug as debugging, DebugConfiguration, DebugSession, ProcessExecution, Task, TaskGroup, tasks, WorkspaceFolder } from "vscode";
import { fileCache } from "../cache";
import { LOG } from "../log";
import { settings } from "../settings";
import { disposables } from "../utils/disposable";
import { err, fromPromise, Ok, ok, Result } from "../utils/expected";
import { spawn } from "../utils/process";
import { externalPromise } from "../utils/promise";
import { getExecutable } from "../utils/python";
import { Enforce } from "../utils/traits";
import { parse } from "./parser";
import { Tree } from "./types";

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
    FailedToStart,
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
        return parse(previous.value.path, workspace);
    }

    const cache = await fileCache(file, workspace);

    if (cache.isErr())
    {
        return err(cache.error);
    }

    const command = buildCommand(workspace, { dry: true, output: cache.value.path });

    if (command.isErr())
    {
        return err(command.error);
    }

    const { executable, args } = command.value;
    const result = await spawn(executable, args, { cwd: workspace.uri.fsPath });

    if (result.isErr())
    {
        return err(result.error);
    }

    const { status, stdout, stderr } = result.value;

    if (status !== 0)
    {
        LOG.error("Behave failed", stdout, stderr);
        return err(Error.BadStatus);
    }

    return parse(cache.value.path, workspace);
}

export type RunOptions = Pick<CommandOptions, "include">;

export async function run(workspace: WorkspaceFolder, options: RunOptions)
{
    const cache = await fileCache(undefined, workspace);

    if (cache.isErr())
    {
        return err(cache.error);
    }

    const { track, dispose } = disposables();
    track(cache.value.disposable);

    const { path } = cache.value;
    const command = buildCommand(workspace, { ...options, output: path }).orTee(dispose);

    if (command.isErr())
    {
        return err(command.error);
    }

    const { executable, args } = command.value;

    const process = new ProcessExecution(executable, args, { cwd: workspace.uri.fsPath });
    const task = new Task({ type: "behave" }, workspace, "Behave", "behave", process);

    task.source = "$(beaker)";
    task.group = TaskGroup.Test;
    task.presentationOptions = { clear: true, echo: true };

    /*
        This is extremely hacky. The functionality for multiple instances was tracked here:
            * https://github.com/microsoft/vscode/issues/90125

        The actual properties and enum values can be seen here:
            * https://github.com/microsoft/vscode/blob/c7b91f814a23917b86afa95f65dccf292fb3bf91/src/vs/workbench/contrib/tasks/common/tasks.ts#L570
            * https://github.com/microsoft/vscode/blob/c7b91f814a23917b86afa95f65dccf292fb3bf91/src/vs/workbench/contrib/tasks/common/tasks.ts#L578

        However, they do not exist in the @types/vscode package. See: https://github.com/microsoft/vscode-discussions/discussions/2774
    */
    task.runOptions = { instancePolicy: 4, instanceLimit: Number.MAX_SAFE_INTEGER } as any;

    const taskExecution = (await fromPromise(tasks.executeTask(task))).orTee(dispose);

    if (taskExecution.isErr())
    {
        return err(taskExecution.error);
    }

    const { promise, resolve } = externalPromise<Result<Tree, unknown>>();

    track(tasks.onDidEndTaskProcess(async ({ execution }) =>
    {
        // TODO: Investigate parsing failures when spam starting task, it seems output file is disposed before it's being read.

        if (execution !== taskExecution.value)
        {
            return;
        }

        dispose(resolve(await parse(path, workspace)));
    }));

    return ok({ parsed: promise, abort: taskExecution.value.terminate });
}

export async function debug(workspace: WorkspaceFolder, options: RunOptions)
{
    const cache = await fileCache(undefined, workspace, {});

    if (cache.isErr())
    {
        return err(cache.error);
    }

    const { track, dispose } = disposables();
    track(cache.value.disposable);

    const { path } = cache.value;
    const { args } = buildCommand(workspace, { ...options, output: path, skipPython: true }).value;

    const configuration: DebugConfiguration = {
        name: "Behave",

        type: "python",
        module: "behave",
        request: "launch",

        args,
        cwd: workspace.uri.fsPath,
    };

    const { promise: sessionFuture, resolve: resolveSession } = externalPromise<DebugSession>();

    track(debugging.onDidStartDebugSession(session =>
    {
        resolveSession(session);
    }));

    if (!await debugging.startDebugging(workspace, configuration))
    {
        return dispose(err(Error.FailedToStart));
    }

    const debugSession = await sessionFuture;
    const { promise: parsed, resolve: resolveParsed } = externalPromise<Result<Tree, unknown>>();

    track(debugging.onDidTerminateDebugSession(async (session) =>
    {
        if (session !== debugSession)
        {
            return;
        }

        dispose(resolveParsed(await parse(path, workspace)));
    }));

    return ok({ parsed, abort: () => debugging.stopDebugging(debugSession) });
}
