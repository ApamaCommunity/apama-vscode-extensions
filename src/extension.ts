"use_strict";

import * as net from 'net';
import * as os from 'os';
import * as path from 'path';

import { ExtensionContext, Disposable, tasks, debug, workspace, WorkspaceConfiguration} from 'vscode';

import {
	LanguageClient, LanguageClientOptions, ServerOptions
} from 'vscode-languageclient/node';


import { ApamaEnvironment } from './apama_util/apamaenvironment';
import { ApamaTaskProvider } from './apama_util/apamataskprovider';
import { ApamaDebugConfigurationProvider } from './apama_debug/apamadebugconfig';
import { ApamaProjectView } from './apama_project/apamaProjectView';
import { ApamaCommandProvider } from './apama_util/commands';//MY CHANGES
import { ApamaRunner } from './apama_util/apamarunner';
import { Logger } from './logger/logger';
//import { CumulocityView } from './c8y/cumulocityView';

import { ExecutableResolver } from './settings/ExecutableResolver';
import { spawn } from 'child_process';

let client : LanguageClient;

export async function activate(context: ExtensionContext): Promise<void> {
	/**
	 * Extension entry point.
	 */
	const commands: Disposable[] = [];

	const logger = new Logger('ApamaCommunity.apama-extensions');
	logger.appendLine('Started EPL Extension');

	const config = workspace.getConfiguration('apama');
	const userApamaHome = config.get('apamaHome');

	// See if we can find a correlator.
	const executableResolver = new ExecutableResolver("correlator", logger)

	let resolve; 
	if (userApamaHome != undefined) {
		// If the user has specified an Apama Home, we only use that.
		resolve = await executableResolver.resolve(path.join(userApamaHome as string, "bin"));
	} else {
		resolve = await executableResolver.resolve();
	}

	if (resolve.kind == "success") {
		logger.info(`executableResolve.resolve(): ${resolve.path}`)
	} else {
		logger.info(`Could not find Apama on system`);
		return Promise.resolve();
	}

	const apamaEnv: ApamaEnvironment = new ApamaEnvironment();
	const taskprov = new ApamaTaskProvider(logger, apamaEnv);
	context.subscriptions.push(tasks.registerTaskProvider("apama", taskprov));

	const provider = new ApamaDebugConfigurationProvider(logger, apamaEnv);
	context.subscriptions.push(debug.registerDebugConfigurationProvider('apama', provider));
	context.subscriptions.push(provider);
	const commandprov = new ApamaCommandProvider(logger, apamaEnv, context);
	commands.push(commandprov);

	//this needs a workspace folder which under some circumstances can be undefined. 
	//but we can ignore in that case and things shjould still work
	if (workspace.workspaceFolders !== undefined) {
		const myClonedArray = [...workspace.workspaceFolders];
		const projView = new ApamaProjectView(apamaEnv, logger, myClonedArray, context);
		projView.refresh();
	}

	// Push the disposable to the context's subscriptions so that the 
	// client can be deactivated on extension deactivation
	commands.forEach(command => context.subscriptions.push(command));

	return Promise.resolve();
}


// This method connects to an existing language server running. 
// It used to spawn a language server, but it did so inconsistently depending on configuration,
// and in an unorthodox manner.
async function createLangServerTCP(config: WorkspaceConfiguration, logger: Logger, apamaEnvPath: string): Promise<LanguageClient> {
	const lsType: string | undefined = config.get<string>("type");
	if (lsType === "disabled") {
		return Promise.reject("Apama Language Server disabled");
	}

	const serverOptions: ServerOptions = () => {
		return new Promise((resolve) => {
			const proc = spawn(apamaEnvPath, ["eplbuddy", "-l"]);

			proc.stdout.on('data', (data) => {
				logger.info(`stdout: ${data}`);

				if (data.toString().startsWith("Listening on")) {
					const clientSocket = new net.Socket();
					// Set an error handler
					clientSocket.on('error', (error) => {
						logger.error(`Socket connection error: ${error.message}`);
					});

					clientSocket.connect(30030, "127.0.0.1", () => {
						logger.debug(`Connected to socket at: ${config.port}`)
						resolve({
							reader: clientSocket,
							writer: clientSocket,
						});
					});
				}
			});

			proc.stderr.on('data', (data) => {
				logger.info(`stderr: ${data}`);
			});
			proc.on('error', (error) => {
				logger.info(`Error: ${error}`);
			});
		});
	};

	// Options of the language client
	const clientOptions: LanguageClientOptions = {
		// Activate the server for epl files
		documentSelector: ['epl'],
		synchronize: {
			// Synchronize the section 'eplLanguageServer' of the settings to the server
			configurationSection: 'eplLanguageServer',
			// Notify the server about file changes to epl files contained in the workspace
			// need to think about this
			fileEvents: workspace.createFileSystemWatcher('**/.mon')
		}
	};

	client = new LanguageClient(`Apama Language Client (host ${config.host} port ${config.port})`, serverOptions, clientOptions);
	await client.start();
	return client;
}

// this method is called when your extension is deactivated
export function deactivate() : void { return; }



