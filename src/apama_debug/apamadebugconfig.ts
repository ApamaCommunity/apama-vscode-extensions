/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  WorkspaceFolder,
  DebugConfiguration,
  ProviderResult,
  CancellationToken,
  DebugConfigurationProvider,
  workspace,
} from "vscode";
import * as Net from "net";
import { execFileSync } from "child_process";
import {
  CorrelatorDebugSession,
  normalizeCorrelatorFilePath,
} from "./correlatorDebugSession";
import {
  ApamaExecutableInterface,
  ApamaExecutables,
  getCommandAsInterface
} from "../apama_util/apamaenvironment";
import { Logger } from "../logger/logger";

export class ApamaDebugConfigurationProvider
  implements DebugConfigurationProvider
{
  private _server?: Net.Server;

  constructor(
    private logger: Logger,
  ) {}

  /**
   *  Return an initial debug configuration
   */
  provideDebugConfigurations(
    folder: WorkspaceFolder | undefined,
    token?: CancellationToken,
  ): ProviderResult<DebugConfiguration[]> {
    const config = workspace.getConfiguration("apama");
    return [
      {
        type: "apama",
        name: "Debug Apama Application",
        request: "launch",
        correlator: {
          port: config.get("debugPort"),
          host: config.get("debugHost"),
          args: ["-g"],
        },
      },
    ];
  }

  /**
   * Add all missing config setting just before launch
   */
  async resolveDebugConfiguration(
    folder: WorkspaceFolder | undefined,
    config: DebugConfiguration,
    token?: CancellationToken,
  ): Promise<DebugConfiguration | undefined> {
    // Can't continue if there's no workspace
    if (!folder) {
      this.logger.appendLine("no folder");
      return undefined;
    }

    // // If an empty config has been provided (because there's no existing launch.json) then we can delegate to provideDebugConfigurations by returning
    // if (Object.keys(config).length === 0) {
    //     this.logger.appendLine("empty config");
    //     let configList= await this.provideDebugConfigurations(folder);
    //     if( configList )
    //     {
    //         config = Object.assign(configList[0]);
    //     }
    // }
    // if launch.json is missing or empty

    if (!config.type && !config.request && !config.name) {
      config.type = "apama";
      config.name = "Debug Apama Application";
      config.request = "launch";
      config.injectionList = await getInjectionList(folder.uri.fsPath);
      config.correlator = {};
      config.correlator.host = "127.0.0.1";
      config.correlator.port = workspace
        .getConfiguration("apama")
        .get("debugPort");
      config.correlator.args = ["-g"];
    }

    if (!this._server) {
      console.log("starting listening server");
      this._server = Net.createServer((socket) => {
        const session = new CorrelatorDebugSession(
          this.logger,
          config.correlator,
        );
        session.setRunAsServer(true);
        session.start(<NodeJS.ReadableStream>socket, socket);
      }).listen(0);
    } else {
      console.log("Reusing previous instance");
    }

    config.debugServer = (<Net.AddressInfo>this._server.address()).port;
    //config.debugServer = this._server.address();

    return config;
  }

  dispose(): void {
    if (this._server) {
      this._server.close();
    }
  }
}

async function getInjectionList(
  workspaceFolderPath: string,
): Promise<string[]> {
  const cmd = await getCommandAsInterface(ApamaExecutables.DEPLOY);
  if (!cmd) {return [];}
  
  const output: string = execFileSync(
    cmd.command,
    [...cmd.args, "--outputList", "stdout", workspaceFolderPath],
    {
      encoding: "utf8",
      shell: true
    },
  );

  //split the lines, remove blanks and then normalise for the correlator
  return output
    .split(/\r?\n/)
    .filter((filename) => filename !== "")
    .map(normalizeCorrelatorFilePath);
}
