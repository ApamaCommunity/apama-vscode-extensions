import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Logger } from '../logger/logger';

export enum ResolveErrorKind {
    NotFound = "NOT_FOUND",
    NotExecutable = "NOT_EXECUTABLE",
    NotAccessible = "NOT_ACCESSIBLE",
}

export interface ResolveError {
    kind: ResolveErrorKind;
    path: string;
    details?: string;
}

export interface ResolveSuccess {
    kind: "success";
    path: string;
}

export type ResolveResult = ResolveSuccess | ResolveError;

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
        if (os.platform() === 'win32') {
            this.commonLocations = [
                "C:\\apama\\bin",
            ]; 
        } else {
            this.commonLocations = [
                "/opt/cumulocity/Apama/bin",
                "/opt/Apama/bin/"
            ]; 
        }
        this.logger = logger;
    }

    public async resolve(userSpecifiedPath?: string): Promise<ResolveResult> {
        if (userSpecifiedPath) {
            return await this.validatePath(path.join(path.normalize(userSpecifiedPath), this.executableName));
        }

        const pathResolved = await this.findInPath();
        if (pathResolved.kind === "success") {
            return pathResolved;
        }

        return await this.findInCommonLocations();
    }

    private normalizeExecutableName(name: string): string {
        return os.platform() === 'win32' && !name.endsWith('.exe') 
            ? `${name}.exe` 
            : name;
    }

    private async validatePath(filePath: string): Promise<ResolveResult> {
        try {
            const stats = await fs.promises.stat(filePath);
            
            if (!stats.isFile()) {
                return {
                    kind: ResolveErrorKind.NotFound,
                    path: filePath,
                    details: "Path exists but is not a file"
                };
            }

            if (!this.isExecutable(stats)) {
                return {
                    kind: ResolveErrorKind.NotExecutable,
                    path: filePath,
                    details: "File exists but is not executable"
                };
            }

            return { 
                kind: "success",
                path: path.resolve(filePath) 
            };

        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                return {
                    kind: ResolveErrorKind.NotFound,
                    path: filePath,
                    details: "File does not exist"
                };
            }
            return {
                kind: ResolveErrorKind.NotAccessible,
                path: filePath,
                details: (error as Error).message
            };
        }
    }

    private isExecutable(stats: fs.Stats): boolean {
        if (os.platform() === 'win32') {
            return true;
        }
        return Boolean(stats.mode & 0o111);
    }

    private async findInPath(): Promise<ResolveResult> {
        const envPath = process.env.PATH || '';
        const pathDirs = envPath.split(path.delimiter)
            .map(p => path.normalize(p));

        for (const dir of pathDirs) {
            const fullPath = path.join(dir, this.executableName);
            const result = await this.validatePath(fullPath);
            if (result.kind === "success") {
                return result;
            }
        }

        return {
            kind: ResolveErrorKind.NotFound,
            path: envPath,
            details: "Executable not found in any PATH location"
        };
    }

    private async findInCommonLocations(): Promise<ResolveResult> {
        for (const location of this.commonLocations) {
            const fullPath = path.join(location, this.executableName);
            const result = await this.validatePath(fullPath);
            if (result.kind === "success") {
                return result;
            }
        }

        return {
            kind: ResolveErrorKind.NotFound,
            path: this.commonLocations.join(path.delimiter),
            details: "Executable not found in any common location"
        };
    }
}