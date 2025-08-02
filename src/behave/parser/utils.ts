import { Item, Tree } from "../types";

export function traverseTree<T>(tree: Tree, visitor: (node: Item, parent?: T) => T | undefined)
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
        yield* iterateItems(item.elements);
    }

    if ("steps" in item)
    {
        yield* iterateItems(item.steps);
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
