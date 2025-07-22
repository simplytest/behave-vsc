import { randomUUID } from "crypto";
import { mkdir, rm, stat } from "fs/promises";
import { err, ok } from "neverthrow";
import { tmpdir } from "os";
import { join } from "path";
import { WorkspaceFolder } from "vscode";
import { fromPromise } from "../utils/neverthrow";

export function base64url(input: string)
{
    return Buffer.from(input).toString("base64url");
}

export async function workspaceCache(workspace: WorkspaceFolder)
{
    const name = base64url(workspace.uri.fsPath);
    const path = join(tmpdir(), "behave", name);

    const result = await fromPromise(mkdir(path, { recursive: true }));

    if (result.isErr())
    {
        return err(result.error);
    }

    return ok(path);
}

interface TempFileOptions
{
    invalidate?: boolean;
}

export async function cachedTempFile(workspace: WorkspaceFolder, name: string = randomUUID(), options?: TempFileOptions)
{
    const directory = await workspaceCache(workspace);

    if (directory.isErr())
    {
        return err(directory.error);
    }

    const path = join(directory.value, base64url(name));

    if (options?.invalidate)
    {
        await fromPromise(rm(path));
    }

    return ok(path);
}

export enum Error
{
    Outdated,
}

type Consumer<T> = (path: string, workspace: WorkspaceFolder) => T;

export async function withPrevious<T>(path: string, workspace: WorkspaceFolder, consumer: Consumer<T>)
{
    const original = await fromPromise(stat(path));

    if (original.isErr())
    {
        return err(original.error);
    }

    const outputFile = await cachedTempFile(workspace, path);

    if (outputFile.isErr())
    {
        return err(outputFile.error);
    }

    const cached = await fromPromise(stat(outputFile.value));

    if (cached.isErr())
    {
        return err(cached.error);
    }

    if (cached.value.mtime < original.value.mtime)
    {
        return err(Error.Outdated);
    }

    return consumer(outputFile.value, workspace);
}
