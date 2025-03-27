import * as assert from "assert";
import * as path from 'path';
import * as vscode from "vscode";

suite("Extension Test Suite", () => {
  vscode.window.showInformationMessage("Start all tests.");

  setup(async () => {
    // Get the absolute path to the fake-correlator directory
    // __dirname in the compiled JS will be in the 'out' directory, but we need to point to the src directory
    const fakeCorrPath = path.resolve(__dirname, "../../src/test/test-fixtures/fake-correlator");

   // Update the configuration
    const configuration = vscode.workspace.getConfiguration();
    await configuration.update("apama.apamaHome", fakeCorrPath, vscode.ConfigurationTarget.Global);
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
    
    console.log("Apama commands:");
    apamaCommands.forEach(cmd => {
      console.log(`- ${cmd}`);
    });
    
    assert.ok(
      apamaCommands.length > 0,
      "Apama commands should be registered"
    );
  });
});
