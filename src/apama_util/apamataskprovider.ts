import {
  TaskProvider,
  CancellationToken,
  ProviderResult,
  Task,
  ShellExecution,
  TaskGroup,
} from "vscode";
import { ApamaEnvironment, ApamaExecutables } from "./apamaenvironment";
import { Logger } from "../logger/logger";

export class ApamaTaskProvider implements TaskProvider {
  constructor(
    private logger: Logger,
    private apamaEnv: ApamaEnvironment,
  ) {}

  resolveTask(
    _task: Task,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _token?: CancellationToken | undefined,
  ): ProviderResult<Task> {
    this.logger.appendLine("resolveTask called");
    //
    // The actual task will start on the correct port
    // it will change the name to add the port as a suffix
    //
    const port = _task.definition.port;
    const task = _task.definition.task;
    const cmdline = _task.definition.cmdline;
    if (port) {
      this.logger.appendLine("Running on port " + port);
      const finalTask = new Task(
        _task.definition,
        task + "-" + port,
        "apama",
        new ShellExecution(cmdline + [" -p", port].join(" ")),
        [],
      );
      return finalTask;
    }
    return undefined;
  }

  provideTasks(): ProviderResult<Task[]> {
    return [this.runCorrelator(), this.runEngineWatch(), this.runReceive()];
  }

  private runCorrelator(): Task {
    //default options for running
    const correlator = new Task(
      {
        type: "apama",
        task: "correlator",
        port: "15903",
        cmdline: this.apamaEnv.getCommandLine(ApamaExecutables.CORRELATOR),
      },
      "correlator",
      "apama",
      new ShellExecution(
        this.apamaEnv.getCommandLine(ApamaExecutables.CORRELATOR),
      ),
      [],
    );
    correlator.group = TaskGroup.Test;
    return correlator;
  }

  private runReceive(): Task {
    //default options for running
    const correlator = new Task(
      {
        type: "apama",
        task: "engine_receive",
        port: "15903",
        cmdline: this.apamaEnv.getCommandLine(ApamaExecutables.RECEIVE),
      },
      "engine_receive",
      "apama",
      new ShellExecution(
        this.apamaEnv.getCommandLine(ApamaExecutables.RECEIVE),
      ),
      [],
    );
    correlator.group = TaskGroup.Test;
    return correlator;
  }

  runEngineWatch(): Task {
    //TODO: get user defined options?
    //let options = windows.showInputBox(...etc...);
    const engine_watch = new Task(
      {
        type: "apama",
        task: "engine_watch",
        port: "15903",
        cmdline: this.apamaEnv.getCommandLine(ApamaExecutables.WATCH),
      },
      "engine_watch",
      "apama",
      new ShellExecution(this.apamaEnv.getCommandLine(ApamaExecutables.WATCH)),
      [],
    );
    engine_watch.group = TaskGroup.Test;
    return engine_watch;
  }
}
