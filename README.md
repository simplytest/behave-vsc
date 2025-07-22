# Behave

The Behave extension aims to make development on [behave](https://behave.readthedocs.io/en/latest/) based projects easier by making typical workflows available from Visual Studio Codes User Interface.

## 💡 Features

* 🧪 Test-Explorer Integration
  * View, Debug and Run Tests directly from the Test-Explorer UI  
    
* 🔍 Definition Provider
  * Jump to the corresponding implementation straight from the Test-File

* 🤏 Small Footprint

## ⚙️ Configuration

The following configuration options are available:

| Name                  | Description                                                               | Default        |
| --------------------- | ------------------------------------------------------------------------- | -------------- |
| `behave.allowedFiles` | The glob that is used to identify valid behave feature files              | `**/*.feature` |
| `behave.autoDiscover` | Whether or not to automatically discover all tests when opening a project | `false`        |
| `behave.arguments`    | Additional arguments to pass to behave                                    | `[]`           |

## 💻 Commands

The following commands are available:

| Name                         | Description                                                                                     |
| ---------------------------- | ----------------------------------------------------------------------------------------------- |
| `Behave: Force Refresh File` | Refresh the currently opened file. Ignores the `allowedFiles` setting and invalidates the cache |
| `Behave: Discover All Tests` | Manually discover all feature files                                                             |
---

<div align="center">

<img height="100" src="data/banner.png" alt="Banner" />

</div>
