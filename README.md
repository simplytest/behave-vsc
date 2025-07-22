# Behave

The Behave extension aims to make development on [behave](https://behave.readthedocs.io/en/latest/) based projects easier by making typical workflows available from Visual Studio Codes User Interface.

## 💡 Features

* 🔍 Automatic Test Discovery
  > See [configuration](#️-configuration) for more information


* 🧪 Test-Explorer Integration
  * 👀 Allows to view Features, Scenarios and Steps
  * 🐛 Debug and Run Tests directly from the Test-Explorer UI  

* 🔳 Scenario-Outline Support
  > Allows to run individual examples

* 🔍 Definition Provider
  > Jump to the corresponding implementation straight from the Test-File

* ⚙️ Configurable
  > Various configuration options allow you to tweak the extension for your needs

* 🔄 Automatic Refresh
  > File Updates and Deletions are tracked and updates are issued accordingly

* 🤏 Small Footprint

## ⚙️ Configuration

The following configuration options are available:

| Name                   | Description                                                               | Default                                 |
| ---------------------- | ------------------------------------------------------------------------- | --------------------------------------- |
| `behave.allowedFiles`  | The glob that is used to identify valid behave feature files              | `**/*.feature`                          |
| `behave.autoDiscover`  | Whether or not to automatically discover all tests when opening a project | `false`                                 |
| `behave.discoverSteps` | Whether or not to automatically add individual steps to the Test-Explorer | `false`                                 |
| `behave.arguments`     | Additional arguments to pass to behave                                    | `[]`                                    |
| `behave.expectedRegex` | Define the Regex used to determine the expected / actual value            | `Expected: (.*)[\\s\\S]*but: was (.*)"` |

## 💻 Commands

The following commands are available:

| Name                         | Description                                                                                     |
| ---------------------------- | ----------------------------------------------------------------------------------------------- |
| `Behave: Force Refresh File` | Refresh the currently opened file. Ignores the `allowedFiles` setting and invalidates the cache |
| `Behave: Discover All Tests` | Manually (re-)discover all feature files                                                        |
---

<div align="center">

<img height="100" src="./data/banner.png" alt="Banner" />

</div>
