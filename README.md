# Apama Extension for Visual Studio Code

A community-developed extension for using Visual Studio Code to develop Apama Streaming Analytics applications in EPL.

For more information about Apama and EPL please visit the [Apama Community](https://www.cumulocity.com/product/apama-community-edition/) website or the [Apama product documentation](https://cumulocity.com/apama/docs/latest). To ask questions about Apama or this extension, use the [Apama community forum](https://techcommunity.cumulocity.com/tag/streaming-analytics-apama).

This extension is provided as-is and without warranty or support. It does not constitute part of any product. Users are free to use, fork and modify it, subject to the license agreement. We welcome contributions (though we may not include every contribution in the main project).

![Overview screenshot](images/overview.png)

## Features of the plugin

* Syntax highlighting
* Error/warning messages in the `Problems` view
* Inserting some common EPL code snippets - e.g. start typing `monitor`, `event` or `for` and you will be prompted to automatically insert the boilerplate code for a new monitor, event declaration or `for` loop
* Creating an "Apama project", and adding bundles to it from the `Apama Projects` view or the command palette. This can be used for both product EPL/connectivity bundles and custom bundles such as the Analytics Builder Block SDK
* Displaying EPL monitors, events, actions and fields for the current file in the "Outline" view 
* Jumping to the definition of any top-level EPL symbol (events, actions, monitors etc) by name. For example press `Ctrl+T` and begin typing the name of any action or event in the current workspace and you can quickly jump to the line and position where it is defined in the editor. This is a great way to quickly navigate around your codebase, and also to view the ApamaDoc for the EPL API you are using

There are some known limitations:
* Advanced content assist features such as completion proposals are not currently provided (except for basic snippet and history suggestions)
* Files with non-ASCII characters may not work correctly
* No incremental builds - all EPL files are rebuilt every time there is a change (although there is caching of the parsing phase for files that did not change). This may result in slow problem markers (and high CPU utilization) when working on very large projects on a low-powered laptop, though performance is reasonable for most cases. Also note that each project opened in VS Code will likely consume a few hundred MB of memory

## Getting started

To use all the functionality provided by this extension, you need a full installation of Apama that includes the "dev"/"builder" tooling (it must include `bin/engine_deploy`). If Apama is not installed, basic syntax highlighting is available but most other features will not work. 
It is strongly recommended to use the _latest_ version of Apama, and the minimum recommended version is **Apama 10.15.6.2**. The current extension version is not intended to be used with earlier versions of Apama. 

The extension can run on Linux. It can also be used on Windows, typically with WSL (Windows Subsystem for Linux)... or if using the older Apama 10.15 release which has a Windows installation package it can be used directly with a local Windows installation. The extension can also be used with a Development Container (DevContainer).

### Using a Linux installation

Many features of this extension require installing Apama, using the `dev` package.

For release 26.x and higher, install the `dev` (and optionally `apama-python`) Debian packages from the [Apama Repository](https://download.cumulocity.com/Apama/Debian/)

For the 10.15 release:
1. Identify the required package from the [download site](https://download.cumulocity.com/Apama/10.15), for example `apama-c8y-dev_10.15.*.*_amd64_linux.tar.gz`
2. Download the package by passing this URL to `wget` (you may need to run `sudo apt install wget` first, if it is not yet installed)
3. Then unpack it to the default directory using: `sudo mkdir -p /opt/cumulocity && sudo tar -xf apama-dev_10.15.*_amd64_linux.tar.gz -C /opt/cumulocity` (hint: if using WSL as described below, you will need to enter the password for the root account you created during WSL setup)

### Using a WSL installation on Windows

For Apama 26.x and higher there is no Windows installation package of Apama, so we recommend using the VS Code [WSL](https://code.visualstudio.com/docs/remote/wsl) extension which allows VS Code running on Windows to use a Linux-based Apama installation package. 

1. Install the latest version of [WSL](https://learn.microsoft.com/en-us/windows/wsl/install), using the **Debian** distribution of Linux. This may take some time and often requires a restart. See the WSL and also VS Code instructions for full details, but typical steps on a recent version of Windows would be:
    * Open a PowerShell terminal "as Administrator"
    * `wsl --install`
    * `wsl --install -d Debian`
3. Once installed, open a Debian WSL terminal (for example by opening `Debian` from the Start Menu) and install Apama using the `dev` package for Linux using the instructions above. 
4. Open VS Code, and install the [Visual Studio Code Remote Development Extension Pack](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.vscode-remote-extensionpack), and the [Apama Extension for VS Code](https://marketplace.visualstudio.com/items?itemName=ApamaCommunity.apama-extensions).
5. Using the command palette (`Ctrl+Shift+P`), select `Connect to WSL`
6. You can now create a new project, or clone an existing project from your version control system (e.g. Git). For WSL, it is recommended to use a location under your Linux home directory (`~`) to store your Apama projects (this provides faster performance than mounting locations such as `C:\` from the Windows file system; don't worry, the Linux file system can still be accessed from Windows - see the WSL documentation for details)

### Using a Development Container

[Development Containers](https://containers.dev/) (DevContainers) provide a consistent, isolated development environment inside a Docker container. 

We provide a ready-to-use [DevContainer](https://github.com/Cumulocity-IoT/cumulocity-analytics-vsc-devcontainer) that includes:

* The latest version of Apama
* [EPL Apps Tools](https://github.com/Cumulocity-IoT/apama-eplapps-tools) for EPL Apps development
* [Block SDK](https://github.com/Cumulocity-IoT/apama-analytics-builder-block-sdk) for Analytics Builder block development

The versions of Apama and the SDKs can be configured: see the DevContainer README for more information.

To use DevContainers, you will need a containerization environment on your computer. [Microsoft's VS Code documentation](https://code.visualstudio.com/remote/advancedcontainers/docker-options) should give you some guidance in that area.

### Opening your first Apama project

First ensure the Apama Extension for Visual Studio Code is installed, and that you have an installation of Apama. Where possible, ensure Apama is installed to the default installation directory `/opt/cumulocity/Apama`, so that the location can be detected automatically. If you use a different location, you will need to configure the location of Apama home in the Apama extension's settings.

If you want to start with an **existing Apama project** you were already working on (or clone of a sample project), simply open the Apama project folder (that is, the directory with the `.project` and `.dependencies` files) in your VS Code workspace. Note that the Apama project files must be in the top level of that folder.

If you want to **create a new project**, open the Command Palette and type `Apama: Create Project in New Folder` (alternatively you can create the empty folder outside of VS Code, add it to the workspace and click `Create Project` in the `Apama Projects` view). You can now use the `Apama Projects` view to add any bundles required for your project, whether product bundles (such as the Cumulocity bundle) or custom bundles (such as the [Analytics Builder Block SDK](https://github.com/Cumulocity-IoT/apama-analytics-builder-block-sdk) or [EPL Apps Tools](https://github.com/Cumulocity-IoT/apama-eplapps-tools)). Then use the main menu to create one or more `.mon` files for your EPL application. 

## License

Copyright (c) 2020-present Cumulocity GmbH

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
