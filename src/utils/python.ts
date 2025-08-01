import { PVSC_EXTENSION_ID, PythonExtension, Resource } from "@vscode/python-extension";
import { extensions } from "vscode";
import { LOG } from "../log";
import { err, ok } from "./expected";

export enum Error
{
    ExtensionMissing,
    ExtensionInactive,
}

export function getExtension()
{
    const extension = extensions.getExtension<PythonExtension>(PVSC_EXTENSION_ID);

    if (!extension)
    {
        LOG.showError(`Could not find Python (${PVSC_EXTENSION_ID}) extension`);
        return err(Error.ExtensionMissing);
    }

    if (!extension.isActive)
    {
        LOG.showError("Python extension is not active");
        return err(Error.ExtensionInactive);
    }

    return ok(extension);
}

export function getExecutable(workspace: Resource)
{
    return getExtension().map(extension => extension.exports.environments.getActiveEnvironmentPath(workspace).path);
}
