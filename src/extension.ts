"use_strict";

import * as os from 'os';
import * as path from 'path';

import { ExtensionContext, Disposable, tasks, debug, workspace, WorkspaceConfiguration} from 'vscode';

import {
	Executable,
	LanguageClient, LanguageClientOptions,
	TransportKind
} from 'vscode-languageclient/node';


import { ApamaEnvironment } from './apama_util/apamaenvironment';
import { ApamaTaskProvider } from './apama_util/apamataskprovider';
import { ApamaDebugConfigurationProvider } from './apama_debug/apamadebugconfig';
import { ApamaProjectView } from './apama_project/apamaProjectView';
import { ApamaCommandProvider } from './apama_util/commands';
import { Logger } from './logger/logger';

import { ExecutableResolver } from './settings/ExecutableResolver';

let languageClient : LanguageClient;
const logger = new Logger('ApamaCommunity.apama-extensions');

export async function activate(context: ExtensionContext): Promise<void> {
	/**
	 * Extension entry point.
	 */
	const commands: Disposable[] = [];

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
		logger.info(`Found the correaltor at ${resolve.path}`)
	} else {
		logger.info(`Could not find Apama in your environment: you can configure the "Apama Home" preference to specify an install location.`);
		return Promise.resolve();
	}

	// Gives the directory of $APAMA_HOME/bin.
	const apamaBin = path.dirname(resolve.path);
	
	createLanguageServer(config, apamaBin);

	const apamaEnv: ApamaEnvironment = new ApamaEnvironment(apamaBin);
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

async function createLanguageServer(config: WorkspaceConfiguration, apamaBinPath: string): Promise<null> {
	/**
	 * Spawns a language server, and then proceeds to connect the language client up to it.
	 */
	const lsType: string | undefined = config.get<string>("type");
	if (lsType === "disabled") {
		return Promise.reject("Apama Language Server disabled");
	}

	let commandStr;
	let args;
	if (os.platform() == "win32") {
		commandStr = `${apamaBinPath}/eplbuddy.exe`
		args = ['-s']
	} else {
		commandStr = `${apamaBinPath}/apama_env`
		args = [`eplbuddy`, "-s"]
	}

	const serverOptions: Executable = {
		transport: TransportKind.stdio,
		command: commandStr,
		args: args
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
	languageClient = new LanguageClient('apamaLanguageClient', `Apama Language Client`, serverOptions, clientOptions);
	await languageClient.start();
	return null;
}

export function deactivate() { 
	return Promise.all([
		languageClient.stop(),
	]);
}
