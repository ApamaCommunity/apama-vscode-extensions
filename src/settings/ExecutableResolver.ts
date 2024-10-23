import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

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
    path: string;
}

export type ResolveResult = ResolveSuccess | ResolveError;

export class ExecutableResolver {
    private readonly executableName: string;
    private readonly commonLocations: string[];


    private readonly pathSeparator = os.platform() === 'win32' ? ';' : ':';

    /**
     * Creates a new ExecutableResolver instance
     * @param executableName The name of the executable to find (e.g., 'python', 'git')
     * @param commonLocations Array of paths to search as a last resort
     */
    constructor(executableName: string, commonLocations: string[]) {
        this.executableName = this.normalizeExecutableName(executableName);
        this.commonLocations = commonLocations;
    }

    /**
     * Attempts to locate the executable in order of priority:
     * 1. User-specified path (if provided)
     * 2. PATH environment variable
     * 3. Common locations (single level search)
     * 
     * @param userSpecifiedPath Optional user-specified path to the executable
     * @returns ResolveResult indicating success or specific failure reason
     */
    public async resolve(userSpecifiedPath?: string): Promise<ResolveResult> {
        // 1. Check user-specified location - terminate early if provided
        if (userSpecifiedPath) {
            return await this.validatePath(userSpecifiedPath);
        }

        // 2. Check PATH environment variable
        const pathResolved = await this.findInPath();
        if ('path' in pathResolved) {
            return pathResolved;
        }

        // 3. Check common locations (single level)
        const commonResolved = await this.findInCommonLocations();
        return commonResolved;
    }

    /**
     * Normalizes the executable name based on the platform
     */
    private normalizeExecutableName(name: string): string {
        return os.platform() === 'win32' && !name.endsWith('.exe') 
            ? `${name}.exe` 
            : name;
    }

    /**
     * Validates if a path exists and is executable
     */
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

            return { path: filePath };

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

    /**
     * Checks if a file is executable based on its mode
     */
    private isExecutable(stats: fs.Stats): boolean {
        if (os.platform() === 'win32') {
            return true; // Windows executes based on file extension
        }
        // Check if file is executable by owner, group, or others
        return Boolean(stats.mode & 0o111);
    }

    /**
     * Searches for the executable in PATH
     */
    private async findInPath(): Promise<ResolveResult> {
        const envPath = process.env.PATH || '';
        const paths = envPath.split(this.pathSeparator);

        for (const dir of paths) {
            const fullPath = path.join(dir, this.executableName);
            const result = await this.validatePath(fullPath);
            if ('path' in result) {
                return result;
            }
        }

        return {
            kind: ResolveErrorKind.NotFound,
            path: "PATH",
            details: "Executable not found in any PATH location"
        };
    }

    /**
     * Searches for the executable in common locations.
     */
    private async findInCommonLocations(): Promise<ResolveResult> {
        for (const location of this.commonLocations) {
            const fullPath = path.join(location, this.executableName);
            const result = await this.validatePath(fullPath);
            if ('path' in result) {
                return result;
            }
        }

        return {
            kind: ResolveErrorKind.NotFound,
            path: this.commonLocations.join(this.pathSeparator),
            details: "Executable not found in any common location"
        };
    }
}
