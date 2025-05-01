import { ChildProcess, spawn as spawnCallback, execFile as execFileCallback} from "child_process";
import { Logger } from "../logger/logger";
import { platform } from "os";
import { promisify } from "util";

const spawn = promisify(spawnCallback);
const execFile = promisify(execFileCallback);

export class ApamaRunner {
  stdout = "";
  stderr = "";

  constructor(
    public name: string,
    public command: string[],
  ) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async run(workingDir: string, args: string[]): Promise<any> {
    //if fails returns promise.reject including err
    if (platform() === "win32") {
      return await spawn(
        this.command[0],
        [...args.slice(1), ...args],
        {cwd: workingDir}
      )
    } else {
      return await execFile(
        this.command[0],
        [...this.command.slice(1), ...args],
        {cwd: workingDir}
      )
    }
  }
}

export class ApamaAsyncRunner {
  stdout = "";
  stderr = "";
  child?: ChildProcess;

  constructor(
    public name: string,
    public command: string,
    private logger: Logger,
  ) {}

  //
  // If you call this withShell = true it will run the command under that shell
  // this means the process may need to be managed separately as it may get detached
  // when you kill the parent (correlator behaves that way)
  // I use engine_management to control the running correlator
  //
  // TODO: pipes configuration might be worth passing as an argument
  //
  public start(
    args: string[],
    withShell: boolean,
    defaultHandlers: boolean,
  ): ChildProcess {
    //N.B. this potentially will leave the correlator running - future work required...
    if (this.child && !this.child.killed) {
      this.logger.appendLine(this.name + " already started, stopping...");
      this.child.kill("SIGKILL");
    }

    this.logger.appendLine("Starting " + this.name);
    this.child = spawnCallback(this.command[0], [...this.command.slice(1), ...args], {
      shell: withShell,
      stdio: ["pipe", "pipe", "pipe"],
    });

    //Running with process Id
    this.logger.appendLine(this.name + " started, PID:" + this.child.pid);

    //Notify the logger if it stopped....
    this.child.once("exit", (exitCode) =>
      this.logger.appendLine(this.name + " stopped, exit code: " + exitCode),
    );

    if (defaultHandlers) {
      this.child.stdout?.setEncoding("utf8");
      this.child.stdout?.on("data", (data: string) => {
        if (this.logger) {
          this.logger.appendLine(data);
        }
      });
    }

    return this.child;
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.child && !this.child.killed) {
        this.child.once("exit", () => {
          resolve();
        });

        this.logger.appendLine("Process " + this.name + " stopping...");
        this.child.kill("SIGINT");
        const attemptedToKill = this.child;
        setTimeout(() => {
          if (!attemptedToKill.killed) {
            this.logger.appendLine(
              "Failed to stop shell in 5 seconds, killing...",
            );
            attemptedToKill.kill("SIGKILL");
          }
        }, 5000);
      } else {
        resolve();
      }
    });
  }
}
