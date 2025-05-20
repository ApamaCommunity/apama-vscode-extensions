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
        name: "Debug Apama application with local Correlator process",
        request: "launch",
        correlator: {
          port: config.get("debugPort"),
          host: config.get("debugHost"),
          args: this.getDefaultArgs(),
        },
      },
    ];
  }

  getDefaultArgs(): string[] {
    return [
            "-g", // nooptimize - to make debugging possible
            "--logQueueSizePeriod", "60" // increase frequency of Status lines to once per minute to avoid spamming the output window
    ];
  }

  async getCorrelatorHost(config: DebugConfiguration): Promise<string> 
  {
    if (config.correlator && typeof config.correlator.host === "string" && config.correlator.host.trim() !== "") {
      return config.correlator.host;
    }
    const vscodeHost = workspace.getConfiguration("apama").get<string>("debugHost");
    if (vscodeHost && vscodeHost.trim() !== "") {
      return vscodeHost;
    }
    if (config.remote && config.remote.host && config.remote.host.startsWith("ssh-remote+")) {
      // TODO: this doesn't work in all cases, e.g. behind a proxy. Would need to run a command (hostname, or grep the correlator output) 
      // on the remote machine to get this accurately. Until then, users must workaround by setting it as a configuration setting
      return config.remote.host.replace("ssh-remote+", "");
    }
    return "127.0.0.1";
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
      this.logger.info("Creating default debug configuration");
      config.type = "apama";
      config.name = "Debug Apama Correlator Application";
      config.request = "launch";
      config.injectionList = await getInjectionList(folder.uri.fsPath);
      config.correlator = {};
      config.correlator.host = await this.getCorrelatorHost(config);
      config.correlator.port = workspace
        .getConfiguration("apama")
        .get("debugPort");
      config.correlator.args = this.getDefaultArgs();
    } else if (config.correlator && config.correlator.host == "") {
      config.correlator.host = await this.getCorrelatorHost(config); 
    }

    this.logger.info(`Resolving debug config: ${config.correlator.host}:${config.correlator.port}`);

    if (!this._server) {
      console.log("Starting listening debug server");
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
