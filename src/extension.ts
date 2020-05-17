"use_strict";

import * as net from 'net';
 
import * as vscode from 'vscode';

import {
	LanguageClient, LanguageClientOptions, ServerOptions,
	TransportKind, ForkOptions, MessageTransports
} from 'vscode-languageclient';


import { ApamaEnvironment } from './apama_util/apamaenvironment';
import { ApamaTaskProvider } from './apama_util/apamataskprovider';
import { ApamaDebugConfigurationProvider } from './apama_debug/apamadebugconfig';
import { ApamaProjectView } from './apama_project/apamaProjectView';
import { ApamaCommandProvider } from './apama_util/commands';//MY CHANGES
import { ApamaRunner } from './apama_util/apamarunner';
//import { CumulocityView } from './c8y/cumulocityView';

var semver = require('semver');

//
// client activation function, this is the entrypoint for the client
//
export async function activate(context: vscode.ExtensionContext): Promise<void> {
	let commands: vscode.Disposable[] = [];

	const logger = vscode.window.createOutputChannel('Apama Extension');
	logger.show();
	logger.appendLine('Started EPL Extension');

	let apamaEnv: ApamaEnvironment = new ApamaEnvironment(logger);
	const taskprov = new ApamaTaskProvider(logger, apamaEnv);
	context.subscriptions.push(vscode.tasks.registerTaskProvider("apama", taskprov));

	const provider = new ApamaDebugConfigurationProvider(logger, apamaEnv);

	context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('apama', provider));

	context.subscriptions.push(provider);

	const commandprov = new ApamaCommandProvider(logger, apamaEnv, context);

	//this needs a workspace folder which under some circumstances can be undefined. 
	//but we can ignore in that case and things shjould still work
	if (vscode.workspace.workspaceFolders !== undefined) {
		const projView = new ApamaProjectView(apamaEnv, logger, vscode.workspace.workspaceFolders, context);
	}

	//EPL Applications view is still WIP - needs more work 
	//const c8yView = new CumulocityView(apamaEnv, logger, context);

	//---------------------------------
	// Language server start-up and support
	//---------------------------------

	// Start the command in a shell - note that the current EPL buddy doesn't repond 
	// so this will fail until we do have a working lang-server app
	// https://github.com/Microsoft/vscode-languageserver-node/issues/358


	//If correlator version is >= 10.5.3 start with the connection to the server
	let corrVersion = "";
	let versionCmd = new ApamaRunner("version", apamaEnv.getCorrelatorCmdline(), logger);
	let version = await versionCmd.run(".",["--version"]);
	let versionlines = version.stdout.split('\n');
	const pat : RegExp = new RegExp(/correlator\sv(\d+\.\d+\.\d+)\.\d+\.\d+/);
	for (let index = 0; index < versionlines.length; index++) {
		const line = versionlines[index];
		if ( pat.test(line) ) {
			corrVersion = RegExp.$1;
		}
	}

	if( semver.lt(corrVersion , '10.5.3') )
	{
		logger.appendLine(`Version: ${corrVersion} doesn't support the Apama Language Server - Skipping`);
	}
	else
	{
		let config = vscode.workspace.getConfiguration("softwareag.apama.langserver");
		createLangServerTCP(apamaEnv, config, logger)
			.then( (ls) => {
				logger.appendLine(`Starting Language Client`);
				context.subscriptions.push(ls.start());
			})
			.catch( err => logger.appendLine( err ));
	}
	
	

	// Push the disposable to the context's subscriptions so that the 
	// client can be deactivated on extension deactivation
	commands.forEach(command => context.subscriptions.push(command));

	return Promise.resolve();
}


function runLangServer(apamaEnv: ApamaEnvironment, config : vscode.WorkspaceConfiguration ): vscode.Task {
	let correlator = new vscode.Task(
	  {type: "shell", task: ""},
	  "Apama Language Server",
	  "ApamaLanguageServer",
	  new vscode.ShellExecution(apamaEnv.getEplBuddyCmdline(),['-l',config.port.toString()]),
	  []
	);
	correlator.group = 'test';
	return correlator;
  }

//
// This method will start the lang server - requires Apama 10.5.3+ however 
// so this method will be gated on that version in the activate function above.
//
async function createLangServerTCP(apamaEnv: ApamaEnvironment, config : vscode.WorkspaceConfiguration , logger: vscode.OutputChannel): Promise<LanguageClient> {
	logger.appendLine(`Starting Language Server on (host ${config.host} port ${config.port})`);
	let lsType: string | undefined = config.get<string>("type");
	if(  lsType === "local"  ) {
		//default is to run the language server locally
		logger.appendLine(`Executing Apama language server`);
		let te = await vscode.tasks.executeTask(runLangServer(apamaEnv,config));
		logger.appendLine(`Started Language Server on (host ${config.host} port ${config.port})`);
	}
	else if (lsType === "disabled" )
	{
		return Promise.reject("Apama Language Server disabled");
	}
	//server options is a function that returns the client connection to the 
	//lang server
	const serverOptions: ServerOptions = () => {
		return new Promise((resolve, reject) => {
			const clientSocket = new net.Socket();
			clientSocket.connect(config.port, config.host, () => {
				resolve({
					reader: clientSocket,
					writer: clientSocket,
				});
			});
		});
	};

	// Options of the language client
	let clientOptions: LanguageClientOptions = {
		// Activate the server for epl files
		documentSelector: ['epl'],
		synchronize: {
			// Synchronize the section 'eplLanguageServer' of the settings to the server
			configurationSection: 'eplLanguageServer',
			// Notify the server about file changes to epl files contained in the workspace
			// need to think about this
			// fileEvents: workspace.createFileSystemWatcher('**/.epl')
		}
	};

	logger.appendLine(`Returning Language Client`);
	//now this call will use the above options and function
	return new LanguageClient(`tcp lang server (host ${config.host} port ${config.port})`, serverOptions, clientOptions);
}

// this method is called when your extension is deactivated
export function deactivate() { }



