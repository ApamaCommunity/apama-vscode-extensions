 
/* eslint-disable @typescript-eslint/no-explicit-any */
 
import axios, { AxiosRequestConfig } from 'axios';
import * as vscode from 'vscode';
import { ApamaEnvironment } from '../apama_util/apamaenvironment';
import {Client, BasicAuth} from '@c8y/client';
import * as fs from 'fs';
import { Logger } from '../logger/logger';



export class EPLApplication extends vscode.TreeItem {
	//"{"eplfiles":[{"id":"713","name":"Testjbh","state":"inactive","errors":[],"warnings":[],"description":"This is a test"},{"id":"715","name":"jbh1","state":"active","errors":[],"warnings":[],"description":"jbh desc"},{"id":"719","name":"thisIsATest","state":"active","errors":[],"warnings":[],"description":"This is a test monitor uploaded from VS Code"}]}"
	constructor(
		public readonly id:string, 
		public readonly label: string, 
		public readonly active:boolean,
		public readonly warnings:string[], 
		public readonly errors:string[],
		public readonly desc:string,
		public contents:string) 
	{
		//{"id":"713","name":"Testjbh","state":"inactive","errors":[],"warnings":[],"description":"This is a test"}
		super(label, vscode.TreeItemCollapsibleState.Collapsed);
	}
	contextValue = 'EPLApplication';
}


export class CumulocityView implements vscode.TreeDataProvider<EPLApplication> {
	private _onDidChangeTreeData: vscode.EventEmitter<EPLApplication | undefined> = new vscode.EventEmitter<EPLApplication | undefined>();
	readonly onDidChangeTreeData: vscode.Event<EPLApplication | undefined> = this._onDidChangeTreeData.event;

	// eslint-disable-next-line 
	private treeView: vscode.TreeView<{}>;
	private filelist:EPLApplication[] = [];

	//
	// Added facilities for multiple workspaces - this will hopefully allow 
	// ssh remote etc to work better later on, plus allows some extra organisational
	// facilities....
	constructor(private apamaEnv: ApamaEnvironment, private logger: Logger, private context?: vscode.ExtensionContext) {
		
		//project commands 
		this.registerCommands();

		//the component
		this.treeView = vscode.window.createTreeView('c8y', { treeDataProvider: this });
	}
	processResponse(resp: any): void {
		this.logger.appendLine("Status:" + resp.res.status + " " + resp.res.statusText);
	}

	processError(resp:any): void {
		if('res' in resp){
			this.logger.appendLine("Status:" + resp.res.status + " " + resp.res.statusText);
		} else {
			this.logger.appendLine("Status: Error " + resp.message);
		}
	}

	registerCommands(): void {
		if (this.context !== undefined) {
			this.context.subscriptions.push.apply(this.context.subscriptions, [

				//
				// inventory using sdk
				//
				vscode.commands.registerCommand('extension.c8y.login', async () => {
					const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('apama.c8y');

					if( config ) {
						const tenant:string = config.get('tenant',"");
						const user:string = config.get('user',"");
						const password:string = config.get('password',"");
						const baseurl:any = config.get('url',"");
						this.logger.appendLine("Logging into c8y");

						const x = new BasicAuth({
							tenant,
							user,
							password
						});

						const client = new Client(x,baseurl);

						try {
							await client.inventory.list();
						}
						catch (err) {
							console.log(err);
						}
							
					}
				}),
				
				vscode.commands.registerCommand('extension.c8y.upload_epl_app', async (uri) => {
					try {
						let appname = uri.path;
						const lastPathSepIndex = appname.lastIndexOf('/');
						if (lastPathSepIndex >= 0) {
							appname = appname.slice(lastPathSepIndex + 1);
						}

						if (appname.endsWith(".mon")) {
							appname = appname.slice(0, -4);
						}

						const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('apama.c8y');
						let url: string = config.get('url',""); // C8Y host
						if (!url.endsWith("/")) {
							url += "/";
						}
						url += "service/cep/eplfiles";
						const options = {
							auth: {
								user: config.get("user", ""),
								pass: config.get("password", "")
							},
							body: {
								name: appname,
								contents: "",
								state: "active",
								description: "Uploaded from VS Code"
							},
							json: true
						};
						options.body.contents = fs.readFileSync(uri.fsPath).toString();
						const result = await axios.post(url, options);
						console.log(JSON.stringify(result));
						// TODO: show errors/warnings
					} catch (error) {
						let errorMessage = "Failed to register EPL App command, unknown error";
						if (error instanceof Error) {
							errorMessage = error.message;
						}
						vscode.window.showErrorMessage("Error uploading " + uri.path +":\n" + errorMessage);
					}
				}),

				//
				// open EPL App 
				//
				vscode.commands.registerCommand('extension.c8y.openEplApp', async (element) => {
					const setting: vscode.Uri = vscode.Uri.parse("untitled:" + element.label + ".mon" );
					vscode.workspace.openTextDocument(setting)
						.then(doc => {
							vscode.window.showTextDocument(doc)
								.then(e => {
									e.edit(edit => {
									edit.insert(new vscode.Position(0, 0), element.contents);
								});
						});
					});
				}),


				//
				// refresh projects
				//
				vscode.commands.registerCommand('extension.c8y.refresh', async () => {
					await this.refresh();
				})
			]);
		}
	}

	//
	// Trigger refresh of the tree
	//
	async refresh(): Promise<void> {
		this.filelist = [];
		try {
			const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('apama.c8y');
			const url: string = config.get('url',"") + "service/cep/eplfiles?contents=true";
			const options: AxiosRequestConfig = {
				auth: {
					username: config.get("user", ""),
					password: config.get("password", "")
				}
			};	
			const result = await axios.get(url, options);
			const eplfiles = JSON.parse(result.data);
			//"{"eplfiles":[{"id":"713","name":"Testjbh","state":"inactive","errors":[],"warnings":[],"description":"This is a test"},{"id":"715","name":"jbh1","state":"active","errors":[],"warnings":[],"description":"jbh desc"},{"id":"719","name":"thisIsATest","state":"active","errors":[],"warnings":[],"description":"This is a test monitor uploaded from VS Code"}]}"
			for (const element of eplfiles.eplfiles) {
				this.filelist.push(new EPLApplication(element.id,element.name, (element.state === 'inactive'),element.warnings,element.errors,element.desc,element.contents));
			}

		} catch (error) {
			console.log(error);
		}
		this._onDidChangeTreeData.fire(undefined);
	}

	//
	// get the children of the current item (group or item)
	// made this async so we can avoid race conditions on updates
	//
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	async getChildren(_item?: EPLApplication | undefined): Promise<undefined | EPLApplication[] > {
		//await this.refresh();
		return this.filelist;
	}



	//
	// interface requirement
	//
	getTreeItem(element: EPLApplication | string): vscode.TreeItem {

		//No string nodes in my tree so should never happen
		if (typeof element === "string") {
			this.logger.appendLine("ERROR ???? getTreeItem -- " + element.toString());
			return new vscode.TreeItem(element, vscode.TreeItemCollapsibleState.None);
		}

		//should just be the element clicked on
		return <vscode.TreeItem>element;
	}
}
