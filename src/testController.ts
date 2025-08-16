import {
    CancellationToken,
    Position,
    Range,
    TestController,
    TestItem,
    TestMessage,
    TestRunProfileKind,
    TestRunRequest,
    tests,
    TestTag,
    WorkspaceFolder,
} from "vscode";
import { analyze } from "./behave";
import { traverseTree } from "./behave/parser/utils";
import { Item, Keyword, Status, Tree } from "./behave/types";
import { commands } from "./commands";
import { LOG } from "./log";
import { settings } from "./settings";

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

function itemLocator(controller: TestController)
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

export function parseError(item: Item): ParsedError | undefined
{
    const hasSteps = "steps" in item;
    const hasResults = "result" in item;

    if (!hasResults && !hasSteps)
    {
        return;
    } else if (hasSteps)
    {
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
    const message = new TestMessage(whole);

    for (const regex of settings.diffRegex())
    {
        const match = new RegExp(regex).exec(whole);

        if (!match || !match.groups)
        {
            continue;
        }

        message.expectedOutput = match.groups["expected"];
        message.actualOutput = match.groups["actual"];

        break;
    }

    return { messages: [message], output: [whole] };
}

function init(controller: TestController)
{
    const loadFile = async (path: string, workspace: WorkspaceFolder) =>
    {
        const result = await analyze(path, workspace);

        if (result.isErr())
        {
            LOG.showError(`Failed to parse "${path}"`, result.error);
            return;
        }

        const visitor = (item: Item, parent?: TestItem) =>
        {
            if (item.keyword === Keyword.BACKGROUND)
            {
                return;
            }

            if ("step_type" in item)
            {
                return;
            }

            const rtn = createTestItem(controller, item);
            parent?.children.add(rtn);

            return rtn;
        };

        traverseTree(result.value, visitor).filter(x => !!x).forEach(controller.items.add);
    };

    const unloadFile = async (path: string) =>
    {
        for (const [id, item] of controller.items)
        {
            if (!item.uri?.fsPath.startsWith(path))
            {
                continue;
            }

            controller.items.delete(id);
        }
    };

    const dummyRequest: TestRunRequest = { include: [], exclude: [], preserveFocus: false, profile: undefined };

    const createRun = (tree: Tree, request?: TestRunRequest) =>
    {
        const testRun = controller.createTestRun(request ?? dummyRequest);

        const { find } = itemLocator(controller);

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

            const duration = "result" in item ? item.result?.duration : undefined;

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

        traverseTree(tree, visitor);

        testRun.end();
    };

    const registerProfiles = (workspace: WorkspaceFolder) =>
    {
        const handler = async (request: TestRunRequest, token: CancellationToken) =>
            await commands.test.call({ include: request.include?.map(x => x.id), kind: request.profile?.kind }, request, token, workspace);

        return [
            controller.createRunProfile(`Run (Workspace: ${workspace.name})`, TestRunProfileKind.Run, handler, true),
            controller.createRunProfile(`Debug (Workspace: ${workspace.name})`, TestRunProfileKind.Debug, handler, false),
        ];
    };

    return { ...controller, loadFile, unloadFile, createRun, registerProfiles };
}

export const testController = init(tests.createTestController("behave", "Behave"));
