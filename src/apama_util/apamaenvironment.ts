import { platform } from "os";
import { determineIfApamaExists } from "../extension";
import { window } from "vscode";
import * as path from 'path';
import { existsSync } from "fs";
import { ok, err } from 'neverthrow';

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
async function getApamaEnvCommand(showError=true) {
  const apama = await determineIfApamaExists();
  if (apama != false) {
    const apamaBin = path.dirname(apama);
    if (platform() === "linux") {
      const apama_env_path = `${apamaBin}/apama_env`;
      if (existsSync(apama_env_path)) {
        return ok({"apama_env": true, "path": apama_env_path});
      } else {
        // Assume we're in a Docker container without apama_env, and the commands can be
        // invoked manually.
        return ok({"apama_env": false, "path": apamaBin})
      }
    } else {
      return ok({"apama_env": true, "path": `${apamaBin}/apama_env.bat`});
    }
  }

  if (showError) {
    window.showErrorMessage(`Could not find Apama in your environment: you can configure the "Apama Home" setting to specify an install location.`);
  }
  return err();
}

export async function getCommandLine(command: ApamaExecutables, showError=true) {
  const apama_env = await getApamaEnvCommand(showError);
  if (apama_env.isOk()) {
    if (apama_env.value.apama_env != false) {
      return `${apama_env.value.path} ${command}`;
    } else {
      return `${apama_env.value.path}/command`;
    }

  }
  return false;
}

export async function getCommandAsInterface(command: ApamaExecutables, showError=true): Promise<false | ApamaExecutableInterface> {
  const apama_env = await getApamaEnvCommand(showError);
  if (apama_env.isOk()) {
    if (apama_env.value.apama_env != false) {
      return { command: apama_env.value.path, args: [command] };
    } else {
      return { command: `${apama_env.value.path}/command`, args: [] }
    }
  }
  return false;
}
