"use_strict";

import * as net from 'net';

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

import * as semver from 'semver';

let client : LanguageClient;

//
// client activation function, this is the entrypoint for the client
//
export async function activate(context: ExtensionContext): Promise<void> {
	const commands: Disposable[] = [];

	const logger = new Logger('ApamaCommunity.apama-extensions');

	logger.appendLine('Started EPL Extension');
	
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

	//EPL Applications view is still WIP - needs more work 
	//const c8yView = new CumulocityView(apamaEnv, logger, context);


	// Checks that the specified correlator version is above 10.5.3 before attempting to 
	// connect to the language server.
	let corrVersion = "";
	const versionCmd = new ApamaRunner("version", apamaEnv.getCorrelatorCmdline());
	versionCmd.run(".", ["--version"]).then( version => {
		const versionlines = version.stdout.split('\n');
		const pat = new RegExp(/correlator\sv(\d+\.\d+\.\d+)\.\d+\.\d+/);
		for (let index = 0; index < versionlines.length; index++) {
			const line = versionlines[index];
			if (pat.test(line)) {
				corrVersion = RegExp.$1;
			}
		}

		if (semver.lt(corrVersion, '10.5.3')) {
			logger.appendLine(`Version: ${corrVersion} doesn't support the Apama Language Server - Skipping`);
		}
		else {
			const config = workspace.getConfiguration("apama.langserver");
			createLangServerTCP(apamaEnv, config, logger);
		}
	})
	
	// Push the disposable to the context's subscriptions so that the 
	// client can be deactivated on extension deactivation
	commands.forEach(command => context.subscriptions.push(command));

	return Promise.resolve();
}


// This method connects to an existing language server running. 
// It used to spawn a language server, but it did so inconsistently depending on configuration,
// and in an unorthodox manner.
async function createLangServerTCP(apamaEnv: ApamaEnvironment, config: WorkspaceConfiguration, logger: Logger): Promise<LanguageClient> {
	const lsType: string | undefined = config.get<string>("type");
	if (lsType === "disabled") {
		return Promise.reject("Apama Language Server disabled");
	}

	const serverOptions: ServerOptions = () => {
		return new Promise((resolve) => {
			const clientSocket = new net.Socket();
			clientSocket.connect(config.port, config.host, () => {
				logger.debug(`Connected to socket at: ${config.host}:${config.port}`)
				resolve({
					reader: clientSocket,
					writer: clientSocket,
				});
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



