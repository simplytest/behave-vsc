import { PVSC_EXTENSION_ID, PythonExtension, Resource } from "@vscode/python-extension";
import { err, ok } from "neverthrow";
import { extensions } from "vscode";
import { LOG } from "../log";

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
        LOG.toastError({ message: `Could not find Python (${PVSC_EXTENSION_ID}) extension` });
        return err(Error.ExtensionMissing);
    }

    if (!extension.isActive)
    {
        LOG.toastError({ message: "Python extension is not active" });
        return err(Error.ExtensionInactive);
    }

    return ok(extension);
}

export function getExecutable(workspace: Resource)
{
    return getExtension().map(extension => extension.exports.environments.getActiveEnvironmentPath(workspace).path);
}
