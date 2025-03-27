import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main() {
  try {
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');
    const extensionTestsPath = path.resolve(__dirname, './suite/index');

    // Blank workspace directory for the test to be launched into.
    const testFixture1 = path.resolve(__dirname, "./test-fixtures/fixture1")

    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [testFixture1]
    });
  } catch (err) {
    console.error('Failed to run tests:', err);
    process.exit(1);
  }
}

main();