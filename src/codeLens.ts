import { CancellationToken, CodeLens, CodeLensProvider, Position, Range, TestRunProfileKind, TextDocument, workspace, WorkspaceFolder } from "vscode";
import { analyze } from "./behave";
import { iterateItems } from "./behave/parser/utils";
import { Keyword, Scenario } from "./behave/types";
import { runtimeCache } from "./cache";
import { commands } from "./commands";
import { settings } from "./settings";

const cacheLoader = runtimeCache.create("codeLens", () => new Map<string, { version: number; lenses: CodeLens[] }>());

function makeCodeLens(line: number, scenarios: Scenario[], workspace: WorkspaceFolder)
{
    const position = new Position(line, line);
    const include = scenarios.map(scenario => scenario.location.bare);

    return [
        new CodeLens(
            new Range(position, position),
            commands.test.command({
                title: "Run Outline",
                arguments: [{ include, kind: TestRunProfileKind.Run }, undefined, undefined, workspace],
            }),
        ),
        new CodeLens(
            new Range(position, position),
            commands.test.command({
                title: "Debug Outline",
                arguments: [{ include, kind: TestRunProfileKind.Debug }, undefined, undefined, workspace],
            }),
        ),
    ];
}

export const codeLensProvider = new class implements CodeLensProvider
{
    async provideCodeLenses(document: TextDocument, _: CancellationToken)
    {
        if (!settings.codeLens())
        {
            return [];
        }

        const { version, fileName } = document;

        const cache = cacheLoader.load();
        const cached = cache.get(fileName);

        if (cached && cached.version >= version)
        {
            return cached.lenses;
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

        const ignore: string[] = [];

        for (const item of iterateItems(result.value))
        {
            if (item.keyword !== Keyword.BACKGROUND)
            {
                continue;
            }

            if (!("steps" in item))
            {
                continue;
            }

            ignore.push(...item.steps.map(step => step.location.bare));
        }

        let previousExample = -Infinity;
        const examples: Scenario[][] = [];

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

            if (line - previousExample > 1)
            {
                examples.push([]);
            }

            previousExample = line;
            examples.at(-1)!.push(item);
        }

        const lenses: CodeLens[] = [];

        for (const scenarios of examples)
        {
            if (scenarios.length === 0)
            {
                continue;
            }

            lenses.push(...makeCodeLens(scenarios[0].location.line - 2, scenarios, root));
        }

        cache.set(fileName, { version, lenses });

        return lenses;
    }
}();
