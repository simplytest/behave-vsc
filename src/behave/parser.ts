import { readFile } from "fs/promises";
import { err, ok } from "neverthrow";
import { Uri, WorkspaceFolder } from "vscode";
import { fromPromise } from "../utils/neverthrow";
import { DeepReplace } from "../utils/traits";
import { Item, Keyword, Locatable, Tree } from "./types";

type Raw<T> = DeepReplace<T, "location", string>;

function updateProperties<T extends Locatable>(workspace: WorkspaceFolder, item: Raw<T>)
{
    const bare = item.location;
    const delim = bare.lastIndexOf(":");

    // VSCode starts lines at 0, while behave starts at 1
    const line = parseInt(bare.substring(delim + 1)) - 1;

    const file = bare.substring(0, delim);
    const full = Uri.joinPath(workspace.uri, file);

    // Behave reports all locations with lines, this is inconvenient when passing the bare-location to execute the test.
    const skipLine = "keyword" in item && item.keyword === Keyword.FEATURE && line === 0;

    const changes: Partial<Item>[] = [{ location: { file, line, bare: skipLine ? file : bare, full } }];

    if ("name" in item && !item.name)
    {
        changes.push({ name: item.keyword });
    }

    if ("match" in item && item.match)
    {
        changes.push({ match: updateProperties(workspace, item.match) });
    }

    if ("elements" in item)
    {
        changes.push({ elements: item.elements.map(element => updateProperties(workspace, element)) });
    }

    if ("steps" in item)
    {
        changes.push({ steps: item.steps.map(step => updateProperties(workspace, step)) });
    }

    return { ...item, ...changes.reduce((prev, current) => ({ ...prev, ...current }), {}) } as T;
}

export function parse(data: string, workspace: WorkspaceFolder)
{
    return (JSON.parse(data) as Raw<Tree>).map(feature => updateProperties(workspace, feature));
}

export async function parseFile(path: string, workspace: WorkspaceFolder)
{
    const data = await fromPromise(readFile(path, "utf8"));

    if (data.isErr())
    {
        return err(data.error);
    }

    return ok(parse(data.value, workspace));
}

export function traverseTree<T>(tree: Tree, visitor: (node: Item, parent?: T) => T)
{
    const visit = (item: Item, parent?: T) =>
    {
        const rtn = visitor(item, parent);

        if ("elements" in item)
        {
            item.elements.forEach(x => visit(x, rtn));
        }

        if ("steps" in item)
        {
            item.steps.forEach(x => visit(x, rtn));
        }

        return rtn;
    };

    return tree.map(item => visit(item));
}

export function* iterateItems(item: Item | Item[]): Generator<Item>
{
    if ("elements" in item)
    {
        return yield* iterateItems(item.elements);
    }

    if ("steps" in item)
    {
        return yield* iterateItems(item.steps);
    }

    if (!Array.isArray(item))
    {
        return yield item;
    }

    for (const node of item)
    {
        yield* iterateItems(node);
    }
}
