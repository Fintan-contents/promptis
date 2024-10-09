# promptis README

![test](https://github.com/Fintan-contents/promptis/actions/workflows/test.yaml/badge.svg?label=New)

GitHub Copilot Chat allows you to ask questions about implementation through prompts, but the high burden of typing these prompts one by one has led to the following issues:

- **Time and Productivity Issues**
  - Frequent prompt input interrupts coding, leading to decreased concentration and productivity.
  - Re-explaining the context takes time, resulting in inefficient workflows.
- **Quality and Consistency Issues**
  - Short prompts may not fully convey the developer's intent, leading to lower quality and appropriateness of the generated code.
  - Using different prompts can result in inconsistent code styles and policies, compromising the overall unity of the project.

Promptis is a Visual Studio Code (VS Code) Extension that semi-automates prompt execution using GitHub Copilot Chat to solve these issues.

- TODO: Insert GIF video

## Merits

- **Semi-automatic Prompt Execution**: Allows continuous execution of pre-prepared prompts.
- **Consistent Code Generation**: Improves code quality and consistency through unified prompts.
- **Increased Productivity**: Reduces the hassle of frequent prompt input, allowing you to focus on coding.

## How to Install

### Installing via the Internet

Please install from Promptis[^1] on [Extensions for Visual Studio Code](https://marketplace.visualstudio.com/vscode).

[^1]: TODO: Add link once published

### Installing on a Device Without Internet Access

Please install from the [Release](https://github.com/Fintan-contents/promptis/releases) page.

## Usage

Promptis is an extension that semi-automates prompt execution using GitHub Copilot Chat.

Prepare prompts for review perspectives on source code and configuration files as Markdown files in a directory. You can issue commands to @promptis from the Chat window to execute the corresponding prompts continuously. For example, to review whether `chatHandler.ts` and `api.ts` meet the code standards, you would instruct as follows:

```text
@promptis /codereviewCodeStandards #file:chatHandler.ts #file:api.ts
```

The `/codereviewCodeStandards` command corresponds 1:1 with the prompt storage directory, and Promptis recursively reads and executes the prompt files (extension: `.md`) under that directory.

The commands you can instruct are as follows:

### Command Map

|Command Name|	Execution Content|
|:-|:-|
|`codereviewCodeStandards` | Conduct a series of code reviews on code standards |
|`codereviewFunctional`	| Conduct a code review from a functional perspective |
|`codereviewNonFunctional` |	Conduct a code review from a non-functional perspective |
|`reverseEngineeringPromptPath` | Conduct reverse engineering on the source code |
| `drawDiagrams` | Create diagrams from the source code |

## Requirements

- [VS Code](https://code.visualstudio.com/) [version.1.91.0](https://code.visualstudio.com/updates/v1_91) or later
  - To use Chat and Language Model API
- The following extensions must be installed:
  - [GitHub Copilot Extension](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot)
  - [GitHub Copilot Chat](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot-chat)

## Extension Settings

|Setting Item|Type|Default Value|Description|
|:-|:-|:-|:-|
|`codeReview.codeStandardPath`|string| | Absolute path to the code review prompt storage directory (code standards perspective).|
|`codeReview.functionalPath`| string| | Absolute path to the code review prompt storage directory (functional perspective). |
|`codeReview.nonFunctionalPath`|string| | Absolute path to the code review prompt storage directory (non-functional perspective). |
|`reverseEngineering.promptsPath` |string| |Absolute path to the reverse engineering prompt storage directory.|
|`drawDiagrams.promptsPath`|string| |Absolute path to the prompt directory for diagram creation.|
|`prompt.excludeFilePatterns`|array of string| |Patterns of file names in the prompt storage directory that should not be executed (e.g., `**/dir/*.md`). Refer to minimatch-cheat-sheet for the patterns that can be described.|
|`chat.outputPath`|string| |Absolute path to the directory for backup output of chat content.|
|`telemetry.enable`|boolean|true|Whether to send telemetry information indicating usage.|

## Telemetry

This extension collects usage data and sends telemetry to our server for the purpose of improving this extension. The collected data is as follows and does not include personally identifiable information.

|Item Name|Description|Example|
|:-|:-|:-|
|Executed Command|Command name indicated in the "Command Map" above|`codereviewCodeStandards`|
|Language Setting|User's VS Code language setting|`en`|
|VS Code Version|User's VS Code version|`1.94.1`|
|OS|User's OS|`linux`|
|Extension ID|ID of this extension| `tis.promptis`|
|Extension Version|Version of this extension| `1.0.0`|
|Machine ID|ID to identify the machine where VS Code is installed[^2]|`3917c36ba8b94f2521fda9b5f94b783364a838148a87e5cfa3506eb6690e69a5`|

[^2]: The machine ID is a hashed value generated by VS Code to protect user privacy.

Telemetry transmission can be disabled in user settings.

- To disable telemetry for the entire VS Code, refer to `telemetry.telemetryLevel` and change it to the desired value.
- To disable telemetry only for this extension, change the Promptis `telemetry.enable` setting to false.

# Support

- Supports the latest version of VS Code and up to two previous versions.
- Bugs and feature requests for this extension are accepted in Issues.
Release Notes