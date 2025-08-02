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
import { Item } from "./behave/types";
import { runtimeCache } from "./cache";
import { commands } from "./commands";
import { LOG } from "./log";
import { settings } from "./settings";

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
    const message = new TestMessage(error_message.at(-1)!);

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
    const parsedCacheLoader = runtimeCache.create("testExplorer", () => new Set<string>());

    const createTestItem = (item: Item) =>
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
    };

    const loadFile = async (path: string, workspace: WorkspaceFolder) =>
    {
        const parsedCache = parsedCacheLoader.load();

        if (parsedCache.has(path))
        {
            LOG.debug("Skipping reevaluation", path);
            return;
        }

        const result = await analyze(path, workspace);

        if (result.isErr())
        {
            LOG.showError(`Failed to parse "${path}"`, result.error);
            return;
        }

        const visitor = (item: Item, parent?: TestItem) =>
        {
            if ("step_type" in item)
            {
                return;
            }

            const rtn = createTestItem(item);
            parent?.children.add(rtn);

            return rtn;
        };

        traverseTree(result.value, visitor).filter(x => !!x).forEach(controller.items.add);
        parsedCache.add(path);
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

    const itemLocator = () =>
    {
        const items = new Map<string, TestItem>();

        const visit = (item: TestItem) =>
        {
            item.children.forEach(visit);
            items.set(item.id, item);
        };
        controller.items.forEach(visit);

        return { find: (item: Item) => items.get(item.location.bare) };
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

    return { ...controller, createTestItem, loadFile, unloadFile, itemLocator, registerProfiles };
}

export const testController = init(tests.createTestController("behave", "Behave"));
