import { PythonExtension } from "@vscode/python-extension";
import { ExtensionContext, languages, window, workspace, WorkspaceFolder } from "vscode";
import { definitionProvider } from "./codeDefinition";
import { codeLensProvider } from "./codeLens";
import { commands } from "./commands";
import { LOG } from "./log";
import { settings } from "./settings";
import { testController } from "./testController";

export async function activate(context: ExtensionContext)
{
    LOG.info("Extension activated");

    for (const command of Object.values(commands))
    {
        context.subscriptions.push(command.register());
    }

    context.subscriptions.push(
        languages.registerCodeLensProvider({ scheme: "file", language: "feature", pattern: settings.allowedFiles() }, codeLensProvider),
        languages.registerDefinitionProvider({ scheme: "file", language: "feature", pattern: settings.allowedFiles() }, definitionProvider),
    );

    const python = await PythonExtension.api();
    await python.ready;

    const load = (folders?: readonly WorkspaceFolder[]) => settings.autoDiscover() ? commands.discover.call(folders) : commands.analyze.call();

    load();

    context.subscriptions.push(
        python.environments.onDidChangeActiveEnvironmentPath(({ resource }) => load(resource && [resource])),
    );

    context.subscriptions.push(
        window.onDidChangeActiveTextEditor(e => commands.analyze.call(e?.document.uri)),
    );

    context.subscriptions.push(
        workspace.onDidSaveTextDocument(({ uri }) => commands.analyze.call(uri)),
        workspace.onDidDeleteFiles(({ files }) => files.forEach(({ fsPath }) => testController.unloadFile(fsPath))),
    );

    // TODO: Handle workspace-deletion

    context.subscriptions.push(
        workspace.onDidChangeWorkspaceFolders(({ added }) => commands.discover.call(added)),
    );
}

export function deactivate()
{}
