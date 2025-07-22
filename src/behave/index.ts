import { err, ok, Result } from "neverthrow";
import { debug as debugging, DebugConfiguration, DebugSession, Disposable, WorkspaceFolder } from "vscode";
import { cachedTempFile, withPrevious } from "../cache";
import { LOG } from "../log";
import { settings } from "../settings";
import { dispose } from "../utils/disposable";
import { parseFile } from "./parser";
import { Tree } from "./types";

import * as utils from "../utils/process";
import * as python from "../utils/python";

export function spawn(args: string[], workspace: WorkspaceFolder)
{
    const executable = python.getExecutable(workspace);

    if (executable.isErr())
    {
        return err(executable.error);
    }

    return ok(utils.spawn(executable.value, ["-m", "behave", ...args], { cwd: workspace.uri.fsPath }));
}

function makeArguments(args: string[], root: WorkspaceFolder, output: string)
{
    return [
        "--show-timings",
        "--show-source",
        "--quiet",
        "--format",
        "json",
        "--no-junit",
        "--no-summary",
        "--outfile",
        output,
        ...args,
        ...settings.arguments(root),
    ];
}

export interface ExecutionOptions
{
    workspace: WorkspaceFolder;
    path?: string;
}

export async function run(args: string[], { workspace, path }: ExecutionOptions)
{
    const output = await cachedTempFile(workspace, path, { invalidate: true });

    if (output.isErr())
    {
        return err(output.error);
    }

    const spawned = spawn(makeArguments(args, workspace, output.value), workspace);

    if (spawned.isErr())
    {
        return err(spawned.error);
    }

    const { result, abort } = spawned.value;

    const parsed = new Promise<Result<Tree, unknown>>(resolve =>
        result.then(async () => resolve(await parseFile(output.value, workspace)))
    );

    return ok({ result, parsed, abort });
}

export enum Error
{
    FailedToStartDebugger,
}

export async function debug(args: string[], { workspace, path }: ExecutionOptions)
{
    const output = await cachedTempFile(workspace, path, { invalidate: true });

    if (output.isErr())
    {
        return err(output.error);
    }

    const config: DebugConfiguration = {
        name: "Behave",

        request: "launch",
        type: "python",

        module: "behave",
        args: makeArguments(args, workspace, output.value),
        cwd: workspace.uri.fsPath,
    };

    const disposables: Disposable[] = [];

    let resolveSession = (_: DebugSession) =>
    {
        LOG.panic("Session was resolved before promise was created");
    };
    const sessionFuture = new Promise<DebugSession>(resolve => resolveSession = resolve);

    debugging.onDidStartDebugSession(
        async (session) =>
        {
            resolveSession(session);
            dispose(disposables);
        },
        undefined,
        disposables,
    );

    if (!await debugging.startDebugging(workspace, config))
    {
        LOG.toastError({ message: "Failed to start debugging" });
        return err(Error.FailedToStartDebugger);
    }

    const session = await sessionFuture;

    let resolveParsed = (_: Result<Tree, unknown>) =>
    {
        LOG.panic("Results were resolved before promise was created");
    };
    const parsed = new Promise<Result<Tree, unknown>>(resolve => resolveParsed = resolve);

    debugging.onDidTerminateDebugSession(
        async (terminated) =>
        {
            if (terminated !== session)
            {
                return;
            }

            resolveParsed(await parseFile(output.value, workspace));
            dispose(disposables);
        },
        undefined,
        disposables,
    );

    const abort = () => debugging.stopDebugging(session);

    return ok({ abort, parsed });
}

export interface AnalyzeOptions
{
    skipCache?: boolean;
}

export async function analyze(path: string, workspace: WorkspaceFolder, options?: AnalyzeOptions)
{
    const previous = options?.skipCache ? err() : await withPrevious(path, workspace, parseFile);

    if (previous.isOk())
    {
        LOG.debug("Reusing previous result", path, workspace.name);
        return ok(previous.value);
    }

    const spawned = await run(["--dry-run", path], { workspace, path });

    if (spawned.isErr())
    {
        return err(spawned.error);
    }

    const parsed = await spawned.value.parsed;
    const result = await spawned.value.result;

    if (parsed.isErr() && result.isOk())
    {
        return err(result.value);
    } else if (parsed.isErr())
    {
        return err(parsed.error);
    }

    return ok(parsed.value);
}
