import { TaskProvider, CancellationToken, ProviderResult, Task, ProcessExecution, TaskDefinition, ShellExecution, ShellExecutionOptions, OutputChannel, TaskScope, InputBoxOptions } from 'vscode';
import { ApamaEnvironment } from './apamaenvironment';
import { window, workspace } from 'vscode';

interface ApamaTaskDefinition extends TaskDefinition {
  task: string;
  port: number;
  project: string;
  cmdline: string;
}


export class ApamaTaskProvider implements TaskProvider {

  constructor(private logger: OutputChannel, private apamaEnv: ApamaEnvironment) {

  }

  resolveTask(_task: Task, token?: CancellationToken | undefined): ProviderResult<Task> {
    this.logger.appendLine("resolveTask called");
    //
    // The actual task will start on the correct port
    // it will change the name to add the port as a suffix
    //
    const port = _task.definition.port;
    const task = _task.definition.task;
    const cmdline = _task.definition.cmdline;
    if(port) {
      this.logger.appendLine("Running on port " + port);
      let finalTask = new Task(
        _task.definition,
        task +"-"+port,
        "apama",
        new ShellExecution(cmdline+ [" -p",port].join(' ')),
        []
      );
      return finalTask;
    }
    return undefined;
  }


  provideTasks(): ProviderResult<Task[]> {
    return [
        this.runCorrelator(),
        this.runEngineWatch(),
        this.runReceive()
    ];
  }


  private runCorrelator(): Task {

    //default options for running
    let correlator = new Task(
      {"type":"apama","task":"correlator","port":"15903","cmdline":this.apamaEnv.getCorrelatorCmdline()},
      "correlator",
      "apama",
      new ShellExecution(this.apamaEnv.getCorrelatorCmdline()),
      []
    );
    correlator.group = 'correlator';
    return correlator;
  }

  private runReceive(): Task {

    //default options for running
    let correlator = new Task(
      {"type":"apama","task":"engine_receive","port":"15903","cmdline":this.apamaEnv.getEngineReceiveCmdline()},
      "engine_receive",
      "apama",
      new ShellExecution(this.apamaEnv.getEngineReceiveCmdline()),
      []
    );
    correlator.group = 'correlator';
    return correlator;
  }

   runEngineWatch(): Task {
     //TODO: get user defined options?
     //let options = windows.showInputBox(...etc...);
    let engine_watch = new Task(
      {"type":"apama","task":"engine_watch","port":"15903","cmdline":this.apamaEnv.getEngineWatchCmdline()},
      "engine_watch",
      "apama",
      new ShellExecution(this.apamaEnv.getEngineWatchCmdline()/* + options */),
      []
    );
    engine_watch.group = 'tools';
    return engine_watch;
  }

}