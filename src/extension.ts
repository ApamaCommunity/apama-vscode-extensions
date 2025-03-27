"use_strict";

import * as path from "path";

import {
  ExtensionContext,
  Disposable,
  tasks,
  debug,
  workspace,
  WorkspaceConfiguration,
  Memento,
  window
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

/** VSCode clients for talking to each language server, keyed by workspace folder URI */
const servers = new Map<string, LanguageClient>();

const logger = new Logger("Apama Extension Client");

/** The ExtensionContext.globalState */
let globalState: Memento;

/**
 * Extension entry point.
 */
export async function activate(context: ExtensionContext): Promise<void> {
  globalState = context.globalState;
  const commands: Disposable[] = [];

  logger.appendLine("Started Apama Extension");

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
    startLanguageServers(
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

  const projView = new ApamaProjectView(
    apamaEnv,
    logger,
    context,
  );
  projView.refresh();

  // Push the disposable to the context's subscriptions so that the
  // client can be deactivated on extension deactivation
  commands.forEach((command) => context.subscriptions.push(command));

  return Promise.resolve();
}

/** Start language servers (eplbuddy) for each workspace folder */
async function startLanguageServers(
  config: WorkspaceConfiguration,
  eplBuddyCommand: ApamaExecutableInterface,
): Promise<void> {
    const lsType: string | undefined = config.get<string>("type");
  if (lsType === "disabled") {
    return Promise.reject("Apama Language Server disabled");
  }

  const serverOptions: Executable = {
    transport: TransportKind.stdio, // passes the "--stdio" option implicitly
    command: eplBuddyCommand.command,
    args: [...eplBuddyCommand.args, "-s"], // "-s" is just for backwards compat with pre-10.15.6.2 eplbuddy
  };

  const initializationOptions = {
    // Copy the "apama.server" config directly to the server using this (undocumented) option, so we can configure undocumented or newly added features
    ...config.get<object>("languageServer")
  };
  // We could also assign any top-level settings we want to here as well

  // TODO: to implement folder change detection, remove existing clients that do not match any current workspace folder AND if there was a singleton and now isn't restart it 
  // since it needs a different documentSelector pattern

  if (workspace.workspaceFolders) {
    let serverVersion = undefined;
    for (const folder of workspace.workspaceFolders)
    {
      // These APIs aren't really documented, but what's going on here is we're creating an instance of 
      // the client from https://github.com/microsoft/vscode-languageserver-node/tree/main which 
      // uses the VSCode API to implement the client/glue to our language server executable

      // Options of the language client
      const clientOptions: LanguageClientOptions = {
        // Activate the server for epl files under this folder
        // If there's just one workspace (the common case), do not filter at all, which allows us to edit individual files from 
        // outside the workspace (e.g. testcase .mon files) and get semantic checking of them while the file is open 
        // (no way to make that work sanely with multiple roots, so don't bother)
        documentSelector: [{language:"apamaepl", scheme:"file", pattern: 
          workspace.workspaceFolders.length == 1 ? undefined :`${folder.uri.fsPath}/**/*`}],
        initializationOptions: initializationOptions,
        workspaceFolder: folder,
      };

      // TODO: we should really reload this if the APAMA_HOME config changes
      const languageClient = new LanguageClient(
        "apamaLanguageClient",
        `Apama Lang Server [${folder.name}]`,
        serverOptions,
        clientOptions,
      );
      servers.set(folder.uri.toString(), languageClient);
      await languageClient.start();
      serverVersion = languageClient.initializeResult?.serverInfo?.version;
    }

    // We won't keep incrementing this forever - this is to just nudge people towards the latest Apama version that has "decent" VSCode support 
    // to give the best impression of what this extension can do. 
    // Currently 10.15.6.1 is the best, but we will likely end up resting on 10.15.6.2 or .3.
    if (!serverVersion || ["10.15.6.0"].includes(serverVersion)) { 
      logger.warn(`Old Apama version detected: ${serverVersion}`);
      if (!globalState.get<boolean>("apama.alreadyShownNotification.oldApama")) {
        globalState.update("apama.alreadyShownNotification.oldApama", true);
        window.showInformationMessage("You are using an old version - consider installing the latest Apama version to get a better experience in Visual Studio Code");
      }
    }
  }

  return Promise.resolve();
}

export function deactivate(): Thenable<void> {
  const promises: Thenable<void>[] = [];
  for (const client of servers.values()) {
    promises.push(client.stop());
  }
  servers.clear();
  return Promise.all(promises).then(() => undefined);
}
