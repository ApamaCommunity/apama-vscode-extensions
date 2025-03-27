import * as assert from "assert";
import * as path from 'path';
import * as fs from 'fs';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from "vscode";

suite("Extension Test Suite", () => {
  vscode.window.showInformationMessage("Start all tests.");

  setup(async () => {
    // Get the absolute path to the fake-correlator directory
    // __dirname in the compiled JS will be in the 'out' directory, but we need to point to the src directory
    const fakeCorrPath = path.resolve(__dirname, "../../src/test/test-fixtures/fake-correlator");

    console.log(`Fake correlator path: ${fakeCorrPath}`);
    console.log(`Fake correlator exists: ${fs.existsSync(fakeCorrPath)}`);

    const binPath = path.join(fakeCorrPath, "bin");
    console.log(`Bin path: ${binPath}`);
    console.log(`Bin exists: ${fs.existsSync(binPath)}`);

    const corrPath = path.join(binPath, "correlator");
    console.log(`Correlator path: ${corrPath}`);
    console.log(`Correlator exists: ${fs.existsSync(corrPath)}`);
   
    // Update the configuration
    const configuration = vscode.workspace.getConfiguration();
    configuration.update("apama.apamaHome", fakeCorrPath, vscode.ConfigurationTarget.Global);
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
