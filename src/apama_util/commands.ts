/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-var-requires */
const axios = require('axios').default;
import { ApamaRunner, ApamaAsyncRunner } from '../apama_util/apamarunner';
import { OutputChannel,ExtensionContext, workspace, commands, window } from 'vscode';
import { ApamaEnvironment } from '../apama_util/apamaenvironment';
import { ChildProcess, spawn } from 'child_process';
import { Writable } from 'stream';
import * as fs from 'fs';
import { Base64 } from 'js-base64';

export class ApamaCommandProvider {
  private injectCmd: ApamaRunner;
  private sendCmd: ApamaRunner;
  private deleteCmd: ApamaRunner;
  private engineWatchCmd: ApamaAsyncRunner;
  authorization: string | undefined;

  public constructor(private logger: OutputChannel, private apamaEnv: ApamaEnvironment,
    private context: ExtensionContext) {
    this.injectCmd = new ApamaRunner("engine_inject", apamaEnv.getInjectCmdline(), logger);
    this.sendCmd = new ApamaRunner("engine_send", apamaEnv.getSendCmdLine(), logger);
    this.deleteCmd = new ApamaRunner("engine_delete", apamaEnv.getDeleteCmdLine(), logger);
    this.engineWatchCmd = new ApamaAsyncRunner("engine_watch", apamaEnv.getEngineWatchCmdline(), logger);
    this.registerCommands();
  }

  registerCommands(): void {

    if (this.context !== undefined) {
      const port: any = workspace.getConfiguration("softwareag.apama").get("debugport");
      const tenantUrl: any = workspace.getConfiguration("softwareag.c8y").get("url");
      const tenantUserName: any = workspace.getConfiguration("softwareag.c8y").get("user");
      const tenantPassword: any = workspace.getConfiguration("softwareag.c8y").get("password");

      this.context.subscriptions.push.apply(this.context.subscriptions,
        [
          //
          // engine_inject command
          //
          commands.registerCommand('extension.apama.engine_inject', async (monFile) => {
            if (monFile !== undefined) {
              // Display prompt to receive port
              const userInput = await window.showInputBox({
                value: port.toString(),
                placeHolder: "What port is the target correlator running on"
              });
              if( userInput ) {
                this.injectCmd.run('.', ['-p', userInput.toString()].concat(monFile.fsPath));
              }              
            }
            // TODO?: add option to specify mon file name to inject in command palette 
          }),
          //
          // engine_send command
          //
          commands.registerCommand('extension.apama.engine_send', async (evtFile?) => {
            // Display prompt to receive port
            const portInput = await window.showInputBox({
              value: port.toString(),
              placeHolder: "What port is the target correlator running on"
            });

            if( portInput ){
            // From explorer/context menu 
              if (evtFile !== undefined) {
                // Specify engine_send command WITH evt file 
                this.sendCmd.run('.', ['-p', portInput.toString()].concat(evtFile.fsPath));
              }
              // Calling engine send from command palette
              else {
                // Display prompt to receive user input
                const userInput = await window.showInputBox({
                  value: "\"send_channel\", event_type(event_fields)",
                  placeHolder: "Specify event to send"
                });
                if (userInput !== undefined) {
                  // Specify engine_send command with NO evt files (but specify port) 
                  const childProcess = spawn(this.apamaEnv.getSendCmdLine() + ' -p ' + userInput.toString(), {
                    shell: true,
                    stdio: ['pipe', 'pipe', 'pipe']
                  });
                  // When no evt files are specified in engine_send command 
                  // the correlator reads user-specified events from stdin 
                  // (see 'Sending events to correlatyeah ors' in 'Deploying and Managing Apama Applications' p.169).
                  //  => write userInput to stdin of child process:
                  await this.streamWrite(childProcess.stdin, userInput + "\n");
                  await this.streamEnd(childProcess.stdin);
                  await this.onExit(childProcess);
                  this.logger.appendLine('engine_send ' + userInput);
                }
              }
            }
          }),
          //
          // engine_delete command
          //
          commands.registerCommand('extension.apama.engine_delete', async () => {
            // Display prompt to receive port
            const portInput = await window.showInputBox({
              value: port.toString(),
              placeHolder: "What port is the target correlator running on"
            });

            if( portInput ){
              const userInput = await window.showInputBox({
                value: " [ options ] [ name1 [ name2 ... ] ]",
                placeHolder: "Specify the names of zero or more EPL, JMon, monitors and/or event types to delete from correlator."
              });
              if (userInput !== undefined) {
                this.deleteCmd.run('.', ['-p', port.toString()].concat(userInput));
              }
            }
          }),

           /**
           * Uploading monitor file as EPL App command
           */
            commands.registerCommand('extension.apama.deploy_epl', async (uri) => {

              const credsb64: string = Base64.encode(tenantUserName + ':' + tenantPassword);
              this.authorization = 'Basic ' + credsb64;
  
              // Display prompt to provide tenant URL.
              const userInput_tenant = await window.showInputBox({
                value: tenantUrl.toString(),
                placeHolder: "What is the tenant url"
              });
  
              let appname = uri.path;
              const lastPathSepIndex = appname.lastIndexOf('/');
              if (lastPathSepIndex >= 0) {
                appname = appname.slice(lastPathSepIndex + 1);
              }
  
              if (appname.endsWith(".mon")) {
                appname = appname.slice(0, -4);
              }
  
              const data = {
                name: appname,
                description: 'Uploaded from VS Code',
                state: 'active',
                contents: fs.readFileSync(uri.fsPath).toString()
              };
  
              const config = {
                method: 'post',
                url: userInput_tenant + '/service/cep/eplfiles',
                headers: { 
                  'Authorization': this.authorization, 
                  'Content-Type': 'application/json', 
                  'Accept': 'application/json'
                },
                data : data
              };
  
              axios.default(config)
              .then(() => window.showInformationMessage('Success: ' + appname + '.mon is uploaded as an EPL app.'))
              .catch((error:any) => window.showErrorMessage('Failure: ' + error.message));
  
            })
        ]
      );
    }
  }


  dispose() : void{
    return;
  }

  //https://2ality.com/2018/05/child-process-streams.html
  streamWrite(stream: Writable, chunk: string | Buffer | Uint8Array, encoding = 'utf8'): Promise<void> {
    return new Promise((resolve, reject) => {
      const errListener = (err: Error) => {
        stream.removeListener('error', errListener);
        reject(err);
      };
      stream.addListener('error', errListener);
      const callback = () => {
        stream.removeListener('error', errListener);
        resolve(undefined);
      };
      stream.write(chunk, encoding, callback);
    });
  }

  streamEnd(stream: Writable): Promise<void> {
    return new Promise((resolve, reject) => {
      const errListener = (err: Error) => {
        stream.removeListener('error', errListener);
        reject(err);
      };
      stream.addListener('error', errListener);
      const callback = () => {
        stream.removeListener('error', errListener);
        resolve(undefined);
      };
      stream.end(callback);
    });
  }

  onExit(childProcess: ChildProcess): Promise<void> {
    return new Promise((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      childProcess.once('exit', (code: number, _signal: string) => {
        if (code === 0) {
          resolve(undefined);
        } else {
          reject(new Error('Exit with error code: ' + code));
        }
      });
      childProcess.once('error', (err: Error) => {
        reject(err);
      });
    });
  }

}

