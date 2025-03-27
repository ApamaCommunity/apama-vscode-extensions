"use_strict";

import * as path from "path";

import {
  ExtensionContext,
  Disposable,
  tasks,
  debug,
  workspace,
  WorkspaceConfiguration,
} from "vscode";

import {
  Executable,
  LanguageClient,
  LanguageClientOptions,
  TransportKind,
} from "vscode-languageclient/node";

import {
  ApamaEnvironment,
  ApamaExecutableInterface,
  ApamaExecutables,
} from "./apama_util/apamaenvironment";
import { ApamaTaskProvider } from "./apama_util/apamataskprovider";
import { ApamaDebugConfigurationProvider } from "./apama_debug/apamadebugconfig";
import { ApamaProjectView } from "./apama_project/apamaProjectView";
import { ApamaCommandProvider } from "./apama_util/commands";
import { Logger } from "./logger/logger";

import { ExecutableResolver } from "./settings/ExecutableResolver";

let languageClient: LanguageClient;
const logger = new Logger("ApamaCommunity.apama-extensions");

/**
 * Extension entry point.
 */
export async function activate(context: ExtensionContext): Promise<void> {
  const commands: Disposable[] = [];

  logger.appendLine("Started EPL Extension");

  const config = workspace.getConfiguration("apama");
  const userApamaHome = config.get("apamaHome");

  // See if we can find a correlator.
  const correlatorResolver = new ExecutableResolver("correlator", logger);
  const eplbuddyResolver = new ExecutableResolver("eplbuddy", logger);

  let correlatorResolve;
  let eplbuddyResolve;
  if (userApamaHome != undefined) {
    // If the user has specified an Apama Home, we only use that.
    correlatorResolve = await correlatorResolver.resolve(
      path.join(userApamaHome as string, "bin"),
    );
    eplbuddyResolve = await eplbuddyResolver.resolve(
      path.join(userApamaHome as string, "bin"),
    );
  } else {
    correlatorResolve = await correlatorResolver.resolve();
    eplbuddyResolve = await eplbuddyResolver.resolve();
  }

  if (correlatorResolve.kind == "success") {
    logger.info(`Found the correlator at ${correlatorResolve.path}`);
  } else {
    logger.info(
      `Could not find Apama in your environment: you can configure the "Apama Home" preference to specify an install location.`,
    );
    return Promise.resolve();
  }

  // Gives the directory of $APAMA_HOME/bin.
  const apamaBin = path.dirname(correlatorResolve.path);
  const apamaEnv: ApamaEnvironment = new ApamaEnvironment(apamaBin);

  if (eplbuddyResolve.kind == "success") {
    createLanguageServer(
      config,
      apamaEnv.getCommandAsInterface(ApamaExecutables.EPLBUDDY),
    );
  } else {
    logger.info(
      "Could not find eplbuddy, will not be launching Language Server.",
    );
  }

  const taskprov = new ApamaTaskProvider(logger, apamaEnv);
  context.subscriptions.push(tasks.registerTaskProvider("apama", taskprov));

  const provider = new ApamaDebugConfigurationProvider(logger, apamaEnv);
  context.subscriptions.push(
    debug.registerDebugConfigurationProvider("apama", provider),
  );
  context.subscriptions.push(provider);
  const commandprov = new ApamaCommandProvider(logger, apamaEnv, context);
  commands.push(commandprov);

  //this needs a workspace folder which under some circumstances can be undefined.
  //but we can ignore in that case and things shjould still work
  if (workspace.workspaceFolders !== undefined) {
    const myClonedArray = [...workspace.workspaceFolders];
    const projView = new ApamaProjectView(
      apamaEnv,
      logger,
      myClonedArray,
      context,
    );
    projView.refresh();
  }

  // Push the disposable to the context's subscriptions so that the
  // client can be deactivated on extension deactivation
  commands.forEach((command) => context.subscriptions.push(command));

  return Promise.resolve();
}

/**
* Creates a Language Client instance for eplbuddy.
*/
async function createLanguageServer(
  config: WorkspaceConfiguration,
  eplBuddyCommand: ApamaExecutableInterface,
): Promise<void> {
    const lsType: string | undefined = config.get<string>("type");
  if (lsType === "disabled") {
    return Promise.reject("Apama Language Server disabled");
  }

  const serverOptions: Executable = {
    transport: TransportKind.stdio,
    command: eplBuddyCommand.command,
    args: [...eplBuddyCommand.args, "-s"],
  };

  const initializationOptions = {
    "logLevels": (config.get<string>("logLevels", "").length > 0 ? config.get<string>("logLevels", "").split(",") : [])
  }

  // TODO: to support multiple folders per workspace, spin up separate LanguageClient instances for 
  // each one (as per https://github.com/microsoft/vscode-extension-samples/blob/main/lsp-multi-server-sample/client/src/extension.ts)

  // Options of the language client
  const clientOptions: LanguageClientOptions = {
    // Activate the server for epl files
    documentSelector: ["epl"],
    initializationOptions: initializationOptions,
    synchronize: {
      // Synchronize the section 'eplLanguageServer' of the settings to the server
      configurationSection: "eplLanguageServer",
      // Notify the server about file changes to epl files contained in the workspace
      // need to think about this
      fileEvents: workspace.createFileSystemWatcher("**/.mon"), // TODO: is this really needed or does it happen automatically when opening files?
    },
  };

  // TODO: we should really reload this if the APAMA_HOME config changes
  languageClient = new LanguageClient(
    "apamaLanguageClient",
    `Apama Language Client`,
    serverOptions,
    clientOptions,
  );
  await languageClient.start();
  return Promise.resolve();
}

export function deactivate() {
  return Promise.all([languageClient.stop()]);
}
