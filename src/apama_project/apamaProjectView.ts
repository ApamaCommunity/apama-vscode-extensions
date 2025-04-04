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

    //this file is created/updated/deleted as projects come and go and depends on the "current" set of file systems
    this.fsWatcher = workspace.createFileSystemWatcher("**/*.dependencies");
    //but for deletions of the entire space we need
    this.delWatcher = workspace.createFileSystemWatcher("**/*"); //if you delete a directory it will not trigger all contents
    //handlers
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

  registerCommands(): void {
    if (this.context !== undefined) {
      this.context.subscriptions.push.apply(this.context.subscriptions, [
        
        /** Create project */
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

        //
        // Add Bundle
        //
        commands.registerCommand(
          "apama.apamaToolAddBundles",
          async (project: ApamaProject) => {
            const apamaProjectCommand = await getCommandLine(ApamaExecutables.PROJECT);
            if (!apamaProjectCommand) {return Promise.resolve();}
            const apama_project = new ApamaRunner(
              "apama_project",
              apamaProjectCommand
            );

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
                    );
                    displayList.push({ label: item });
                  }
                });
                return window.showQuickPick(displayList, {
                  placeHolder: "Choose a bundle to add",
                });
              })
              .then((picked) => {
                if (picked === undefined) {
                  return;
                }

                apama_project
                  .run(project.fsDir, [
                    "add",
                    "bundle",
                    '"' + picked.label.trim() + '"',
                  ])
                  .then((result) =>
                    window.showInformationMessage(`${result.stdout}`),
                  )
                  .catch((err) => window.showErrorMessage(`${err.stderr}`));
              })
              .catch((err) => window.showErrorMessage(`${err.stderr}`));
          },
        ),

        //
        // Remove Bundle
        //
        commands.registerCommand(
          "apama.apamaToolRemoveBundle",
          async (bundle: BundleItem) => {
            const apamaProjectCommand = await getCommandLine(ApamaExecutables.PROJECT);
            if (!apamaProjectCommand) {return Promise.resolve();}
            const apama_project = new ApamaRunner(
              "apama_project",
              apamaProjectCommand
            );


            apama_project
              .run(bundle.fsDir, ["remove", "bundle", '"' + bundle.label + '"'])
              .then((result) =>
                window.showInformationMessage(`${result.stdout}`),
              )
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
  
  /** Initialize projects from workspaces */
  async initializeProjects(): Promise<void> {
    this.logger.info("Initializing projects");

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
      const workspaceProjects = await ApamaProject.scanProjects(
        this.logger,
        ws,
        apama_project,
        this.context.asAbsolutePath("resources")
      );

      this.projects.push(...workspaceProjects);
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
