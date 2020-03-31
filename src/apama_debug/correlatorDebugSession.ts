import {
	DebugSession,
	InitializedEvent,
	OutputEvent,
	TerminatedEvent,
	Breakpoint,
	StoppedEvent,
	Thread,
	StackFrame,
	Source,
	Scope,
	Variable
} from 'vscode-debugadapter';
import { DebugProtocol } from 'vscode-debugprotocol';
import { CorrelatorHttpInterface, CorrelatorBreakpoint, CorrelatorPaused } from './correlatorHttpInterface';
import { basename } from 'path';
import * as vscode from 'vscode';
import { ApamaEnvironment } from '../apama_util/apamaenvironment';
import { ApamaAsyncRunner, ApamaRunner } from '../apama_util/apamarunner';

const MAX_STACK_SIZE = 1000;

interface LaunchRequestArguments extends DebugProtocol.LaunchRequestArguments {
	/** List of files to inject into the correlator */
	injectionList: string[];
}

/**
 * Handles debug requests from the frontend
 * Order of events received:
 * - Initialize
 * - Launch
 * (After Initialized sent back to client)
 * - SetBreakpoint (Zero or more)
 * - ConfigurationDone
 */

export interface CorrelatorConfig {
	host: string;
	port: number;
	args: string[];
}

export class CorrelatorDebugSession extends DebugSession {
	private deployCmd: ApamaRunner;
	private injectCmd: ApamaRunner;
	private correlatorCmd: ApamaAsyncRunner;
	private correlatorHttp: CorrelatorHttpInterface;
	private manager: ApamaRunner;
	public constructor(private logger: vscode.OutputChannel, apamaEnv: ApamaEnvironment, private config: CorrelatorConfig) {
		super();

		this.manager = new ApamaRunner("engine_management", apamaEnv.getManagerCmdline(),logger);
		this.correlatorCmd = new ApamaAsyncRunner("correlator", apamaEnv.getCorrelatorCmdline(), logger);//  (logger, apamaEnv, config);
		this.injectCmd = new ApamaRunner("engine_inject", apamaEnv.getInjectCmdline(), logger);
		this.deployCmd = new ApamaRunner("engine_deploy", apamaEnv.getDeployCmdline(), logger);
		this.correlatorHttp = new CorrelatorHttpInterface(logger, config.host, config.port);
	}

	/**
	 * The 'initialize' request is the first request called by the frontend
	 * to interrogate the features the debug adapter provides.
	 */
	protected initializeRequest(response: DebugProtocol.InitializeResponse, args: DebugProtocol.InitializeRequestArguments): void {
		this.logger.appendLine("Initialize called");

		if (!response.body) {
			response.body = {};
		}

		response.body.supportsConfigurationDoneRequest = true;
		response.body.supportsFunctionBreakpoints = false;
		response.body.exceptionBreakpointFilters = [
			{
				label: "Uncaught Exceptions",
				filter: 'uncaught',
				default: true
			}
		];

		this.sendResponse(response);
	}

	/**
	 * Frontend requested that the application be launched
	 */
	protected launchRequest(response: DebugProtocol.LaunchResponse, args: LaunchRequestArguments): void {
		this.logger.appendLine("Launch requested on port " + this.config.port.toString());
		const correlatorProcess = this.correlatorCmd.start(this.config.args.concat(['-p',this.config.port.toString()]),true,true);

		correlatorProcess.stderr.setEncoding('utf8');
		correlatorProcess.stderr.on('data', (data: string) => this.sendEvent(new OutputEvent(data, 'stderr')));
		correlatorProcess.once('exit', (exitCode) => {
			this.sendEvent(new OutputEvent("Correlator terminated with exit code: " + exitCode, 'console'));
			this.sendEvent(new TerminatedEvent());
		});

		this.correlatorHttp.enableDebugging()
			.then(async () => {
				// Pause correlator while we wait for the configuration to finish, we want breakpoints to be set first
				await this.correlatorHttp.pause();
				const folder = await vscode.window.showWorkspaceFolderPick();
				if (folder !== undefined) {
					await this.deployCmd.run('.', ['--inject', this.config.host.toString(), this.config.port.toString()]
						.concat(folder.uri.fsPath));
					this.sendEvent(new InitializedEvent()); // We're ready to start recieving breakpoints
					this.sendResponse(response);
				}
			})
			.catch((error) => {
				console.error(error);
			});
	}

	/**
	 * Frontend requested that breakpoints be set
	 */
	protected setBreakPointsRequest(response: DebugProtocol.SetBreakpointsResponse, args: DebugProtocol.SetBreakpointsArguments): void {
		this.logger.appendLine('Breakpoints requested');
		// TODO: It'll probably set the breakpoints twice in a file if a new breakpoint is added while running - so we should fix that
		if (args.source.path) {
			const filePath = this.convertClientPathToDebugger(args.source.path);

			// Attempt to set all of the breakpoints
			const breakpointIds = (args.lines || [])
				.map(lineNumber => this.correlatorHttp.setBreakpoint(filePath, lineNumber).catch((e) => null));
			Promise.all(breakpointIds)
				// Ask the correlator which breakpoints have been set
				.then(breakpointIds => {
					return this.correlatorHttp.getAllSetBreakpoints()
						.then(setBreakpoints => setBreakpoints.reduce((acc, breakpoint) => {
							acc[breakpoint.id] = breakpoint;
							return acc;
						}, {} as { [key: string]: CorrelatorBreakpoint }))
						.then(setBreakpointsById => ({ setBreakpointsById, breakpointIds }));
				})
				// Compare the attempted and the actually set to determine whether they've actually been set (and on which line)
				.then(({ setBreakpointsById, breakpointIds }) => {
					response.body = {
						breakpoints: breakpointIds.map(id => {
							if (id && setBreakpointsById[id]) {
								// Successful breakpoint
								return new Breakpoint(true, setBreakpointsById[id].line);
							} else {
								// Breakpoint failed to be set
								return new Breakpoint(false);
							}
						})
					};
					// Send the response with the list of breakpoints
					this.sendResponse(response);
				})
				.catch(() => {
					debugger;
				});
		} else {
			console.error("Unable to set breakpoints, no file path provided");
			this.sendResponse(response);
		}
	}

	/**
	 * Indication that the frontend is done setting breakpoints etc
	 */
	protected configurationDoneRequest(response: DebugProtocol.ConfigurationDoneResponse, args: DebugProtocol.ConfigurationDoneArguments): void {
		this.logger.appendLine('Configuration done');
		this.correlatorHttp.resume()
			.then(() => this.sendResponse(response))
			.then(() => this.waitForCorrelatorPause());
	}

	/**
	 * Frontend requested that the application terminate
	 */
	protected disconnectRequest(response: DebugProtocol.DisconnectResponse, args: DebugProtocol.DisconnectArguments): void {
		this.logger.appendLine("Stop requested");
		this.manager.run('.',['-s','debug_stop','-p',this.config.port.toString()]);
		this.correlatorCmd.stop().then(() => this.sendResponse(response));
	}

	protected threadsRequest(response: DebugProtocol.ThreadsResponse): void {
		this.logger.appendLine("Threads requested");
		this.correlatorHttp.getContextStatuses()
			.then(contextStatuses => contextStatuses.map(status => new Thread(status.contextid, status.context)))
			.then(threads => {
				response.body = {
					threads
				};
				this.sendResponse(response);
			});
	}

	/**
	 * Frontend requested stacktrace
	 */
	protected stackTraceRequest(response: DebugProtocol.StackTraceResponse, args: DebugProtocol.StackTraceArguments): void {
		this.logger.appendLine("Stacktrace requested");
		this.correlatorHttp.getStackTrace(args.threadId)
			.then(correlatorStackFrames => correlatorStackFrames.stackframes.map((stackframe, i) => new StackFrame(this.createFrameId(correlatorStackFrames.contextid, i), stackframe.action, this.createSource(stackframe.filename), stackframe.lineno)))
			.then(stackFrames => {
				response.body = {
					stackFrames
				};
				this.sendResponse(response);
			});
	}

	protected scopesRequest(response: DebugProtocol.ScopesResponse, args: DebugProtocol.ScopesArguments): void {
		this.logger.appendLine("Scopes requested");
		response.body = {
			scopes: [
				new Scope("Local", this.createVariablesRef(args.frameId, 'local')),
				new Scope("Monitor", this.createVariablesRef(args.frameId, 'monitor'))
			]
		};
		this.sendResponse(response);
	}

	protected variablesRequest(response: DebugProtocol.VariablesResponse, args: DebugProtocol.VariablesArguments): void {
		this.logger.appendLine("Variables requested");
		const { contextid, frameidx, type } = this.parseVariablesRef(args.variablesReference);

		this.getVariablesForType(type, contextid, frameidx)
			.then(variables => variables
				.filter(variable => variable.value !== '<uninitialized>')
				.filter(variable => !variable.name.startsWith("::"))
				// Can end up with duplicate names for variables when used in other scopes (which is super annoying), so we number them.
				.map((variable, i, variables) => {
					const count = variables.slice(0, i + 1).filter(otherVariable => otherVariable.name === variable.name).length;
					if (count > 1) {
						variable.name = `${variable.name}#${count}`;
					}
					return variable;
				})
			)
			.then(variables => variables.map(variable => new Variable(variable.name, variable.value)))
			.then(variables => {
				response.body = {
					variables
				};
				this.sendResponse(response);
			});
	}

	protected continueRequest(response: DebugProtocol.ContinueResponse, args: DebugProtocol.ContinueArguments): void {
		this.logger.appendLine("Continue requested");
		this.correlatorHttp.resume()
			.then(() => this.sendResponse(response))
			.then(() => this.waitForCorrelatorPause());
	}

	protected nextRequest(response: DebugProtocol.NextResponse, args: DebugProtocol.NextArguments): void {
		this.logger.appendLine("Next requested");
		this.correlatorHttp.stepOver()
			.then(() => this.sendResponse(response))
			.then(() => this.waitForCorrelatorPause());
	}

	protected stepInRequest(response: DebugProtocol.StepInResponse, args: DebugProtocol.StepInArguments): void {
		this.logger.appendLine("Step In requested");
		this.correlatorHttp.stepIn()
			.then(() => this.sendResponse(response))
			.then(() => this.waitForCorrelatorPause());
	}

	protected stepOutRequest(response: DebugProtocol.StepOutResponse, args: DebugProtocol.StepOutArguments): void {
		this.logger.appendLine("Step Out requested");
		this.correlatorHttp.stepOut()
			.then(() => this.sendResponse(response))
			.then(() => this.waitForCorrelatorPause());
	}

	protected setExceptionBreakPointsRequest(response: DebugProtocol.SetExceptionBreakpointsResponse, args: DebugProtocol.SetExceptionBreakpointsArguments): void {
		this.logger.appendLine("Exception breakpoint requested");
		const breakOnUncaught = args.filters.indexOf('uncaught') !== -1;
		this.correlatorHttp.setBreakOnErrors(breakOnUncaught)
			.then(() => this.sendResponse(response));
	}

	protected convertClientPathToDebugger(clientPath: string): string {
		return normalizeCorrelatorFilePath(super.convertClientPathToDebugger(clientPath));
	}

	protected convertDebuggerPathToClient(debuggerPath: string): string {
		return normalizeCorrelatorFilePath(super.convertDebuggerPathToClient(debuggerPath));
	}

	private waitForCorrelatorPause() {
		this.correlatorHttp.awaitPause()
			.then(paused => this.sendEvent(new StoppedEvent(paused.reason, paused.contextid)));
	}

	private createSource(filePath: string): Source {
		return new Source(basename(filePath), this.convertDebuggerPathToClient(filePath));
	}

	private createFrameId(contextId: number, frameidx: number): number {
		return contextId * MAX_STACK_SIZE + frameidx;
	}

	private parseFrameId(frameid: number): { contextid: number, frameidx: number } {
		const frameidx = frameid % MAX_STACK_SIZE;
		const contextid = (frameid - frameidx) / MAX_STACK_SIZE;
		return {
			contextid,
			frameidx
		};
	}

	private createVariablesRef(frameId: number, variableType: 'monitor' | 'local'): number {
		let typeNumber = 0;
		switch (variableType) {
			case 'local': typeNumber = 0; break;
			case 'monitor': typeNumber = 1; break;
		}
		return frameId * 10 + typeNumber;
	}

	private parseVariablesRef(variablesRef: number): { type: 'monitor' | 'local', contextid: number, frameidx: number } {
		const typeNumber = variablesRef % 10;
		let type: 'monitor' | 'local';
		switch (typeNumber) {
			case 0: type = 'local'; break;
			case 1: type = 'monitor'; break;
			default: throw Error("Unknown type code: " + typeNumber);
		}
		const { contextid, frameidx } = this.parseFrameId((variablesRef - typeNumber) / 10);
		return {
			type,
			contextid,
			frameidx
		};
	}

	private getVariablesForType(type: 'monitor' | 'local', contextid: number, frameidx: number) {
		switch (type) {
			case 'monitor': return this.correlatorHttp.getContextStatuses()
				.then(contextStatuses => contextStatuses.find(contextStatus => contextStatus.contextid === contextid))
				.then(possiblePause => {
					if (!possiblePause) {
						throw Error("Trying to read variables from non existent context: " + contextid);
					}
					if (!possiblePause.paused) {
						throw Error("Trying to read variables from unpaused context: " + contextid);
					}
					return possiblePause as CorrelatorPaused;
				})
				.then(pause => this.correlatorHttp.getMonitorVariables(contextid, pause.instance));
			case 'local': return this.correlatorHttp.getLocalVariables(contextid, frameidx);
		}
	}
}

export function normalizeCorrelatorFilePath(filePath: string): string {
	if (process.platform === 'win32') {
		return filePath.replace(/.+:/, match => match.toUpperCase());
	} else {
		return filePath;
	}
}