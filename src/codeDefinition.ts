import { DefinitionProvider, Location, Position, workspace } from "vscode";
import { analyze } from "./behave";
import { iterateItems } from "./behave/parser/utils";

export const definitionProvider: DefinitionProvider = {
    async provideDefinition({ fileName, uri }, { line }, _token)
    {
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

        return new Location(location.full, new Position(location.line, location.line + 1));
    },
};
