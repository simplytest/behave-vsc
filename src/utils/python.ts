import { PythonExtension } from "@vscode/python-extension";
import { err, ok, Result } from "neverthrow";
import { Extension, extensions, window } from "vscode";

export enum Error
{
    MissingExtension,
    ExtensionInactive,
}

export function getExtension(): Result<Extension<PythonExtension>, Error>
{
    const extension = extensions.getExtension("ms-python.python");

    if (!extension)
    {
        window.showErrorMessage("Could not find 'ms-python.python' extension");
        return err(Error.MissingExtension);
    }

    if (!extension.isActive)
    {
        window.showErrorMessage("Could not activate 'ms-python.python' extension");
        return err(Error.ExtensionInactive);
    }

    return ok(extension);
}

export function getExecutable(): Result<string, Error>
{
    return getExtension().map(extension => extension.exports.environments.getActiveEnvironmentPath().path);
}
