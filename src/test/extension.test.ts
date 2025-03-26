import * as assert from "assert";
import * as path from 'path';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from "vscode";

// import * as myExtension from '../extension';

suite("Extension Test Suite", () => {
  vscode.window.showInformationMessage("Start all tests.");

  setup(async () => {
    const configuration = vscode.workspace.getConfiguration();
    configuration.update("apama.apamaHome", path.resolve(__dirname, "../../fake-correlator"), vscode.ConfigurationTarget.Global)
  });

  test("Extension should be present", () => {
    assert.ok(
      vscode.extensions.getExtension("ApamaCommunity.apama-extensions"),
    );
  });

  test("Extension should activate", async () => {
    const ext = vscode.extensions.getExtension(
      "ApamaCommunity.apama-extensions",
    );
    await ext?.activate();
    assert.ok(ext?.isActive);
  });

  test("Apama task provider should be registered", async () => {
    // Activate the extension if not already active
    const ext = vscode.extensions.getExtension(
      "ApamaCommunity.apama-extensions",
    );
    if (!ext?.isActive) {
      await ext?.activate();
    }
    
    // Get all task providers
    const taskProviders = await vscode.tasks.fetchTasks();
    
    // Check if there's at least one Apama task type
    const apamaTask = taskProviders.find(task => 
      task.definition.type === "apama"
    );
    
    assert.ok(apamaTask !== undefined, "Apama task provider should be registered");
  });

  test("Apama commands should be registered", async () => {
    // Activate the extension if not already active
    const ext = vscode.extensions.getExtension(
      "ApamaCommunity.apama-extensions",
    );
    if (!ext?.isActive) {
      await ext?.activate();
    }
    
    // Get all commands
    const commands = await vscode.commands.getCommands(true);
    
    // Check if Apama-specific commands are registered
    const apamaCommands = commands.filter(cmd => 
      cmd.startsWith("apama.")
    );
    
    assert.ok(
      apamaCommands.length > 0, 
      "Apama commands should be registered"
    );
  });
});
