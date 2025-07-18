import { BehaveItem, Feature } from "./types";
import { DeepReplace } from "../utils/traits";

type Raw<T> = DeepReplace<T, "location", string>;

function updateLocation<T extends BehaveItem>(item: Raw<T>): T
{
    const location = item.location;
    const delim = location.lastIndexOf(":");

    const file = location.substring(0, delim);
    const line = location.substring(delim + 1);

    const changes: Partial<BehaveItem>[] = [{ location: { file, line: parseInt(line), path: location } }];

    if ("elements" in item)
    {
        changes.push({ elements: item.elements.map(updateLocation) });
    }

    if ("steps" in item)
    {
        changes.push({ steps: item.steps.map(updateLocation) });
    }

    return { ...item, ...changes.reduce((prev, current) => ({ ...prev, ...current }), {}) } as T;
}

export function parse(data: string): Feature[]
{
    return (JSON.parse(data) as Raw<Feature[]>).map(updateLocation);
}
