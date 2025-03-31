import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { Logger } from "../logger/logger";
import { ok, err, Ok, Err } from 'neverthrow';

export enum ResolveErrorKind {
  NotFound = "NOT_FOUND",
  NotExecutable = "NOT_EXECUTABLE",
  NotAccessible = "NOT_ACCESSIBLE",
}

export interface ResolveError {
  path: string,
  errorKind: ResolveErrorKind
}

/**
 * ExecutableResolver aims to find the provided executable on the system.
 * It does so by looking at a user-provided location (if applicable), PATH, and finally,
 * a set of hard-coded common locations.
 */
export class ExecutableResolver {
  private readonly executableName: string;
  private readonly commonLocations: string[];

  private readonly logger: Logger;

  /**
   * Creates a new ExecutableResolver instance
   * @param executableName The name of the executable to find (e.g., 'python', 'git')
   * @param logger A logger instance.
   */
  constructor(executableName: string, logger: Logger) {
    this.executableName = this.normalizeExecutableName(executableName);
    if (os.platform() === "win32") {
      this.commonLocations = ["C:\\apama\\bin"];
    } else {
      this.commonLocations = ["/opt/cumulocity/Apama/bin", "/opt/Apama/bin/"];
    }
    this.logger = logger;
  }

  public async resolve(userSpecifiedPath?: string) {
    if (userSpecifiedPath) {
      return await this.validatePath(
        path.join(path.normalize(userSpecifiedPath), this.executableName),
      );
    }

    const pathResolved = await this.findInPath();
    if (pathResolved.isOk()) {
      return pathResolved; // Return the Result directly, don't wrap it in another ok()
    }

    return await this.findInCommonLocations();
  }

  private normalizeExecutableName(name: string): string {
    return os.platform() === "win32" && !name.endsWith(".exe")
      ? `${name}.exe`
      : name;
  }

  private async validatePath(filePath: string) {
    try {
      const stats = await fs.promises.stat(filePath);

      if (!stats.isFile()) {
        return err({path: filePath, errorKind: ResolveErrorKind.NotFound});
      }

      if (!this.isExecutable(stats)) {
        return err({path: filePath, errorKind: ResolveErrorKind.NotExecutable});
      }

      return ok(path.resolve(filePath))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return err({path: filePath, errorKind: ResolveErrorKind.NotFound})
      }
      return err({path: filePath, errorKind: ResolveErrorKind.NotAccessible})
    }
  }

  private isExecutable(stats: fs.Stats): boolean {
    if (os.platform() === "win32") {
      return true;
    }
    return Boolean(stats.mode & 0o111);
  }

  private async findInPath() {
    const envPath = process.env.PATH || "";
    const pathDirs = envPath
      .split(path.delimiter)
      .map((p) => path.normalize(p));

    for (const dir of pathDirs) {
      const fullPath = path.join(dir, this.executableName);
      const result = await this.validatePath(fullPath);
      if (result.isOk()) {
        return result;
      }     
    }

    return err({path: envPath, errorKind: ResolveErrorKind.NotFound})

  }

  private async findInCommonLocations() {
    for (const location of this.commonLocations) {
      const fullPath = path.join(location, this.executableName);
      const result = await this.validatePath(fullPath);
      if (result.isOk()) { 
        return result;
      }
    }

    return err({errorKind: ResolveErrorKind.NotFound, path: this.commonLocations.join(path.delimiter)});
  }
}
