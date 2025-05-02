import { exec, execFile} from "child_process";
import { platform } from "os";
import { promisify } from "util";
import { logger } from "../extension";

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
    try {
      //if fails returns promise.reject including err
      if (platform() === "win32") {
        logger.debug("Running command: " + this.command[0] + " " + [...this.command.slice(1), ...args].join(" "));
        // Not ideal: exec is not so secure, but execFile doesn't work with .bat file and spawn hangs mysteriously (even with stdio ignore),
        // so given Windows isn't a main platform going forward and that there isn't a real way this could be used to escalate privilieges, this will do for now
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
      if (error instanceof Error) {
        enhancedError.stack = error.stack;
      }
      throw enhancedError;
    }
  }
}

