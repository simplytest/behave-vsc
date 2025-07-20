import { ExtensionContext, TextDocument, window, workspace, WorkspaceFolder } from "vscode";
import { LOG } from "./log";
import { controller } from "./test";

function onFile(document?: TextDocument)
{
    if (!document)
    {
        return;
    }

    const { fileName, uri } = document;
    const root = workspace.getWorkspaceFolder(uri);

    LOG.trace("Discovered", fileName, root);

    if (!root)
    {
        return;
    }

    controller.analyze(uri, root);
}

function onWorkspace(workspace?: WorkspaceFolder)
{
    if (!workspace)
    {
        return;
    }

    controller.createProfiles(workspace);
}

export function activate(context: ExtensionContext)
{
    LOG.info("Extension activated");

    onFile(window.activeTextEditor?.document);
    workspace.workspaceFolders?.forEach(onWorkspace);

    // TODO: Handle workspace addition / removal

    context.subscriptions.push(
        window.onDidChangeActiveTextEditor(editor => onFile(editor?.document)),
        workspace.onDidSaveTextDocument(onFile),
    );
}

export function deactivate()
{}
