# Getting started as a contributor to the Apama VSCode extension

This extension is an open-source project, maintained by the community of people who use Apama. So if there's a feature you'd like, or a bug that's bugging you, please get stuck in and contribute a PR. You're also welcome to report issues, but the surest way to get some improvements is to figure out the changes and submit a PR yourself. 

## Introduction to the codebase

This Apama extension is written as an open-source VSCode language client written in TypeScript (see [the VSCode Extension Guide](https://code.visualstudio.com/api)). This git repo implements all the settings, commands and buttons related to Apama that you can see, as well as basic syntax highlighting when editing a `.mon` file. Features requiring deeper knowledge of the EPL language (such as diagnostic/error markers) are implemented as a [Language Server](https://microsoft.github.io/language-server-protocol/) in a separate process called `eplbuddy` that is provided as part of the [Apama](https://www.cumulocity.com/product/apama-community-edition/) product (i.e. is not open-source). 

## Building

Run the following commands to install, and build the extension.
```bash
npm install
npm run build
```

## Debugging 
Important: you must *uninstall* any existing instance of the extension from the marketplace before doing trying to run local changes. 

After the NPM build (described above), you can then launch it in VSCode using the `Debug: Start Debugging` command palette option (or pressing `F5`). Although it's possible to develop on Windows with a Windows installation of Apama, so far we haven't found a way to develop on Windows using WSL with a Linux installation of Apama. 

Read [the VSCode Extension Guide](https://code.visualstudio.com/api) for more information.

If working on `eplbuddy`, adding the following to `.vscode/settings.json` in the launched debug VSCode instance will allow you to see the LSP communication between the extension and the Apama Language Server (under Output > Apama Language Client),

```json
{
    "apamaLanguageClient.trace.server": "verbose"
}
```

## Testing
More effort needs to be put into building a suitable testsuite for the extension. 

## Releasing
TODO: describe how to publish to the marketplace
