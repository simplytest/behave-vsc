import { err, ok, Result } from "neverthrow";
import { debug as debugging, DebugConfiguration, DebugSession, Disposable, Uri, WorkspaceFolder } from "vscode";
import { cachedTempFile } from "../cache";
import { LOG } from "../log";
import { dispose } from "../utils/disposable";
import { parseFile } from "./parser";
import { Feature } from "./types";

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

function makeArguments(args: string[], output: string)
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
    ];
}

export interface ExecutionOptions
{
    workspace: WorkspaceFolder;
    name?: string;
}

export async function run(args: string[], { workspace, name }: ExecutionOptions)
{
    const temp = await cachedTempFile(workspace, name);

    if (temp.isErr())
    {
        return err(temp.error);
    }

    const spawned = spawn(makeArguments(args, temp.value), workspace);

    if (spawned.isErr())
    {
        return err(spawned.error);
    }

    const { result, abort } = spawned.value;

    const parsed = new Promise<Result<Feature[], unknown>>(resolve =>
        result.then(async () => resolve(await parseFile(temp.value, workspace)))
    );

    return ok({ parsed, abort });
}

export enum Error
{
    FailedToStartDebugger,
}

export async function debug(args: string[], { workspace, name }: ExecutionOptions)
{
    const temp = await cachedTempFile(workspace, name);

    if (temp.isErr())
    {
        return err(temp.error);
    }

    const config: DebugConfiguration = {
        name: "Behave",

        request: "launch",
        type: "python",

        module: "behave",
        args: makeArguments(args, temp.value),
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

    let resolveParsed = (_: Result<Feature[], unknown>) =>
    {
        LOG.panic("Results were resolved before promise was created");
    };
    const parsed = new Promise<Result<Feature[], unknown>>(resolve => resolveParsed = resolve);

    debugging.onDidTerminateDebugSession(
        async (terminated) =>
        {
            if (terminated !== session)
            {
                return;
            }

            resolveParsed(await parseFile(temp.value, workspace));
            dispose(disposables);
        },
        undefined,
        disposables,
    );

    const abort = () => debugging.stopDebugging(session);

    return ok({ abort, parsed });
}

export async function analyze(file: Uri, workspace: WorkspaceFolder)
{
    const { fsPath } = file;

    if (!fsPath.endsWith(".feature"))
    {
        return ok([]);
    }

    const spawned = await run(["--dry-run", fsPath], { workspace, name: fsPath });

    if (spawned.isErr())
    {
        return err(spawned.error);
    }

    const parsed = await spawned.value.parsed;

    if (parsed.isErr())
    {
        return err(parsed.error);
    }

    return ok(parsed.value);
}
