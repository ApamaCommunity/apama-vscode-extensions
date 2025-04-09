import {
  TaskProvider,
  CancellationToken,
  ProviderResult,
  Task,
  ShellExecution,
  TaskGroup,
  TaskScope,
} from "vscode";
import { ApamaExecutables, getCommandLine } from "./apamaenvironment";
import { Logger } from "../logger/logger";
export class ApamaTaskProvider implements TaskProvider {
  constructor(
    private logger: Logger,
  ) {}

  async resolveTask(
    _task: Task,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _token?: CancellationToken | undefined,
  ) {

    // The actual task will start on the correct port
    // it will change the name to add the port as a suffix
    const port = _task.definition.port;
    const task = _task.definition.task;
    const cmdline = _task.definition.cmdline;
    let scope = _task.scope;

    if (scope === undefined) {
      scope = TaskScope.Workspace;
    }

    // Substitute the executable with the current known Apama executable.
    const executable = await getCommandLine(cmdline);

    this.logger.appendLine("Running on port " + port);
    const finalTask = new Task(
      _task.definition,
      scope,
      task + "-" + port,
      "apama",
      new ShellExecution(executable + [" -p", port].join(" ")),
      [],
    );
    return finalTask;
  }

  provideTasks(): ProviderResult<Task[]> {
    return [this.runCorrelator(), this.runEngineWatch(), this.runReceive()];
  }

  private runCorrelator(): Task {
    const correlator = new Task(
      {
        type: "apama",
        task: ApamaExecutables.CORRELATOR,
        port: "15903",
        cmdline: ApamaExecutables.CORRELATOR,
      }, 
      TaskScope.Workspace,
      "correlator",
      "apama",
      new ShellExecution(
        ApamaExecutables.CORRELATOR
      ),
      [],
    );

    correlator.group = TaskGroup.Test;
    return correlator;
  }

  private runReceive(): Task {
    const engine_receive = new Task(
      {
        type: "apama",
        task: "engine_receive",
        port: "15903",
        cmdline: ApamaExecutables.RECEIVE,
      },
      TaskScope.Workspace,
      "engine_receive",
      "apama",
      new ShellExecution(
        ApamaExecutables.RECEIVE
      ),
      [],
    );
    engine_receive.group = TaskGroup.Test;
    return engine_receive;
  }

  private runEngineWatch(): Task {
    const engine_watch = new Task(
      {
        type: "apama",
        task: "engine_watch",
        port: "15903",
        cmdline: ApamaExecutables.WATCH,
      },
      TaskScope.Workspace,
      "engine_watch",
      "apama",
      new ShellExecution(ApamaExecutables.WATCH),
      [],
    );
    engine_watch.group = TaskGroup.Test;
    return engine_watch;
  }
}
