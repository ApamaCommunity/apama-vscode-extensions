import {
  TaskProvider,
  CancellationToken,
  ProviderResult,
  Task,
  ShellExecution,
  TaskGroup,
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

    // Substitute the executable with the current known Apama executable.
    const executable = await getCommandLine(cmdline);

    if (port && executable != false) {
      this.logger.appendLine("Running on port " + port);
      const finalTask = new Task(
        _task.definition,
        task + "-" + port,
        "apama",
        new ShellExecution(executable + [" -p", port].join(" ")),
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
        task: ApamaExecutables.CORRELATOR,
        port: "15903",
        cmdline: ApamaExecutables.CORRELATOR,
      },
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
    //default options for running
    const correlator = new Task(
      {
        type: "apama",
        task: "engine_receive",
        port: "15903",
        cmdline: ApamaExecutables.RECEIVE,
      },
      "engine_receive",
      "apama",
      new ShellExecution(
        ApamaExecutables.RECEIVE
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
        cmdline: ApamaExecutables.WATCH,
      },
      "engine_watch",
      "apama",
      new ShellExecution(ApamaExecutables.WATCH),
      [],
    );
    engine_watch.group = TaskGroup.Test;
    return engine_watch;
  }
}
