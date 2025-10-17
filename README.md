# Behave

The Behave extension aims to make development on [behave](https://behave.readthedocs.io/en/latest/) based projects easier by making typical workflows available from Visual Studio Codes User Interface.

## 💡 Features

- 🔍 Automatic Test Discovery

- 🧪 Test-Explorer Integration

  - 👀 Allows to view Features, Scenarios and Steps
  - 🐛 Debug and Run Tests directly from the Test-Explorer UI

- 🔳 Scenario-Outline Support

  > Allows to run individual examples

- 🔍 Definition Provider

  > Jump to the corresponding implementation straight from the Test-File

- ⚙️ Configurable

  > Various configuration options allow you to tweak the extension for your needs

- 🔄 Automatic Refresh

  > File Updates and Deletions are tracked and updates are issued accordingly

- 🤏 Small Footprint

## ⚙️ Configuration

The following configuration options are available:

| Name                  | Description                                                                        | Default                                                    |
| --------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `behave.allowedFiles` | The glob that is used to identify valid behave feature files                       | `**/*.feature`                                             |
| `behave.autoDiscover` | Whether or not to automatically discover all tests when opening a project          | `true`                                                     |
| `behave.codeLens`     | Whether or not to enable Code-Lens to allow running outlines from the Feature-File | `true`                                                     |
| `behave.arguments`    | Additional arguments to pass to behave                                             | `["-f", "pretty"]`                                         |
| `behave.diffRegex`    | Define the Regex used to determine the expected / actual value                     | `Expected: (?<expected>.*)[\\s\\S]*but: was (?<actual>.*)` |

The `behave.arguments` setting allows for fine-grained control over how behave is executed.  
For example, if you want to enable allure reports, you could use the following configuration:

```json
{
  "behave.arguments": [
    "-f",
    "allure_behave.formatter:AllureFormatter",
    "-o",
    "allure"
  ]
}
```

## 💻 Commands

The following commands are available:

| Name                | Description                               |
| ------------------- | ----------------------------------------- |
| `Behave: Run`       | Run Behave Tests                          |
| `Behave: Debug`     | Debug Behave Tests                        |
| `Behave: Load File` | Discover Tests in the currently open file |
| `Behave: Discover`  | Manually discover all tests               |
| `Behave: Clear`     | Clear the cache and discovered tests      |

All commands can also be used by other extensions, for information on arguments and return values, see [`src/commands.ts`](./src/commands.ts)

---

<div align="center">

Made by

![](data/banner.png)

</div>
