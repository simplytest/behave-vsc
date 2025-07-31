import { err, ok, Result } from "neverthrow";
import {
    debug as debugging,
    DebugConfiguration,
    DebugSession,
    ProcessExecution,
    Task,
    tasks,
    WorkspaceFolder,
} from "vscode";
import { fileCache } from "../cache";
import { LOG } from "../log";
import { settings } from "../settings";
import { disposables } from "../utils/disposable";
import { fromPromise } from "../utils/neverthrow";
import { spawn } from "../utils/process";
import { externalPromise } from "../utils/promise";
import { getExecutable } from "../utils/python";
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

    return ok({ executable: executable.value, args });
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

    const { status } = result.value;

    if (status !== 0)
    {
        return err(Error.BadStatus);
    }

    return parse(cache.value.path, workspace);
}

export type RunOptions = Pick<CommandOptions, "include">;

export async function run(workspace: WorkspaceFolder, options: RunOptions)
{
    const cache = await fileCache(undefined, workspace, {});

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
    const task = new Task({ type: "behave" }, workspace, "Behave", "Behave", process);

    const taskExecution = (await fromPromise(tasks.executeTask(task))).orTee(dispose);

    if (taskExecution.isErr())
    {
        return err(taskExecution.error);
    }

    const { promise, resolve } = externalPromise<Result<Tree, unknown>>();

    track(tasks.onDidEndTaskProcess(async ({ execution }) =>
    {
        if (execution !== taskExecution.value)
        {
            return;
        }

        dispose(resolve(await parse(path, workspace)));
    }));

    return { result: promise, abort: taskExecution.value.terminate };
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
    const command = buildCommand(workspace, { ...options, output: path, skipPython: true }).orTee(dispose);

    if (command.isErr())
    {
        return err(command.error);
    }

    const { args } = command.value;

    const configuration: DebugConfiguration = {
        name: "Behave",

        type: "python",
        module: "behave",
        request: "Launch",

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

    return { parsed, abort: () => debugging.stopDebugging(debugSession) };
}
