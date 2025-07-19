import { Item } from "../behave/types";

export function traverseTree<T>(item: Item, visitor: (node: Item, parent?: T) => T, parent?: T)
{
    const rtn = visitor(item, parent);

    if ("elements" in item)
    {
        item.elements.forEach(x => traverseTree(x, visitor, rtn));
    }

    if ("steps" in item)
    {
        item.steps.forEach(x => traverseTree(x, visitor, rtn));
    }

    return rtn;
}
