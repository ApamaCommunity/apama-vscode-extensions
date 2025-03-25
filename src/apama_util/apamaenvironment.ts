import { platform } from "os";

export enum ApamaExecutables {
  CORRELATOR = "correlator",
  INJECT = "engine_inject",
  DEPLOY = "engine_deploy",
  PROJECT = "apama_project",
  MANAGEMENT = "engine_management",
  SEND = "engine_send",
  RECEIVE = "engine_receive",
  WATCH = "engine_watch",
  DELETE = "engine_delete",
  EPLBUDDY = "eplbuddy",
}

export interface ApamaExecutableInterface {
  command: string;
  args: string[];
}

export class ApamaEnvironment {
  // apama_env command
  private apamaEnv: string;

  constructor(apamaBin: string) {
    if (platform() === "linux") {
      this.apamaEnv = `${apamaBin}/apama_env`;
    } else {
      this.apamaEnv = `${apamaBin}/apama_env.bat`;
    }
  }

  getCommandLine(command: ApamaExecutables) {
    return `${this.apamaEnv} ${command}`;
  }

  getCommandAsList(command: ApamaExecutables) {
    return [this.apamaEnv, command];
  }

  getCommandAsInterface(command: ApamaExecutables): ApamaExecutableInterface {
    return { command: this.apamaEnv, args: [command] };
  }
}
