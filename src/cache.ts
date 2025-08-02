import { randomUUID } from "crypto";
import { mkdir, rm, stat } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { Disposable, WorkspaceFolder } from "vscode";
import { err, fromPromise, ok } from "./utils/expected";

const internalCache = new Map<string, unknown>();

export const runtimeCache = {
    create: <T>(name: string, initial: () => T) => ({
        load: () =>
        {
            if (!internalCache.has(name))
            {
                internalCache.set(name, initial());
            }

            return internalCache.get(name)! as T;
        },
    }),
    clear: (name?: string) =>
    {
        name ? internalCache.delete(name) : internalCache.clear();
    },
};

export async function rootCache()
{
    const path = join(tmpdir(), "behave-vsc");
    const prom = await fromPromise(mkdir(path, { recursive: true }));

    if (prom.isErr())
    {
        return err(prom.error);
    }

    return ok(path);
}

export async function workspaceCache(workspace: WorkspaceFolder)
{
    const root = await rootCache();

    if (root.isErr())
    {
        return err(root.error);
    }

    const path = join(root.value, encode(workspace.uri.fsPath));
    const prom = await fromPromise(mkdir(path, { recursive: true }));

    if (prom.isErr())
    {
        return err(prom.error);
    }

    return ok(path);
}

interface FileCacheOptions
{
    checkExpired?: boolean;
}

export enum Error
{
    Expired,
}

export async function fileCache(file: string = randomUUID(), workspace: WorkspaceFolder, options?: FileCacheOptions)
{
    const root = await workspaceCache(workspace);

    if (root.isErr())
    {
        return err(root.error);
    }

    const path = join(root.value, encode(file));

    if (options?.checkExpired && await isExpired(file, path))
    {
        return err(Error.Expired);
    }

    return ok({ path, disposable: new Disposable(() => fromPromise(rm(path))) });
}

function encode(value: string)
{
    return Buffer.from(value).toString("base64url");
}

async function isExpired(original: string, cached: string)
{
    const oStat = await fromPromise(stat(original));

    if (oStat.isErr())
    {
        return true;
    }

    const cStat = await fromPromise(stat(cached));

    if (cStat.isErr())
    {
        return true;
    }

    return oStat.value.mtime > cStat.value.mtime;
}
