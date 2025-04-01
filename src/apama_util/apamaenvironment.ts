import { platform } from "os";
import { determineIfApamaExists } from "../extension";
import { window } from "vscode";
import * as path from 'path';

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

/**
 * Gets the `apama_env` command for this platform.
 * We reload this on every invocation because it should be relatively rare. 
 * @returns False if Apama can't be found, `apama_env` otherwise.
 */
async function getApamaEnvCommand(showError=true): Promise<false | string> {
  const apama = await determineIfApamaExists();
  if (apama != false) {
    const apamaBin = path.dirname(apama);
    if (platform() === "linux") {
      return Promise.resolve(`${apamaBin}/apama_env`);
    } else {
      return Promise.resolve(`${apamaBin}/apama_env.bat`);
    }
  }

  if (showError) {
    window.showErrorMessage(`Could not find Apama in your environment: you can configure the "Apama Home" setting to specify an install location.`);
  }
  return Promise.resolve(false);
}

export async function getCommandLine(command: ApamaExecutables, showError=true) {
  const apama_env = await getApamaEnvCommand(showError);
  if (apama_env != false) {
    return `${apama_env} ${command}`;
  }  
  return false;
}

export async function getCommandAsInterface(command: ApamaExecutables, showError=true): Promise<false | ApamaExecutableInterface> {
  const apama_env = await getApamaEnvCommand(showError);
  if (apama_env != false) {
    return { command: apama_env, args: [command] };
  }   
  return false;
}
