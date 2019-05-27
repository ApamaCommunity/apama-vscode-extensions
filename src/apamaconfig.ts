import { WorkspaceFolder, DebugConfiguration, ProviderResult, CancellationToken, DebugConfigurationProvider, workspace } from 'vscode';
import * as Net from 'net';
import { platform } from 'os';
import { execFileSync } from 'child_process';
import { CorrelatorDebugSession, normalizeCorrelatorFilePath } from './correlatorDebugSession';

export class ApamaConfigurationProvider implements DebugConfigurationProvider {

	private _server?: Net.Server;

    /**
     *  Return an initial debug configuration
     */
    provideDebugConfigurations(folder: WorkspaceFolder | undefined, token?: CancellationToken): ProviderResult<DebugConfiguration[]> {
        return [ {
            type: "apama",
            name: "Debug Apama Application",
            request: "launch",
            correlator: {
                port: 15903,
                args: ["-g"]
            }
        }];
    }

	/**
	 * Add all missing config setting just before launch
	 */
	resolveDebugConfiguration(folder: WorkspaceFolder | undefined, config: DebugConfiguration, token?: CancellationToken): ProviderResult<DebugConfiguration> {
        // Can't continue if there's no workspace
        if (!folder) {
            return undefined;
        }

        // If an empty config has been provided (because there's no existing launch.json) then we can delegate to provideDebugConfigurations by returning
        if (Object.keys(config).length === 0) {
            return config;
        }

        // Set + save the apamaHome path if it isn't already set in global or workspace settings
        // It can be overwritten/moved to the workspace settings by the user
        if (!config.apamaHome) {
            const workspaceConfig = workspace.getConfiguration('apama');
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
        }

        config = Object.assign({
            injectionList: getInjectionList(config.apamaHome, folder.uri.fsPath),
            correlator: { /* Defaulted below */ }
        }, config);

        config.correlator = Object.assign({
            host: "localhost",
            port: 15903,
            args: ["-g"]
        }, config.correlator);

        config.correlator.port = Math.floor(config.correlator.port);

        if (!this._server) {
            this._server = Net.createServer(socket => {
                const session = new CorrelatorDebugSession(config.apamaHome, config.correlator);
                session.setRunAsServer(true);
                session.start(<NodeJS.ReadableStream>socket, socket);
            }).listen(0);
        }

        //config.debugServer = this._server.address().port;
        config.debugServer = this._server.address();

		return config;
	}

	dispose() {
		if (this._server) {
			this._server.close();
		}
	}
}

function getInjectionList(apamaHome: string, workspaceFolderPath: string) {
    return execFileSync(apamaHome + '/bin/engine_deploy', ['--outputList', 'stdout', workspaceFolderPath], {
            encoding: 'utf8'
        })
        .split(/\r?\n/)
        .filter(fileName => fileName !== '')
        .map(normalizeCorrelatorFilePath);
}