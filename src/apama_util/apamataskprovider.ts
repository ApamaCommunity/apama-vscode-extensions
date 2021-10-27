import { watch } from 'fs';
import { TaskProvider, CancellationToken, ProviderResult, Task, TaskDefinition, ShellExecution, OutputChannel } from 'vscode';
import { ApamaCommand, ApamaEnvironment } from './apamaenvironment';

interface ApamaTaskDefinition extends TaskDefinition {
  task: string;
  port: number;
  project: string;
  cmdline: string;
}


export class ApamaTaskProvider implements TaskProvider {

  constructor(private logger: OutputChannel, private apamaEnv: ApamaEnvironment) {

  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  resolveTask(_task: Task, _token?: CancellationToken | undefined): ProviderResult<Task> {
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
      const finalTask = new Task(
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
    const correlatorCmd: ApamaCommand = this.apamaEnv.getCorrelatorCmdline();
    const correlator = new Task(
      {"type":"apama", "task":"correlator", "port":"15903", "cmdline":correlatorCmd.singleCmdLine()},
      "correlator",
      "apama",
      new ShellExecution(correlatorCmd.apamaEnv, [correlatorCmd.command]),
      []
    );
    correlator.group = 'correlator';
    return correlator;
  }

  private runReceive(): Task {

    //default options for running
    const receiveCmd: ApamaCommand = this.apamaEnv.getEngineReceiveCmdline();
    const receive = new Task(
      {"type":"apama", "task":"engine_receive", "port":"15903", "cmdline":receiveCmd.singleCmdLine()},
      "engine_receive",
      "apama",
      new ShellExecution(receiveCmd.apamaEnv, [receiveCmd.command]),
      []
    );
    receive.group = 'correlator';
    return receive;
  }

  runEngineWatch(): Task {
    //TODO: get user defined options?
    //let options = windows.showInputBox(...etc...);
    const watcheCmd: ApamaCommand = this.apamaEnv.getEngineWatchCmdline();
    const watch = new Task(
      {"type":"apama", "task":"engine_watch", "port":"15903", "cmdline":watcheCmd.singleCmdLine()},
      "engine_watch",
      "apama",
      new ShellExecution(watcheCmd.apamaEnv, [watcheCmd.command]/* + options */),
      []
    );
    watch.group = 'tools';
    return watch;
  }
}
