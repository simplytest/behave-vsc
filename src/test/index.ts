import { randomUUID } from "crypto";
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
    TestTag,
    WorkspaceFolder,
} from "vscode";
import { analyze, debug, run, RunOptions } from "../behave";
import { traverseTree } from "../behave/parser/utils";
import { Item, Status } from "../behave/types";
import { LOG } from "../log";
import { settings } from "../settings";
import { disposables } from "../utils/disposable";

// TODO: Come up with clever way to store multiple bare locations in Test-Item (for "run-all" outlines) and also make it discoverable from the final result in the runHandler!

function createTestItem(controller: TestController, item: Item)
{
    const rtn = controller.createTestItem(item.location.bare, item.name, item.location.full);

    const position = new Position(item.location.line, item.location.line + 1);
    const tags: TestTag[] = [];

    if ("tags" in item)
    {
        tags.push(...item.tags.map(tag => new TestTag(tag)));
    }

    rtn.range = new Range(position, position);
    rtn.tags = tags;

    return rtn;
}

function testItems()
{
    const items = new Map<string, TestItem>();

    const visit = (item: TestItem) =>
    {
        item.children.forEach(visit);
        items.set(item.id, item);
    };
    controller.items.forEach(visit);

    return { find: (item: Item) => items.get(item.location.bare) };
}

interface ParsedError
{
    messages: TestMessage[];
    output: string[];
}

function parseError(item: Item): ParsedError | undefined
{
    if (!("result" in item))
    {
        if (settings.discoverSteps())
        {
            return;
        }

        if (!("steps" in item))
        {
            return;
        }

        return item.steps.map(parseError).reduce((prev, result) => ({
            messages: [...prev?.messages ?? [], ...result?.messages ?? []],
            output: [...prev?.output ?? [], ...result?.output ?? []],
        }));
    }

    if (!item.result)
    {
        return;
    }

    const { error_message } = item.result;

    if (!error_message || error_message.length === 0)
    {
        return;
    }

    const whole = error_message.join("\r\n");
    const message = new TestMessage(whole.at(-1)!);

    for (const regex of settings.diffRegex())
    {
        const match = whole.match(regex);

        if (!match)
        {
            continue;
        }

        message.expectedOutput = match[1];
        message.actualOutput = match[2];

        break;
    }

    return { messages: [message], output: [whole] };
}

async function runHandler(_: TestController, workspace: WorkspaceFolder, request: TestRunRequest, token: CancellationToken)
{
    const { profile } = request;

    if (!profile)
    {
        LOG.showError("Bad Profile", request);
        return;
    }

    const options: RunOptions = {
        include: request.include?.map(item => item.id),
    };

    const execution = await (profile.kind === TestRunProfileKind.Run
        ? run(workspace, options)
        : debug(workspace, options));

    if (execution.isErr())
    {
        LOG.showError("Failed to start", execution.error);
        return;
    }

    const { track, dispose } = disposables();
    const { parsed, abort } = execution.value;

    track(token.onCancellationRequested(abort));
    const result = dispose(await parsed);

    if (result.isErr())
    {
        LOG.showError("Failed to parse result", result.error);
        return;
    }

    const testRun = controller.createTestRun(request);
    const { find } = testItems();

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
}

function init(controller: TestController)
{
    const load = async (path: string, workspace: WorkspaceFolder) =>
    {
        const result = await analyze(path, workspace);

        if (result.isErr())
        {
            LOG.showError(`Failed to parse "${path}"`, result.error);
            return;
        }

        const visitor = (item: Item, parent?: TestItem) =>
        {
            if (!settings.discoverSteps(workspace) && "step_type" in item)
            {
                return;
            }

            const rtn = createTestItem(controller, item);
            parent?.children.add(rtn);

            return rtn;
        };

        traverseTree(result.value, visitor).filter(x => !!x).forEach(controller.items.add);
    };

    const registerProfiles = (workspace: WorkspaceFolder) =>
    {
        type ProfileParams = Parameters<typeof controller.createRunProfile>;
        type HandlerParams = Parameters<ProfileParams[2]>;

        const handler = (...params: HandlerParams) => runHandler(controller, workspace, ...params);

        return [
            controller.createRunProfile(`Run (Workspace: ${workspace.name})`, TestRunProfileKind.Run, handler, true),
            controller.createRunProfile(`Debug (Workspace: ${workspace.name})`, TestRunProfileKind.Debug, handler, false),
        ];
    };

    return { ...controller, load, registerProfiles };
}

export const controller = init(tests.createTestController("behave", "Behave"));
