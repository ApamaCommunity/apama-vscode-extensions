/* eslint-disable @typescript-eslint/no-explicit-any */
import { ApamaRunner } from '../apama_util/apamarunner';
import { ExtensionContext, workspace, commands, window } from 'vscode';
import { ApamaEnvironment, ApamaExecutableInterface, ApamaExecutables } from '../apama_util/apamaenvironment';
import { ChildProcess, spawn } from 'child_process';
import { Writable } from 'stream';
import { Logger } from '../logger/logger';

export class ApamaCommandProvider {
  private injectCmd: ApamaRunner;
  private sendCmd: ApamaRunner;
  private deleteCmd: ApamaRunner;

  public constructor(private logger: Logger, private apamaEnv: ApamaEnvironment,
    private context: ExtensionContext) {
    this.injectCmd = new ApamaRunner("engine_inject", apamaEnv.getCommandLine(ApamaExecutables.INJECT));
    this.sendCmd = new ApamaRunner("engine_send", apamaEnv.getCommandLine(ApamaExecutables.SEND));
    this.deleteCmd = new ApamaRunner("engine_delete", apamaEnv.getCommandLine(ApamaExecutables.DELETE));
    this.registerCommands();
  }

  registerCommands(): void {

    if (this.context !== undefined) {
      const port: any = workspace.getConfiguration("apama").get("debugPort");
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
                  const command: ApamaExecutableInterface = this.apamaEnv.getCommandAsInterface(ApamaExecutables.SEND);
                  const childProcess = spawn(command.command, [...command.args, '-p', userInput.toString()], {
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
          })
        ]
      );
    }
  }


  dispose() : void{
    return;
  }

  //https://2ality.com/2018/05/child-process-streams.html
  streamWrite(stream: Writable, chunk: string | Buffer | Uint8Array, encoding: BufferEncoding = "utf-8"): Promise<void> {
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

