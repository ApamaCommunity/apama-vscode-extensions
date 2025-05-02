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
 * Determines the correct command line & parameters to run the command.
 * @returns False if Apama can't be found, the command & args pair to run the command otherwise
 */
async function getApamaExecutableCommand(command: ApamaExecutables, showError=true) {
  const apama = await determineIfApamaExists();
  if (apama != false) {
    const apamaBin = path.dirname(apama);
    if (platform() === "linux") {
      const apama_env_path = `${apamaBin}/apama_env`;
      if (existsSync(apama_env_path)) {
        return ok({command: apama_env_path, args: [command]})
      } else {
        // Assume we're in a Docker container without apama_env, and the commands can be
        // invoked manually.
        return ok({command: `${apamaBin}/${command}`, args: []})
      }
    } else {
      return ok({command: `${apamaBin}\\apama_env.bat`, args: [command]});
    }
  }

  if (showError) {
    window.showErrorMessage(`Could not find Apama in your environment: you can configure the "Apama Home" setting to specify an install location.`);
  }
  return err();
}

export async function getCommandLine(command: ApamaExecutables, showError=true) {
  const apama_executable_command = await getApamaExecutableCommand(command, showError);
  if (apama_executable_command.isOk()) {
    return [apama_executable_command.value.command, ...apama_executable_command.value.args];
  }
  return false;
}

export async function getCommandAsInterface(command: ApamaExecutables, showError=true): Promise<false | ApamaExecutableInterface> {
  const apama_executable_command = await getApamaExecutableCommand(command, showError);

  if (apama_executable_command.isOk()) {
    return apama_executable_command.value;
  }

  return false;
}
