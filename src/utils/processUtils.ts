/*---------------------------------------------------------
 * Copyright 2020 The Go Authors. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------*/

import { ChildProcessWithoutNullStreams } from 'child_process';
import { Logger } from '../logger/logger';
import * as terminate from 'terminate';

// Kill a process and its children, returning a promise.
export function killProcessTree(p: ChildProcessWithoutNullStreams | null, logger: Logger): Promise<void> {
	if (!p || !p.pid || p.exitCode !== null) {
		return Promise.resolve();
	}
	return new Promise((resolve) => {
		terminate.default(p.pid!, "SIGTERM", (err) => {
			if (err) {
				logger.error(`Error killing process ${p.pid}: ${err}`);
			}
			resolve();
		});
	});
}