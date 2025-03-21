import { platform } from 'os';

export enum ApamaCommands {
  CORRELATOR = 'correlator',
  INJECT = 'engine_inject',
  DEPLOY = 'engine_deploy',
  PROJECT = 'apama_project',
  MANAGEMENT = 'engine_management',
  SEND = 'engine_send',
  RECEIVE = 'engine_receive',
  WATCH = 'engine_watch',
  DELETE = 'engine_delete'
}

export class ApamaEnvironment {
  // apama_env command
  private apamaEnv: string;

  constructor(apamaBin: string) { 
    if (platform() === 'linux') {
      this.apamaEnv = `${apamaBin}/apama_env`
    } else {
      this.apamaEnv = `${apamaBin}/apama_env.bat`
    }
  }

  getCommandLine(command: ApamaCommands) {
    return `${this.apamaEnv} ${command}`
  }

  getCommandAsList(command: ApamaCommands) {
    return [this.apamaEnv, command]
  }
}
