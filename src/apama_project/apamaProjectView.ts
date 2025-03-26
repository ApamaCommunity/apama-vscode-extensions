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
  ApamaEnvironment,
  ApamaExecutables,
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
  private apama_project: ApamaRunner;
  private apama_deploy: ApamaRunner;

  //
  // Added facilities for multiple workspaces - this will hopefully allow
  // ssh remote etc to work better later on, plus allows some extra organisational
  // facilities....
  constructor(
    private apamaEnv: ApamaEnvironment,
    private logger: Logger,
    private workspaces: WorkspaceFolder[],
    private context: ExtensionContext,
  ) {
    const subscriptions: Disposable[] = [];

    this.apama_project = new ApamaRunner(
      "apama_project",
      apamaEnv.getCommandLine(ApamaExecutables.PROJECT),
    );
    this.apama_deploy = new ApamaRunner(
      "apama_deploy",
      apamaEnv.getCommandLine(ApamaExecutables.DEPLOY),
    );
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
          "extension.apamaProjects.apamaToolCreateProject",
          () => {
            if (workspace.rootPath !== undefined) {
                this.apama_project
                  .run(workspace.rootPath, ["create", '.'])
                  .then((result) => {
                    window.showInformationMessage(result.stdout);
                    this.logger.info(result);
                  })
                  .catch((err) => {
                    window.showErrorMessage(err.stderr);
                    this.logger.error(err);
              });
            }
          },
        ),

        //
        // Add Bundle
        //
        commands.registerCommand(
          "extension.apamaProjects.apamaToolAddBundles",
          (project: ApamaProject) => {
            this.apama_project
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

                this.apama_project
                  .run(project.fsDir, [
                    "add",
                    "bundle",
                    '"' + picked.label.trim() + '"',
                  ])
                  .then((result) =>
                    window.showInformationMessage(`${result.stdout}`),
                  )
                  .catch((err) => window.showErrorMessage(`${err}`));
              })
              .catch((err) => window.showErrorMessage(`${err}`));
          },
        ),

        //
        // Remove Bundle
        //
        commands.registerCommand(
          "extension.apamaProjects.apamaToolRemoveBundle",
          (bundle: BundleItem) => {
            this.apama_project
              .run(bundle.fsDir, ["remove", "bundle", '"' + bundle.label + '"'])
              .then((result) =>
                window.showInformationMessage(`${result.stdout}`),
              )
              .catch((err) => window.showErrorMessage(`${err}`));
          },
        ),

        //
        // Placeholder for clicking on a bundle/project - will open files possibly or navigate to the right directory.
        //
        commands.registerCommand(
          "extension.apamaProjects.SelectItem",
          (_document: TextDocument) => {
            //this.logger.appendLine(document.fileName);
            return;
          },
        ),

        //
        // refresh projects
        //
        commands.registerCommand("extension.apamaProjects.refresh", () => {
          this.refresh();
        }),
      ]);
    }
  }
  
  /** Initialize projects from workspaces */
  async initializeProjects(): Promise<void> {
    this.logger.info("Initializing projects");
    // Clear existing projects
    this.projects = [];
    
    // Scan for projects in each workspace
    for (const ws of this.workspaces) {
      const workspaceProjects = await ApamaProject.scanProjects(
        this.logger,
        ws,
        this.apama_project,
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
    this.logger.info("getChildren() called")
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
