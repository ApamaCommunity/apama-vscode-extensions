import {
  TreeItem,
  TreeItemCollapsibleState,
  WorkspaceFolder,
  Uri,
  workspace,
} from "vscode";
import * as path from "path";
import { ApamaRunner } from "../apama_util/apamarunner";
import { Logger } from "../logger/logger";

export interface ApamaTreeItem {
  logger: Logger;
  label: string;
  fsDir: string;
  items: ApamaTreeItem[];
  contextValue: string;
  instance: boolean;
  ws: WorkspaceFolder;
  apama_project: ApamaRunner;
  resourceDir: string;
}

export class ApamaProject extends TreeItem implements ApamaTreeItem {
  constructor(
    public logger: Logger,
    public readonly label: string,
    public readonly fsDir: string,
    public ws: WorkspaceFolder,
    public apama_project: ApamaRunner,
    public resourceDir: string,
  ) {
    super(label, TreeItemCollapsibleState.Collapsed);
  }
  items: BundleItem[] = [];
  contextValue = "project";
  instance = false;

  /**
   * See if the given folder is a project.
   * @param logger 
   * @param ws 
   * @param apama_project 
   * @param resourceDir 
   * @returns 
   */
  static async scanProjects(
    logger: Logger,
    ws: WorkspaceFolder,
    apama_project: ApamaRunner,
    resourceDir: string
  ): Promise<ApamaProject | undefined> {
    // Check if .dependencies file exists directly in the root of the given workspace folder
    const dependenciesPath = Uri.joinPath(ws.uri, ".dependencies");

    try {
      await workspace.fs.stat(dependenciesPath); // Check if .dependencies exists in the root
      logger.info(
        `Found Apama project (.dependencies) in root of: ${ws.uri.fsPath}`,
      );

      // If stat succeeds, the file exists - create the project object for this workspace folder
      const project = new ApamaProject(
        logger,
        ws.name, // Use workspace folder name as project label
        ws.uri.fsPath, // Use workspace folder path as project directory
        ws,
        apama_project,
        resourceDir,
      );
      return project; // Return the single project for this workspace

    } catch {
      // If stat fails (e.g., file not found), this workspace folder is not an Apama project root
      logger.debug(
        `No .dependencies file found in root of ${ws.uri.fsPath}. Not treating as Apama project.`,
      );
      return undefined; // Return undefined, indicating no project found for this workspace
    }
  }

  //
  // Use apama project tool to populate ApamaProject objects list of Bundles
  //
  async getBundlesFromProject(): Promise<BundleItem[]> {
    const items: BundleItem[] = [];
    const result = await this.apama_project.run(this.fsDir, [
      "list",
      "bundles",
    ]);
    let withinInstalledRegion = false;
    const lines: string[] = result.stdout.split(/\r?\n/);
    let previousBundle: BundleItem;
    lines.forEach((item) => {
      //skipped until "Bundles that have already been added:"
      //Then processes until "Bundles that can be added:"
      //indentation implies bundle and instance
      if (
        withinInstalledRegion &&
        item.search("Bundles that can be added:") === -1
      ) {
        if (item.length > 0) {
          //on the raw string, count the indentation
          let current = item.trimEnd();
          let indentation = current.length;
          current = item.trimStart();
          indentation = indentation - current.length;

          if (indentation === 12) {
            previousBundle.instance = true; //TODO : this is wrong the thing im creating here is an instance...
            previousBundle.items.push(
              new BundleItem(
                this.logger,
                current,
                this.fsDir,
                this.ws,
                this.apama_project,
                this.resourceDir,
              ),
            );
          } else {
            if (previousBundle !== undefined) {
              items.push(previousBundle);
            }
            //this.logger.appendLine(`Creating : ${current}`);
            previousBundle = new BundleItem(
              this.logger,
              current,
              this.fsDir,
              this.ws,
              this.apama_project,
              this.resourceDir,
            );
          }
        }
      } else {
        //hacky way to capture the installed bundles.
        if (item.search("Bundles that have already been added:") > -1) {
          withinInstalledRegion = true;
        } else if (item.search("Bundles that can be added:") > -1) {
          //if we have dropped out add the last bundle
          if (previousBundle !== undefined) {
            //this.logger.appendLine(`Adding : ${previousBundle.label}`);
            items.push(previousBundle);
          }
          withinInstalledRegion = false;
        }
      }
    });
    //this.logger.appendLine(`Bundles Added : ${this.label} => ${items.length}`);
    return items;
  }

  iconPath = {
    light: path.join(this.resourceDir, "light", "project.svg"),
    dark: path.join(this.resourceDir, "dark", "project.svg"),
  };
}

export class BundleItem extends TreeItem implements ApamaTreeItem {
  constructor(
    public logger: Logger,
    public readonly label: string,
    public fsDir: string,
    public ws: WorkspaceFolder,
    public apama_project: ApamaRunner,
    public resourceDir: string,
  ) {
    super(label, TreeItemCollapsibleState.Collapsed);
  }

  items: BundleItem[] = [];
  contextValue = "bundle";
  instance = false;
  collapsibleState: TreeItemCollapsibleState | undefined = TreeItemCollapsibleState.None;

  iconPath = {
    light: path.join(this.resourceDir, "light", "code.svg"),
    dark: path.join(this.resourceDir, "dark", "code.svg"),
  };
}
