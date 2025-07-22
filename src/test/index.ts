import escape from "regexp.escape";
import {
    CancellationToken,
    Position,
    Range,
    TestController,
    TestItem,
    TestMessage,
    TestRun,
    TestRunProfileKind,
    TestRunRequest,
    tests,
    WorkspaceFolder,
} from "vscode";
import { traverseTree } from "../behave/parser";
import { Item, Status } from "../behave/types";
import { LOG } from "../log";

import * as behave from "../behave";

function createItem(controller: TestController, item: Item)
{
    const rtn = controller.createTestItem(item.location.bare, item.name, item.location.full);
    const position = new Position(item.location.line, item.location.line + 1);

    rtn.range = new Range(position, position);

    return rtn;
}

function flatItems(controller: TestController)
{
    const rtn = new Map<string, TestItem>();

    const visit = (item: TestItem) =>
    {
        item.children.forEach(visit);
        rtn.set(item.id, item);
    };
    controller.items.forEach(visit);

    return rtn;
}

function makeTestMessage(item: Item, parent: TestItem, run: TestRun)
{
    const rtn = new TestMessage("");

    if (!("result" in item))
    {
        return rtn;
    }

    if (!item.result)
    {
        return rtn;
    }

    if (!item.result.error_message || item.result.error_message.length === 0)
    {
        return rtn;
    }

    rtn.message = item.result.error_message.at(-1)!;
    run.appendOutput(item.result.error_message.join("\r\n"), undefined, parent);

    const regex = /([^\s]*)\s!=\s(.*)$/;
    const match = rtn.message.match(regex);

    if (match)
    {
        rtn.expectedOutput = match[1];
        rtn.actualOutput = match[2];
    }

    return rtn;
}

async function runHandler(
    controller: TestController,
    workspace: WorkspaceFolder,
    request: TestRunRequest,
    token: CancellationToken,
)
{
    const { include, exclude, profile } = request;

    if (!profile)
    {
        LOG.toastError({ message: "Bad Profile", detail: [profile] });
        return;
    }

    const args: string[] = [];

    if (exclude)
    {
        // TODO: This has not been properly tested
        args.push(...exclude.reduce<string[]>((prev, curr) => [...prev, "-e", escape(curr.id)], []));
    }

    if (include)
    {
        args.push(...include.map(item => item.id));
    }

    const run = await (profile.kind === TestRunProfileKind.Run
        ? behave.run(args, { workspace })
        : behave.debug(args, { workspace }));

    if (run.isErr())
    {
        LOG.toastError({ message: "Could not start run", detail: [run.error] });
        return;
    }

    const { parsed, abort } = run.value;
    const disposable = token.onCancellationRequested(abort);

    const result = await parsed;
    disposable.dispose();

    if (result.isErr())
    {
        LOG.toastError({ message: "Could not parse results", detail: [result.error] });
        return;
    }

    const items = flatItems(controller);
    const testRun = controller.createTestRun(request);

    const visitor = (item: Item) =>
    {
        const status = "status" in item ? item.status : item.result?.status;

        if (!status)
        {
            return;
        }

        const parent = items.get(item.location.bare);

        if (!parent)
        {
            LOG.warn("Could not find parent for item", item, items);
            return;
        }

        const hasResult = "result" in item && item.result;
        const duration = hasResult ? item.result!.duration : undefined;

        switch (status)
        {
            case Status.PASSED:
                testRun.passed(parent, duration);
                break;
            case Status.FAILED:
                const message = makeTestMessage(item, parent, testRun);
                testRun.failed(parent, message, duration);
                break;
            // @ts-expect-error
            default:
                LOG.warn("Unhandled status", status);
            case Status.SKIPPED:
                testRun.skipped(parent);
        }
    };
    traverseTree(result.value, visitor);

    testRun.end();
}

function init(controller: TestController)
{
    const analyze = async (path: string, workspace: WorkspaceFolder, options?: behave.AnalyzeOptions) =>
    {
        const parsed = await behave.analyze(path, workspace, options);

        if (parsed.isErr())
        {
            LOG.toastError({ message: "Could not analyze file", detail: [parsed.error, path, workspace.name] });
            return;
        }

        const visitor = (item: Item, parent?: TestItem) =>
        {
            const rtn = createItem(controller, item);

            if (parent)
            {
                parent.children.add(rtn);
            }

            return rtn;
        };
        traverseTree(parsed.value, visitor).forEach(controller.items.add);
    };

    const createProfiles = (workspace: WorkspaceFolder) =>
    {
        const handler = (request: TestRunRequest, token: CancellationToken) =>
            runHandler(controller, workspace, request, token);

        return [
            controller.createRunProfile(`Run (${workspace.name})`, TestRunProfileKind.Run, handler, true),
            controller.createRunProfile(`Debug (${workspace.name})`, TestRunProfileKind.Debug, handler, false),
        ];
    };

    return { ...controller, analyze, createProfiles };
}

export const controller = init(tests.createTestController("behave", "Behave"));
