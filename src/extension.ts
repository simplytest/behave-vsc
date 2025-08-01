import { glob } from "fs/promises";
import { minimatch } from "minimatch";
import { commands, ExtensionContext, languages, TextDocument, Uri, window, workspace, WorkspaceFolder } from "vscode";
import { AnalyzeOptions } from "./behave";
import { provider } from "./language";
import { LOG } from "./log";
import { settings } from "./settings";
import { controller } from "./test";

interface FileOptions extends AnalyzeOptions
{
    ignoreGlob?: boolean;
}

function onFile(path: string, root: WorkspaceFolder, options?: FileOptions)
{
    const allowed = settings.allowedFiles(root);

    LOG.trace("File", path, root.name, allowed);

    if (!options?.ignoreGlob && !minimatch(path, allowed))
    {
        return;
    }

    controller.analyze(path, root, { ...options });
}

function onDelete(path: Uri)
{
    const { fsPath } = path;

    for (const [id, item] of controller.items)
    {
        if (!item.uri?.fsPath.startsWith(fsPath))
        {
            continue;
        }

        controller.items.delete(id);
    }
}

function onDocument(document?: TextDocument, options?: FileOptions)
{
    if (!document)
    {
        return;
    }

    const { fileName, uri } = document;
    const root = workspace.getWorkspaceFolder(uri);

    if (!root)
    {
        return;
    }

    onFile(fileName, root, options);
}

function onRefresh()
{
    return onDocument(window.activeTextEditor?.document, { ignoreGlob: true, skipCache: true });
}

interface DiscoverOptions
{
    invalidate?: boolean;
}

async function onDiscover(root = workspace.workspaceFolders?.[0], options?: DiscoverOptions)
{
    if (!root)
    {
        return;
    }

    if (options?.invalidate)
    {
        controller.items.forEach(({ id }) => controller.items.delete(id));
    }

    for await (const file of glob(settings.allowedFiles(root), { cwd: root.uri.fsPath }))
    {
        onFile(Uri.joinPath(root.uri, file).fsPath, root);
    }
}

function onWorkspaces(workspaces?: readonly WorkspaceFolder[])
{
    if (!workspaces)
    {
        return;
    }

    workspaces.filter(settings.autoDiscover).forEach(root => onDiscover(root));

    return workspaces.map(workspace => controller.createProfiles(workspace)).flat();
}

export function activate(context: ExtensionContext)
{
    LOG.info("Extension activated");

    context.subscriptions.push(
        commands.registerCommand("behave.refresh", onRefresh),
        commands.registerCommand("behave.discover", () => onDiscover(undefined, { invalidate: true })),
    );

    onWorkspaces(workspace.workspaceFolders);
    onDocument(window.activeTextEditor?.document);

    context.subscriptions.push(
        languages.registerDefinitionProvider({ scheme: "file", language: "feature" }, provider),
    );

    context.subscriptions.push(
        window.onDidChangeActiveTextEditor(editor => onDocument(editor?.document)),
    );

    context.subscriptions.push(
        workspace.onDidSaveTextDocument(onDocument),
        workspace.onDidDeleteFiles(({ files }) => files.forEach(onDelete)),
    );

    // TODO: Handle workspace-deletion

    context.subscriptions.push(
        workspace.onDidChangeWorkspaceFolders(({ added }) =>
            onWorkspaces(added)?.forEach(disposable => context.subscriptions.push(disposable))
        ),
    );
}

export function deactivate()
{}
