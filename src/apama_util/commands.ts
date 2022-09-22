/* eslint-disable @typescript-eslint/no-explicit-any */
import { ApamaRunner, ApamaAsyncRunner } from '../apama_util/apamarunner';
import { OutputChannel,ExtensionContext, workspace, commands, window } from 'vscode';
import { ApamaEnvironment } from '../apama_util/apamaenvironment';
import { ChildProcess, spawn } from 'child_process';
import { Writable } from 'stream';

//NOTE: We can eliminate so many variables and write a better generic solution using path & _dir module
let fs = require('fs');
let fse = require('fs-extra')
let dir1 = 'C:/dev/dir1/';
let dir2 = 'C:/dev/dir1/files'
let srcDir="C:/dev/IW/vs2/";
let destDir="C:/dev/dir1/files";
var zl = require("zip-lib");
let axios = require('axios');
var FormData = require('form-data');



export class ApamaCommandProvider {
  private injectCmd: ApamaRunner;
  private sendCmd: ApamaRunner;
  private deleteCmd: ApamaRunner;
  private engineWatchCmd: ApamaAsyncRunner;

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
      this.context.subscriptions.push.apply(this.context.subscriptions,
        [

          commands.registerCommand('extension.c8y.uploadProject', async () => {
            try {
//NOTE: Currently apama_project is default value in prompt but the context menu should be on right click apama project folder            
              const projectName = await window.showInputBox({  
                value: "apama_project",
                placeHolder: "Enter project name"
                });                
                if (!fs.existsSync(dir1)){
                 fs.mkdirSync(dir1);
                }
                if (!fs.existsSync(dir2)){
                 fs.mkdirSync(dir2);
                }
              try {
               await fse.copy(srcDir, destDir, { overwrite: true })
                console.log('success!')
              } catch (err) {
                console.error(err)
              }
//NOTE: A generic solution is required to exclude all the unwanted files.          
              fs.unlinkSync("C:/dev/dir1/files/apama_project/.project",function(err:any){
                if(err) return console.log(err);
                console.log('file1 deleted successfully')});

              fs.unlinkSync("C:/dev/dir1/files/apama_project/.dependencies",function(err:any){
                if(err) return console.log(err);
                console.log('file2 deleted successfully')});
                //path of your workspace
              await zl.archiveFolder("C:/dev/dir1", "C:/dev/target.zip").then(function () {
                  console.log("done");
              }, function (err:any) {
                  console.log(err);
              });
              
              try{
                var data = new FormData();
               await data.append('object', '{"name":"Foo","type":"application/zip","pas_extension":"Foo"}');
               await data.append('filesize', '12');
//NOTE: The target directory should be generic something like apama_home and should not be C:/dev               
               await data.append('file', fs.createReadStream('C:/dev/target.zip'));

                var config = {
                method: 'post',
                url: 'https://apamannat.latest.stage.c8y.io//inventory/binaries',
                headers: { 
                    'Authorization': 'Basic YXBhbWFibGQ6MjB0cnl0cnlhZ2Fpbj4+MjBBTkRIT1BF', 
                    'Content-Type': 'multipart/form-data; boundary=----PASExtension3XtDFfhJ8XLIrkPw', 
                    'Accept': '*/*', 
                    ...data.getHeaders()
                },
                  data : data
                };
                axios(config)
                .then(function (response:any) {
                  console.log(JSON.stringify(response.data));
                })
                .catch(function (error:any) {
                  console.log(error);
                });
              }
              catch(error){
              }
              // TODO: show errors/warnings
            } catch (error) {
              // window.showErrorMessage("Error uploading " + uri.path +":\n" + error.error.message);
            }
          }),
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

