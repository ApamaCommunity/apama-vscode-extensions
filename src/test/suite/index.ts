import * as path from 'path';
import * as Mocha from 'mocha';
import * as glob from 'glob';

export async function run(): Promise<void> {
  // Create the mocha test
  const mocha = new Mocha({
    ui: 'tdd', // Using TDD interface as the test file uses suite() and test()
    color: true,
    timeout: 60000 // Timeout for tests in milliseconds
  });

  const testsRoot = path.resolve(__dirname, '..');
  
  try {
    // Find all test files
    const files = await glob.glob('**/*.test.js', { cwd: testsRoot });
    
    // Add each test file to the mocha instance
    files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)));

    // Run the mocha tests
    return new Promise<void>((resolve, reject) => {
      mocha.run(failures => {
        if (failures > 0) {
          reject(new Error(`${failures} tests failed.`));
        } else {
          resolve();
        }
      });
    });
  } catch (err) {
    console.error('Error running tests:', err);
    throw err;
  }
}