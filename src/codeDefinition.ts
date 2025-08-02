import { Definition, DefinitionProvider, Location, Position, workspace } from "vscode";
import { analyze } from "./behave";
import { iterateItems } from "./behave/parser/utils";
import { runtimeCache } from "./cache";

const cacheLoader = runtimeCache.create(
    "codeDefinition",
    () => new Map<{ path: string; line: number }, { version: number; definition: Definition }>(),
);

export const definitionProvider: DefinitionProvider = {
    async provideDefinition({ uri, version, fileName }, { line }, _)
    {
        const cache = cacheLoader.load();

        const id = { path: fileName, line };
        const cached = cache.get(id);

        if (cached && cached.version >= version)
        {
            return cached.definition;
        }

        const root = workspace.getWorkspaceFolder(uri);

        if (!root)
        {
            return;
        }

        const parsed = await analyze(fileName, root);

        if (parsed.isErr())
        {
            return;
        }

        const steps = [...iterateItems(parsed.value)].filter(x => "step_type" in x);
        const step = steps.find(x => x.location.line === line);

        if (!step?.match)
        {
            return;
        }

        const { location } = step.match;

        const definition = new Location(location.full, new Position(location.line, location.line + 1));
        cache.set(id, { version, definition });

        return definition;
    },
};
