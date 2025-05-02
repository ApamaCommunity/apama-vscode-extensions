import { exec, execFile} from "child_process";
import { platform } from "os";
import { promisify } from "util";
import { logger } from "../extension";
import {
  ProgressLocation,
  window
} from "vscode";

const execPromisify = promisify(exec);
const execFilePromisify = promisify(execFile);


export class ApamaRunner {
  stdout = "";
  stderr = "";

  constructor(
    /** Display name for this process */
    public name: string,
    /** e.g. [XXX/apama_env, apama_project] or [XXX/apama_project] */
    public command: string[],
  ) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async run(workingDir: string, args: string[]): Promise<any> {
    return await window.withProgress(
      {
        // since sometimes (e.g. apama_project) the command takes a long time, giving a progress notification is helpful
        location: ProgressLocation.Notification,
        title: `Running ${this.name}...`,
        cancellable: false,
      },
      async () => 
      {
        try {
          if (platform() === "win32") {
            logger.debug("Running command: " + this.command[0] + " " + [...this.command.slice(1), ...args].join(" "));
            return await execPromisify([...this.command, ...args].join(" "), { cwd: workingDir });
          } else {
            return await execFilePromisify(
              this.command[0],
              [...this.command.slice(1), ...args],
              { cwd: workingDir }
            );
          }
        } catch (error) {
          const enhancedError = new Error(
            `Error running command '${this.command[0]} ${[...this.command.slice(1), ...args].join(" ")}': ${error}`
          );
          if (error instanceof Error) enhancedError.stack = error.stack;
          throw enhancedError;
        }
      }
    );
  }
}

