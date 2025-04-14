/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  window,
  commands,
  Disposable,
  workspace,
  TreeDataProvider,
  EventEmitter,
  Event,
  TreeView,
  FileSystemWatcher,
  ExtensionContext,
  QuickPickItem,
  TextDocument,
  TreeItemCollapsibleState,
  TreeItem,
  WorkspaceFolder,
  Uri,
} from "vscode";
import {
  ApamaProject,
  BundleItem,
} from "./apamaProject";
import { ApamaRunner } from "../apama_util/apamarunner";
import {
  ApamaExecutables,
  getCommandLine,
} from "../apama_util/apamaenvironment";
import { Logger } from "../logger/logger";

import * as path from "path";
export class ApamaProjectView
  implements TreeDataProvider<string | ApamaProject | BundleItem>
{
  private _onDidChangeTreeData: EventEmitter<ApamaProject | BundleItem | undefined> =
    new EventEmitter<ApamaProject | BundleItem | undefined>();
  readonly onDidChangeTreeData: Event<ApamaProject | BundleItem | undefined> =
    this._onDidChangeTreeData.event;

  //we want to have a list of top level nodes (projects)
  private projects: ApamaProject[] = [];

  // eslint-disable-next-line
  private treeView: TreeView<{}>;

  private fsWatcher: FileSystemWatcher;
  private delWatcher: FileSystemWatcher;
  //
  // Added facilities for multiple workspaces - this will hopefully allow
  // ssh remote etc to work better later on, plus allows some extra organisational
  // facilities....
  constructor(
    private logger: Logger,
    private context: ExtensionContext,
  ) {
    const subscriptions: Disposable[] = [];

    //project commands
    this.registerCommands();

    // Watch for changes to the `.dependencies` file, to refresh our project view.
    // Now, we are checking for all dependencies files: this is because we need to check /all/ open workspaces.
    // The other alternative is to create seperate listeners for each workspace, which feels like far too much effort.
    this.fsWatcher = workspace.createFileSystemWatcher("**/*.dependencies");
    this.delWatcher = workspace.createFileSystemWatcher("**/*.dependencies"); 

    this.fsWatcher.onDidCreate((_item) => {
      this.refresh();
    });
    this.delWatcher.onDidDelete(() => {
      this.refresh();
    });
    this.fsWatcher.onDidChange((_item) => {
      this.refresh();
    });
    
    // Listen for workspace folder changes (added or removed folders)
    workspace.onDidChangeWorkspaceFolders(() => {
      this.refresh();
    });

    //the component
    this.treeView = window.createTreeView("apamaProjects", {
      treeDataProvider: this,
    });
  }

  /**
   * Clean up file system watchers.
   */
  dispose(): void {
    this.fsWatcher.dispose();
    this.delWatcher.dispose();
  }

  registerCommands(): void {
    if (this.context !== undefined) {
      // Register the bundle menu command
      this.context.subscriptions.push(
        commands.registerCommand(
          "apama.bundleMenu",
          async (project?: ApamaProject) => {
            // If project is not provided (called from Command Palette), prompt user to select one
            if (!project) {
              project = await this.promptForProject("Select a project to add bundles to");
              if (!project) {
                return; // User cancelled the selection
              }
            }

            // Show quick pick with bundle options
            const options = [
              { label: "Add product bundle", command: "apama.apamaToolAddBundles" },
              { label: "Add custom bundle", command: "apama.addRelativeBundle" }
            ];

            const selected = await window.showQuickPick(options, {
              placeHolder: "Select bundle type to add"
            });

            if (selected) {
              // Execute the selected command and pass the project
              commands.executeCommand(selected.command, project);
            }
          }
        )
      );

      this.context.subscriptions.push.apply(this.context.subscriptions, [
        
        /** Create project in existing workspace */
        commands.registerCommand(
          "apama.apamaToolCreateProject",
          async () => {
            const apamaProjectCommand = await getCommandLine(ApamaExecutables.PROJECT);
            if (!apamaProjectCommand) { return Promise.resolve(); }
            const apama_project = new ApamaRunner(
              "apama_project",
              apamaProjectCommand
            );

            // Dynamically get current workspace folders
            const workspaceFolders = workspace.workspaceFolders;
            
            // Handle multiple workspaces
            if (!workspaceFolders || workspaceFolders.length === 0) {
              window.showErrorMessage("No workspace folders are open");
              return;
            }
            
            let targetWorkspace: WorkspaceFolder;
            
            // If only one workspace, use it directly
            if (workspaceFolders.length === 1) {
              targetWorkspace = workspaceFolders[0];
            } else {
              // If multiple workspaces, prompt user to select one
              const workspaceItems = workspaceFolders.map(ws => ({
                label: ws.name,
                description: ws.uri.fsPath,
                workspace: ws
              }));
              
              const selected = await window.showQuickPick(workspaceItems, {
                placeHolder: "Select workspace to create Apama project in"
              });
              
              if (!selected) {
                return; // User cancelled the selection
              }
              
              targetWorkspace = selected.workspace;
            }
            
            // Create the project in the selected workspace
            apama_project
              .run(targetWorkspace.uri.fsPath, ["create", '.'])
              .then((result) => {
                window.showInformationMessage(result.stdout);
                this.logger.info(result);
              })
              .catch((err) => {
                window.showErrorMessage(err.stderr);
                this.logger.error(err);
              });
          },
        ),
        
        /** Create project in a new folder */
        commands.registerCommand(
          "apama.apamaToolCreateProjectInNewFolder",
          async () => {
            const apamaProjectCommand = await getCommandLine(ApamaExecutables.PROJECT);
            if (!apamaProjectCommand) { return Promise.resolve(); }
            const apama_project = new ApamaRunner(
              "apama_project",
              apamaProjectCommand
            );
            
            // Then use file picker to select the parent directory only
            const folderUri = await window.showOpenDialog({
              canSelectFiles: false,
              canSelectFolders: true,
              canSelectMany: false,
              openLabel: "Select Parent Directory",
              title: "Step 1/2: Select an existing directory to use as the parent for the new project directory"
            });
            
            if (!folderUri || folderUri.length === 0) {
              return; // User cancelled the folder selection
            }
            
            const parentDir = folderUri[0].fsPath;
            
            // Then prompt for new folder name (Step 2)
            const folderName = await window.showInputBox({
              prompt: "Step 2/2: Enter name for the new Apama project folder (will be created inside the parent directory)",
              placeHolder: "project-name"
            });
            
            if (!folderName) {
              return; // User cancelled the input
            }
            
            // Set the parent directory as the working directory
            const targetWorkspace = {
              uri: folderUri[0],
              name: path.basename(parentDir),
              index: 0
            };
            
            this.logger.info(`Creating project in new folder: ${path.join(parentDir, folderName)}`);
            
            // Create the project in the new folder
            apama_project
              .run(targetWorkspace.uri.fsPath, ["create", folderName])
              .then((result) => {
                window.showInformationMessage(result.stdout);
                this.logger.info(result);
                
                const newProjectPath = path.join(parentDir, folderName);
                window.showInformationMessage(
                  `Project created successfully. Add to workspace?`,
                  "Yes",
                  "No"
                ).then(answer => {
                  if (answer === "Yes") {
                    // Add the folder to workspace
                    const uri = Uri.file(newProjectPath);
                    workspace.updateWorkspaceFolders(
                      workspace.workspaceFolders ? workspace.workspaceFolders.length : 0,
                      0,
                      { uri: uri }
                    );
                    this.logger.info(`Added ${newProjectPath} to workspace`);
                  }
                });
              })
              .catch((err) => {
                window.showErrorMessage(err.stderr);
                this.logger.error(err);
              });
          },
        ),

        //
        // Add Bundle
        //
        commands.registerCommand(
          "apama.apamaToolAddBundles",
          async (project?: ApamaProject) => {
            const apamaProjectCommand = await getCommandLine(ApamaExecutables.PROJECT);
            if (!apamaProjectCommand) { return; }
            const apama_project = new ApamaRunner(
              "apama_project",
              apamaProjectCommand
            );
            // If project is not provided (called from Command Palette), prompt user to select one
            if (!project) {
              project = await this.promptForProject("Select a project to add bundles to");
              if (!project) {
                return; // User cancelled the selection
              }
            }

            apama_project
              .run(project.fsDir, ["list", "bundles"])
              .then((result) => {
                const lines: string[] = result.stdout.split(/\r?\n/);
                const displayList: QuickPickItem[] = [];
                lines.forEach((item) => {
                  item = item.trim();
                  //matches number followed by text
                  if (item.search(/^[0-9][0-9]?\s.*$/) === 0) {
                    item = item.replace(
                      /^([0-9][0-9]?\s)(.*)$/g,
                      (_cap1, _cap2, cap3) => {
                        return cap3;
                      },
                    ).trim();
                    displayList.push({ label: item });
                  }
                });
                // Allow multiple selections
                return window.showQuickPick(displayList, {
                  placeHolder: "Choose bundles to add",
                  canPickMany: true
                });
              })
              .then((picked) => {
                if (!picked || picked.length === 0) {
                  return;
                }

                // Build command arguments with all selected bundles
                const commandArgs = ["add", "bundle"];
                picked.forEach(bundle => {
                  commandArgs.push('"' + bundle.label.trim() + '"');
                });

                apama_project
                  .run(project!.fsDir, commandArgs)
                  .then((result) => {
                    window.showInformationMessage(`${result.stdout}`);
                  })
                  .catch((err) => window.showErrorMessage(`${err.stderr}`));
              })
              .catch((err) => window.showErrorMessage(`${err.stderr}`));
          },
        ),

        /** 
         *  Add relative bundle.
         *  This supports adding a bundle from the file system.
         */ 
        commands.registerCommand(
          "apama.addRelativeBundle",
          async (project?: ApamaProject) => {
            const apamaProjectCommand = await getCommandLine(ApamaExecutables.PROJECT);
            if (!apamaProjectCommand) { return; }
            const apama_project = new ApamaRunner(
              "apama_project",
              apamaProjectCommand
            );

            // If project is not provided (called from Command Palette), prompt user to select one
            if (!project) {
              project = await this.promptForProject("Select a project to add a relative bundle to");
              if (!project) {
                return; // User cancelled the selection
              }
            }
            
            // Open file picker that only allows .bnd files
            const fileUri = await window.showOpenDialog({
              canSelectFiles: true,
              canSelectFolders: false,
              canSelectMany: false,
              filters: {
                'Bundle Files': ['bnd']
              },
              title: 'Select a bundle (.bnd) file to add'
            });
            
            // If user cancelled the picker, return
            if (!fileUri || fileUri.length === 0) {
              return;
            }
            
            const selectedFile = fileUri[0];
            
            // Get the path relative to the project directory
            let relativePath = workspace.asRelativePath(selectedFile);
            
            // If the path is still absolute (happens when file is outside workspace),
            // we need to calculate the relative path manually
            if (selectedFile.fsPath === relativePath) {
              try {
                // Calculate relative path from project directory to the selected file
                relativePath = path.relative(project.fsDir, selectedFile.fsPath);
              } catch (error) {
                window.showErrorMessage(`Failed to determine relative path: ${error}`);
                return;
              }
            }
            
            this.logger.info(`Adding bundle from: ${relativePath}`);
            
            // Run the apama_project command with the relative path
            apama_project
              .run(project.fsDir, [
                "add",
                "bundle",
                relativePath
              ])
              .then((result) => {
                window.showInformationMessage(`Bundle added: ${result.stdout}`);
              })
              .catch((err) => {
                window.showErrorMessage(`Failed to add bundle: ${err.stderr}`);
                this.logger.error(err);
              });
          },
        ),

        //
        // Remove Bundle
        //
        commands.registerCommand(
          "apama.apamaToolRemoveBundle",
          async (bundle?: BundleItem) => {
            // If bundle is not provided (called from Command Palette), prompt user to select a project and bundle
            if (!bundle) {
              // First, select a project
              const project = await this.promptForProject("Select a project to remove a bundle from");
              if (!project) {
                return; // User cancelled the project selection
              }
              
              // Then, get the bundles for that project
              try {
                const bundles = await project.getBundlesFromProject();
                
                if (bundles.length === 0) {
                  window.showInformationMessage(`No bundles found in project ${project.label}`);
                  return;
                }
                
                // Create items for quick pick
                const bundleItems = bundles.map(bundle => ({
                  label: bundle.label,
                  bundle: bundle
                }));
                
                // Show quick pick to select a bundle
                const selected = await window.showQuickPick(bundleItems, {
                  placeHolder: "Select a bundle to remove"
                });
                
                // If user cancelled, return
                if (!selected) {
                  return;
                }
                
                bundle = selected.bundle;
              } catch (error) {
                window.showErrorMessage(`Failed to get bundles: ${error}`);
                return;
              }
            }
            
            const apamaProjectCommand = await getCommandLine(ApamaExecutables.PROJECT);
            if (!apamaProjectCommand) {return Promise.resolve();}
            const apama_project = new ApamaRunner(
              "apama_project",
              apamaProjectCommand
            );

            apama_project
              .run(bundle.fsDir, ["remove", "bundle", '"' + bundle.label + '"'])
              .then((result) => {
                window.showInformationMessage(`${result.stdout}`);
              })
              .catch((err) => window.showErrorMessage(`${err.stderr}`));
          },
        ),
        //
        // Placeholder for clicking on a bundle/project - will open files possibly or navigate to the right directory.
        //
        commands.registerCommand(
          "apama.SelectItem",
          (_document: TextDocument) => {
            //this.logger.appendLine(document.fileName);
            return;
          },
        ),

        //
        // refresh projects
        //
        commands.registerCommand("apama.refreshProjects", () => {
          this.refresh();
        }),
      ]);
    }
  }

  /**
   * Helper method to prompt the user to select a project
   * Used when commands are invoked from the Command Palette without a project context
   */
  private async promptForProject(placeHolder: string): Promise<ApamaProject | undefined> {
    // Make sure projects are initialized
    await this.initializeProjects();
    
    // If no projects found, show error message
    if (this.projects.length === 0) {
      window.showErrorMessage("No Apama projects found in the workspace");
      return undefined;
    }
    
    // If only one project, return it directly
    if (this.projects.length === 1) {
      return this.projects[0];
    }
    
    // Create items for quick pick
    const projectItems = this.projects.map(project => ({
      label: project.label,
      description: project.fsDir,
      project: project
    }));
    
    // Show quick pick to select a project
    const selected = await window.showQuickPick(projectItems, {
      placeHolder: placeHolder
    });
    
    // Return the selected project or undefined if cancelled
    return selected ? selected.project : undefined;
  }
  
  /** Initialize projects from workspaces */
  async initializeProjects(): Promise<void> {
    const apamaProjectCommand = await getCommandLine(ApamaExecutables.PROJECT, false);
    if (!apamaProjectCommand) {return Promise.resolve();}
    const apama_project = new ApamaRunner(
      "apama_project",
      apamaProjectCommand
    );

    // Clear existing projects
    this.projects = [];
    
    // Dynamically get current workspace folders
    const workspaceFolders = workspace.workspaceFolders;
    
    // If no workspace folders are open, return empty projects
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return;
    }
    
    // Scan for projects in each workspace
    for (const ws of workspaceFolders) {
      // Check this workspace folder for a project at its root
      const project = await ApamaProject.scanProjects(
        this.logger,
        ws,
        apama_project,
        this.context.asAbsolutePath("resources")
      );

      // If a project was found (not undefined), add it to the list
      if (project) {
        this.projects.push(project);
      }
    }
  }

  //
  // Trigger refresh of the tree
  //
  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  //
  // get the children of the current item (group or item)
  // made this async so we can avoid race conditions on updates
  //
  async getChildren(
    item?: BundleItem | ApamaProject | undefined,
  ): Promise<
    undefined | BundleItem[] | ApamaProject[]
  > {
    //if this is a bundle - then there are no children
    if (item && item.contextValue === "bundle") {
      if (item.items.length === 0) {
        return Promise.resolve([]);
      } else {
        return Promise.resolve(item.items);
      }
    }
    
    //if this is a project - we should have set up the bundles now
    if (item instanceof ApamaProject) {
      //lets get the bundles
      item.items = await item.getBundlesFromProject();
      return Promise.resolve(item.items);
    } else {
      await this.initializeProjects();
      return Promise.resolve(this.projects);
    }
  }

  //
  // interface requirement
  //
  getTreeItem(element: BundleItem | ApamaProject): TreeItem {
    //No string nodes in my tree so should never happen
    if (typeof element === "string") {
      //this.logger.appendLine("ERROR ???? getTreeItem -- " + element.toString());
      return new TreeItem(element, TreeItemCollapsibleState.None);
    }

    //should just be the element clicked on
    return <TreeItem>element;
  }
}
