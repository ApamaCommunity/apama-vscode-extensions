'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { WorkspaceFolder, DebugConfiguration, ProviderResult, CancellationToken } from 'vscode';
import * as Net from 'net';
import { CorrelatorDebugSession } from './correlatorDebugSession';
import { platform } from 'os';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    const provider = new ApamaConfigurationProvider();
	context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('apama', provider));
	context.subscriptions.push(provider);
}

// this method is called when your extension is deactivated
export function deactivate() {
}

class ApamaConfigurationProvider implements vscode.DebugConfigurationProvider {

	private _server?: Net.Server;

    /**
     *  Return an initial debug configuration
     */
    provideDebugConfigurations(folder: WorkspaceFolder | undefined, token?: CancellationToken): ProviderResult<DebugConfiguration[]> {
        return [ {
            type: "apama",
            name: "Debug Apama Application",
            request: "launch"
        }];
    }

	/**
	 * Add all missing config setting just before launch
	 */
	resolveDebugConfiguration(folder: WorkspaceFolder | undefined, config: DebugConfiguration, token?: CancellationToken): ProviderResult<DebugConfiguration> {
        // If an empty config has been provided (because there's no existing launch.json) then we can delegate to provideDebugConfigurations by returning
        if (Object.keys(config).length === 0) {
            return config;
        }

        // Set + save the apamaHome path if it isn't already set in global or workspace settings
        // It can be overwritten/moved to the workspace settings by the user
        if (!config.apamaHome) {
            const workspaceConfig = vscode.workspace.getConfiguration('apama');
            if (!workspaceConfig.apamaHome) {
                if (platform() === 'win32') {
                    config.apamaHome = 'C:/SoftwareAG/Apama';
                } else {
                    config.apamaHome = '/opt/softwareag/Apama';
                }
                
                workspaceConfig.update('apamaHome', config.apamaHome, true);
            } else {
                config.apamaHome = workspaceConfig.apamaHome;
            }
            
            config.correlatorPath = config.apamaHome + "/bin/correlator";
        }

        if (!this._server) {
            this._server = Net.createServer(socket => {
                const session = new CorrelatorDebugSession();
                session.setRunAsServer(true);
                session.start(<NodeJS.ReadableStream>socket, socket);
            }).listen(0);
        }

        config.debugServer = this._server.address().port;

		return config;
	}

	dispose() {
		if (this._server) {
			this._server.close();
		}
	}
}