import * as vscode from "vscode";

enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

export class Logger {
  private outputChannel: vscode.OutputChannel;
  private logLevel: LogLevel;
  private extensionName: string;

  constructor(extensionName: string) {
    this.outputChannel = vscode.window.createOutputChannel(extensionName);
    this.logLevel = this.getConfiguredLogLevel();
    this.extensionName = extensionName;
  }

  private getConfiguredLogLevel(): LogLevel {
    const config = vscode.workspace.getConfiguration(this.extensionName);
    const configuredLevel = config.get<string>("logLevel", "info");
    switch (configuredLevel.toLowerCase()) {
      case "debug":
        return LogLevel.DEBUG;
      case "info":
        return LogLevel.INFO;
      case "warn":
        return LogLevel.WARN;
      case "error":
        return LogLevel.ERROR;
      default:
        return LogLevel.INFO;
    }
  }

  private log(level: LogLevel, message: string) {
    if (level <= this.logLevel) {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] [${LogLevel[level]}] ${message}`;
      this.outputChannel.appendLine(logMessage);
    }
  }

  // Wrapper for existing calls to appendLine.
  public appendLine(message: string) {
    this.info(message);
  }

  public error(message: string, error?: Error) {
    let fullMessage = message;
    if (error) {
      fullMessage += `\n${error.message}\n${error.stack}`;
    }
    this.log(LogLevel.ERROR, fullMessage);
  }

  public warn(message: string) {
    this.log(LogLevel.WARN, message);
  }

  public info(message: string) {
    this.log(LogLevel.INFO, message);
  }

  public debug(message: string) {
    this.log(LogLevel.DEBUG, message);
  }
}
