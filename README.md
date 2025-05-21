# Apama Extension for Visual Studio Code

A community-developed extension for using Microsoft Visual Studio Code to develop Apama Streaming Analytics applications in EPL.

For more information about Apama and EPL please visit the [Apama Community](https://www.cumulocity.com/product/apama-community-edition/) website or the [Apama product documentation](https://cumulocity.com/apama/docs/latest). To ask questions about Apama or this extension, use the [Apama community forum](https://techcommunity.cumulocity.com/tag/streaming-analytics-apama).

![Overview screenshot](images/overview.png)

This extension is provided as-is and without warranty or support. It does not constitute part of any product. Users are free to use and improve it, subject to the license agreement. We welcome contributions (though we may not include every contribution in the main project).

## Features of the extension

The extension supports:
* Syntax highlighting.
* Content assistance features such as EPL errors in the `Problems` view, hovers, "go to definition" and the `Outline` view - when a suitable version of Apama is installed. See the Visual Studio Code topic in the Apama product documentation for more details on what is provided in each version of Apama. 
* Creating an "Apama project", and adding bundles to it from the `Apama Projects` view or the command palette (`F1`). This can be used for both product EPL/connectivity bundles and custom bundles such as the Analytics Builder Block SDK.
* Inserting common EPL code snippets. For example, start typing `monitor`, `event` or `for` and you will be prompted to automatically insert the boilerplate code for a new monitor, event declaration or `for` loop.

There are some known limitations; the main one is that problem markers and assistance features may not work correctly for files with non-ASCII characters. 

## Installation quick-start

To use all the functionality provided by this extension, you need two things - a Visual Studio Code client with the Apama extension, and an appropriate installation of Apama. 

First, install VS Code and the [Remote Development Extension Pack](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.vscode-remote-extensionpack). 

Then the simplest way to get started is to run Apama inside a [Dev Container](https://code.visualstudio.com/docs/devcontainers/containers) (although it is also possible to use a local installation of Apama if you prefer). See the [Microsoft VS Code documentation](https://code.visualstudio.com/remote/advancedcontainers/docker-options) for more details, but the steps below can help to get started quickly:

On **Windows**:
    * Install [WSL](https://learn.microsoft.com/en-us/windows/wsl/install) by running `wsl --install` from an Administrator terminal. (NB: This is required for the latest Apama versions, but optional if using the older 10.15 release)
    * Either install a container engine such as [Rancher Desktop](https://docs.rancherdesktop.io/getting-started/installation/), or install Apama locally inside a WSL Debian container (see below for details). Installing a container engine is recommended especially for 26.x onwards, since otherwise there is a bit more setup to clone the SDKs. 
    * If you choose to use Rancher Desktop, you should go to the WSL integration preferences page in Rancher and configure it to to expose Rancher Desktop's Docker socket to WSL. You should also ensure it is using the `dockerd` (moby) container engine, and optionally configure it to automatically start at login. 

On **macOS**, you can install [colima](https://github.com/abiosoft/colima) so you can run (x86) dev container images.

On **Linux**, follow your distribution's instructions to install a container engine and docker-compatible command line. Alternatively, you can use a local install of Apama using the instructions below. 

From a **web browser**, it is possible to use the extension by opening any devcontainer-enabled Apama repository in [GitHub Codespaces](https://github.com/features/codespaces). For example you can try it out by opening our [Sample repository template](https://github.com/Cumulocity-IoT/streaming-analytics-sample-repo-template) in a codespace.

For more detailed installation notes, see later on this page. 

## Opening your first Apama project as a Dev Container

If you have a Docker-compatible [container engine](https://code.visualstudio.com/remote/advancedcontainers/docker-options) installed on your machine, you can easily open any Apama project that has a `.devcontainer` configuration. 

To get started, go to the [Streaming Analytics Sample Repository Template](https://github.com/Cumulocity-IoT/streaming-analytics-sample-repo-template), and click the button to "Use this template" to "Create a new repository" for your own application. 

Then open the VS Code command palette (`F1`), run `Dev Containers: Clone Repository in Container Volume` and then enter the HTTPS link to your GitHub repository. This will download the Apama "builder" image, and clone the latest version of the [EPL Apps Tools](https://github.com/Cumulocity-IoT/apama-eplapps-tools) and [Block SDK](https://github.com/Cumulocity-IoT/apama-analytics-builder-block-sdk). 

You can immediately open up any of the EPL files under `src/` to experiment with developing Blocks and EPL apps. 

If you have an existing project, you can add support for Dev Containers by simply copying the `.devcontainer` directory from the template project into your own repository. 

## Opening your first Apama project without a dev container

First ensure the [Apama Extension for Visual Studio Code](https://marketplace.visualstudio.com/items?itemName=ApamaCommunity.apama-extensions) is installed, and that you have an installation of Apama. Where possible, Apama should be installed to the default installation directory `/opt/cumulocity/Apama`, so that the location can be detected automatically. If you use a different location, you will need to configure the location of Apama home in the Apama extension's settings.

If you want to **create a new project**, open the Command Palette and type `Apama: Create Project in New Folder` (alternatively you can create the empty folder outside of VS Code, add it to the workspace and click `Create Project` in the `Apama Projects` view). You can now use the `Apama Projects` view to add any bundles required for your project, whether product bundles (such as the Cumulocity bundle) or custom bundles (such as the [Analytics Builder Block SDK](https://github.com/Cumulocity-IoT/apama-analytics-builder-block-sdk) or [EPL Apps Tools](https://github.com/Cumulocity-IoT/apama-eplapps-tools)). Then use the main menu to create one or more `.mon` files for your EPL application. 

If you want to start with an **existing Apama project** you were already working on (or a clone of a sample project), simply open the Apama project folder (that is, the directory with the `.project` file) in your VS Code workspace. Note that the Apama project files (including `.dependencies`) must be in the top level of that folder. If you do not yet have a `.project` file (to mark the folder as an Apama project), open the Command Palette and type `Apama: Create Project` to create the project files.

## More details on installation options

To use all the functionality provided by this extension, you need a full installation of Apama that includes the "dev"/"builder" tooling (it must include `bin/engine_deploy`). If Apama is not installed, basic syntax highlighting is available but most other features will not work. It is strongly recommended to use the _latest_ version of Apama, and the minimum recommended version is either **Apama 26** or **Apama 10.15.6.4**. The current extension version is not intended to be used with earlier versions of Apama. 

The extension can run on Linux. It can also be used on Windows, typically with WSL (Windows Subsystem for Linux). If using the older Apama 10.15 release (which has a Windows installation package) it can be used directly with a local Windows installation. The extension can also be used with a Dev Container.

If using on a Remote platform (i.e. WSL, SSH or DevContainers), the [Apama extension](https://marketplace.visualstudio.com/items?itemName=ApamaCommunity.apama-extensions) needs to be installed on the Remote Host.

Note: if using a container with a locally installed Docker, you may find the default memory allocated by your containerization tool needs to be increased from the default. We advise having a minimum of 4GB of memory for local development.

### Details - local Linux installation

Many features of this extension require installing Apama, using one of the `dev` packages.

For release **26.x and higher**, simply install the `apama` (and optionally `apama-python`) Debian packages from the [Apama Repository](https://download.cumulocity.com/Apama/Debian/) using the instructions given there. Remember to `apt update` and `apt upgrade` to ensure you're on the latest version of Apama. 

For the older 10.15 release:
1. Identify the required package from the [download site](https://download.cumulocity.com/Apama/10.15), for example `apama-c8y-dev_10.15.*.*_amd64_linux.tar.gz` (or `apama-dev_10.15.*.*_amd64_linux.tar.gz` for non-Cumulocity applications)
2. Download the package by passing this URL to `wget` (you may need to run `sudo apt install wget` first, if it is not yet installed)
3. Then unpack it to the default directory using: `sudo mkdir -p /opt/cumulocity && sudo tar -xf apama-*_amd64_linux.tar.gz -C /opt/cumulocity` (hint: if using WSL as described below, you will need to enter the password for the root account you created during WSL setup)

Then make sure you've installed the [Apama extension](https://marketplace.visualstudio.com/items?itemName=ApamaCommunity.apama-extensions) into VS Code.

### Details - local installation of Apama into WSL on Windows

For Apama 26.x and higher there is no Windows installation package of Apama, so you must install WSL. While we recommend using a Dev Container (as above), it is also fine to install Apama directly into WSL, and use the VS Code [WSL](https://code.visualstudio.com/docs/remote/wsl) extension. 

1. Install the latest version of [WSL](https://learn.microsoft.com/en-us/windows/wsl/install), and add the **Debian** distribution of Linux. This may take some time and often requires a restart. See the WSL and also VS Code instructions for full details, but typical steps on a recent version of Windows would be:
    * Open a PowerShell terminal "as Administrator"
    * `wsl --install`
    * `wsl --install -d Debian`
3. Once installed, open a Debian WSL terminal (for example by opening `Debian` from the Start Menu) and install Apama using the `apama` package for Linux using the instructions above. 
4. Open VS Code, and install the [Visual Studio Code Remote Development Extension Pack](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.vscode-remote-extensionpack).
5. Using the command palette (`Ctrl+Shift+P`), select `Connect to WSL`
6. Install the [Apama Extension for VS Code](https://marketplace.visualstudio.com/items?itemName=ApamaCommunity.apama-extensions). This is installed on the remote VS Code instance, so will need to be installed for every remote host that you use this on.
7. You can now create a new project, or clone an existing project from your version control system (e.g. Git). For WSL, it is recommended to use a location under your Linux home directory (`~`) to store your Apama projects (this provides faster performance than mounting locations such as `C:\` from the Windows file system; don't worry, the Linux file system can still be accessed from Windows using `\\$wsl` - see the WSL documentation for details)

### Details - using Lima to create a virtual machine on macOS

For users on macOS (Intel or Apple Silicon), we recommend using the [lima](https://github.com/lima-vm/lima) virtualization runtime. 

Once Lima has been installed, create a virtual machine with Debian as the image. If you are on 26.x and on an Apple Silicon machine, create an ARM64 VM. Otherwise, create an x86 VM.

```bash
# ARM64
limactl create --name debian template://debian-12

# x86
limactl create --name debian-x86 --arch x86_64 --rosetta template://debian-12
```

Once your virtual machine is created, start it up, and shell into it. Then install Apama using the instructions from "Using a Linux installation".

Use the [Visual Studio Code Remote Development Extension Pack](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.vscode-remote-extensionpack) to connect to your virtual machine.

Tip: to show your Lima VMs in Remote-SSH, run `echo -e "\nInclude ${LIMA_HOME:-$HOME/.lima}/debian-x86/ssh.config" >> ~/.ssh/config` in a terminal ([source](https://github.com/lima-vm/lima/discussions/1890)).

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
