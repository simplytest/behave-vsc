import { randomUUID } from "crypto";
import { mkdir } from "fs/promises";
import { err, fromPromise, ok } from "neverthrow";
import { tmpdir } from "os";
import { join } from "path";
import { WorkspaceFolder } from "vscode";

export function base64url(input: string)
{
    return Buffer.from(input).toString("base64url");
}

export async function workspaceCache(workspace: WorkspaceFolder)
{
    const name = base64url(workspace.uri.fsPath);
    const path = join(tmpdir(), "behave", name);

    const result = await fromPromise(mkdir(path, { recursive: true }), e => e);

    if (result.isErr())
    {
        return err(result.error);
    }

    return ok(path);
}

export async function cachedTempFile(workspace: WorkspaceFolder, name: string = randomUUID())
{
    const directory = await workspaceCache(workspace);

    if (directory.isErr())
    {
        return err(directory.error);
    }

    return ok(join(directory.value, base64url(name)));
}
