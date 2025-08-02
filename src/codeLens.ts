import { CancellationToken, CodeLens, CodeLensProvider, Position, Range, TestRunProfileKind, TextDocument, workspace } from "vscode";
import { analyze } from "./behave";
import { iterateItems } from "./behave/parser/utils";
import { Keyword, Scenario } from "./behave/types";
import { runtimeCache } from "./cache";
import { commands } from "./commands";
import { settings } from "./settings";

const cacheLoader = runtimeCache.create("codeLens", () => new Map<string, CodeLens[]>());

export const codeLensProvider = new class implements CodeLensProvider
{
    async provideCodeLenses(document: TextDocument, _: CancellationToken)
    {
        if (!settings.codeLens())
        {
            return [];
        }

        const { fileName } = document;
        const cache = cacheLoader.load();

        if (cache.has(fileName))
        {
            return cache.get(fileName);
        } else
        {
            cache.set(fileName, []);
        }

        const root = workspace.getWorkspaceFolder(document.uri);

        if (!root)
        {
            return [];
        }

        const result = await analyze(document.fileName, root);

        if (result.isErr())
        {
            return [];
        }

        let previous = -Infinity;
        const outlines: Scenario[][] = [];

        for (const item of iterateItems(result.value))
        {
            if (item.keyword !== Keyword.OUTLINE)
            {
                continue;
            }

            if (!("steps" in item))
            {
                continue;
            }

            const { line } = item.location;

            if (line - previous > 1)
            {
                outlines.push([]);
            }

            previous = line;
            outlines.at(-1)!.push(item);
        }

        const rtn = cache.get(fileName)!;

        for (const scenarios of outlines)
        {
            if (scenarios.length === 0)
            {
                continue;
            }

            const location = scenarios[0].location;
            const position = new Position(location.line - 2, location.line - 2);

            rtn.push(
                new CodeLens(
                    new Range(position, position),
                    commands.test.command({
                        title: "Run Outline",
                        arguments: [
                            { include: scenarios.map(scenario => scenario.location.bare), kind: TestRunProfileKind.Run },
                            undefined,
                            undefined,
                            root,
                        ],
                    }),
                ),
                new CodeLens(
                    new Range(position, position),
                    commands.test.command({
                        title: "Debug Outline",
                        arguments: [
                            { include: scenarios.map(scenario => scenario.location.bare), kind: TestRunProfileKind.Debug },
                            undefined,
                            undefined,
                            root,
                        ],
                    }),
                ),
            );
        }

        return rtn;
    }
}();
