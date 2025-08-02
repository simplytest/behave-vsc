import { glob, rm } from "fs/promises";
import { minimatch } from "minimatch";
import {
    CancellationToken,
    Command,
    commands as com,
    debug as debugging,
    DebugConfiguration,
    DebugSession,
    ProcessExecution,
    Task,
    TaskGroup,
    tasks,
    TestRunProfileKind,
    TestRunRequest,
    Uri,
    window,
    workspace,
    WorkspaceFolder,
} from "vscode";
import { buildCommand, CommandOptions } from "./behave";
import { parseFile } from "./behave/parser";
import { traverseTree } from "./behave/parser/utils";
import { Item, Status, Tree } from "./behave/types";
import { fileCache, rootCache, runtimeCache } from "./cache";
import { LOG } from "./log";
import { settings } from "./settings";
import { parseError, testController } from "./testController";
import { disposables } from "./utils/disposable";
import { err, fromPromise, ok, Result } from "./utils/expected";
import { externalPromise } from "./utils/promise";
import { RequireOptional } from "./utils/traits";

export enum Error
{
    BadWorkspace,
    FailedToStart,
}

export type RunOptions = Pick<CommandOptions, "include"> & { kind?: TestRunProfileKind };

function defaultWorkspace()
{
    const document = window.activeTextEditor?.document.uri;
    return document ? workspace.getWorkspaceFolder(document) : workspace.workspaceFolders?.[0];
}

function command<Ts extends any[], R>(name: string, raw: (...args: Ts) => R)
{
    return {
        call: (...args: RequireOptional<Ts>) => com.executeCommand<R>(name, ...args),
        register: () => com.registerCommand(name, raw),
        command: (options: Omit<Command, "command"> & Record<"arguments", RequireOptional<Ts>>) => ({ ...options, command: name }),
    };
}

export const commands = {
    run: command("behave.run", async (options?: RunOptions, workspace: WorkspaceFolder | undefined = defaultWorkspace()) =>
    {
        if (!workspace)
        {
            return err(Error.BadWorkspace);
        }

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
        const task = new Task({ type: "process", task: `behave-vsc-${Date.now().toLocaleString()}` }, workspace, "Behave", "behave", process);

        task.group = TaskGroup.Test;
        task.presentationOptions = { clear: true, echo: true };

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

            dispose(resolve(await parseFile(path, workspace)));
        }));

        return ok({ parsed: promise, abort: taskExecution.value.terminate });
    }),
    debug: command("behave.debug", async (options?: RunOptions, workspace: WorkspaceFolder | undefined = defaultWorkspace()) =>
    {
        if (!workspace)
        {
            return err(Error.BadWorkspace);
        }

        const cache = await fileCache(undefined, workspace);

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

            dispose(resolveParsed(await parseFile(path, workspace)));
        }));

        return ok({ parsed, abort: () => debugging.stopDebugging(debugSession) });
    }),
    test: command(
        "behave.test",
        async (
            options?: RunOptions,
            request?: TestRunRequest | undefined,
            token?: CancellationToken | undefined,
            workspace: WorkspaceFolder | undefined = defaultWorkspace(),
        ) =>
        {
            const execution = await (options?.kind === TestRunProfileKind.Debug
                ? commands.debug.call(options, workspace)
                : commands.run.call(options, workspace));

            if (execution.isErr())
            {
                LOG.showError("Failed to start", execution.error);
                return;
            }

            const { track, dispose } = disposables();
            const { parsed, abort } = execution.value;

            track(token?.onCancellationRequested(abort));
            const result = dispose(await parsed);

            if (result.isErr())
            {
                LOG.showError("Failed to parse result", result.error);
                return;
            }

            const testRun = testController.createTestRun(request ?? { include: [], exclude: [], preserveFocus: false, profile: undefined });
            const { find } = testController.itemLocator();

            const visitor = (item: Item) =>
            {
                const status = "status" in item ? item.status : item.result?.status;

                if (!status)
                {
                    return;
                }

                const testItem = find(item);

                if (!testItem)
                {
                    return;
                }

                const hasResult = "result" in item && item.result;
                const duration = hasResult ? item.result!.duration : undefined;

                switch (status)
                {
                    case Status.PASSED:
                        testRun.passed(testItem, duration);
                        break;
                    case Status.FAILED:
                        const { messages, output } = parseError(item) ?? { messages: [], output: [] };
                        testRun.failed(testItem, messages, duration);
                        output.forEach(message => testRun.appendOutput(message, undefined, testItem));
                        break;
                    // @ts-expect-error
                    default:
                        LOG.warn("Unhandled status", status);
                    case Status.SKIPPED:
                        testRun.skipped(testItem);
                        break;
                }
            };

            traverseTree(result.value, visitor);

            testRun.end();
        },
    ),
    analyze: command("behave.analyze", async (path: Uri | undefined = window.activeTextEditor?.document.uri, skipCheck?: boolean) =>
    {
        if (!path)
        {
            return;
        }

        const { fsPath } = path;

        if (!skipCheck && !minimatch(fsPath, settings.allowedFiles()))
        {
            return;
        }

        const root = workspace.getWorkspaceFolder(path);

        if (!root)
        {
            return;
        }

        testController.loadFile(fsPath, root);
    }),
    discover: command("behave.discover", async (workspaces: readonly WorkspaceFolder[] | undefined = workspace.workspaceFolders) =>
    {
        if (!workspaces)
        {
            return;
        }

        for (const workspace of workspaces)
        {
            for await (const file of glob(settings.allowedFiles(), { cwd: workspace.uri.fsPath }))
            {
                testController.loadFile(file, workspace);
            }

            testController.registerProfiles(workspace);
        }
    }),
    clearCache: command("behave.clear", async () =>
    {
        const root = await rootCache();

        if (root.isOk())
        {
            await fromPromise(rm(root.value, { recursive: true, force: true }));
        }

        [...testController.items].map(item => item[0]).forEach(testController.items.delete);

        runtimeCache.clear();
    }),
};
