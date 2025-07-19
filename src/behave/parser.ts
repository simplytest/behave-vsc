import { err, ok } from "neverthrow";
import { Uri, WorkspaceFolder } from "vscode";
import { invoke } from ".";
import { DeepReplace } from "../utils/traits";
import { Feature, Item, Keyword } from "./types";

type Raw<T> = DeepReplace<T, "location", string>;

function updateLocation<T extends Item>(item: Raw<T>, workspace: WorkspaceFolder)
{
    const bare = item.location;
    const delim = bare.lastIndexOf(":");

    const file = bare.substring(0, delim);
    const line = parseInt(bare.substring(delim + 1));
    const full = Uri.joinPath(workspace.uri, file);

    // Behave reports a feature as starting in line 1 ("...:1") which is nice for
    // figuring out the line here, however, it breaks runs when passing this to behave, as it will only execute the first scenario.

    const skipLine = item.keyword === Keyword.FEATURE && line === 1;

    const changes: Partial<Item>[] = [{ location: { file, line, bare: skipLine ? file : bare, full } }];

    if (!item.name)
    {
        changes.push({ name: item.keyword });
    }

    if ("elements" in item)
    {
        changes.push({ elements: item.elements.map(element => updateLocation(element, workspace)) });
    }

    if ("steps" in item)
    {
        changes.push({ steps: item.steps.map(step => updateLocation(step, workspace)) });
    }

    return { ...item, ...changes.reduce((prev, current) => ({ ...prev, ...current }), {}) } as T;
}

export function parse(data: string, workspace: WorkspaceFolder)
{
    return (JSON.parse(data) as Raw<Feature[]>).map(feature => updateLocation(feature, workspace));
}

export enum Error
{
    NotFeature,
}

export async function parseFile(path: string, workspace: WorkspaceFolder)
{
    if (!path.endsWith(".feature"))
    {
        return err(Error.NotFeature);
    }

    const data = await invoke(["--dry-run", "--no-junit", "--no-summary", "--quiet", "--format=json", path], workspace);

    if (data.isErr())
    {
        return err(data.error);
    }

    return ok(parse(data.value, workspace));
}
