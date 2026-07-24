import * as vscode from 'vscode';
import { spawn } from 'child_process';
import * as path from 'path';

export interface CompileError {
    file: string;
    line: number;
    column: number;
    message: string;
    severity: 'error' | 'warning';
}

export interface CompileResult {
    success: boolean;
    output: string;
    errors: CompileError[];
}

/**
 * ICCompiler wraps the ic.exe CLI compiler.
 */
export class ICCompiler {
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.registerCommands();
    }

    /**
     * Registers VS Code commands for compilation and downloading.
     */
    private registerCommands(): void {
        this.context.subscriptions.push(
            vscode.commands.registerCommand('ic.compile', async (fileUri?: vscode.Uri) => {
                const uri = fileUri || vscode.window.activeTextEditor?.document.uri;
                if (!uri || !uri.fsPath.endsWith('.ic')) {
                    vscode.window.showErrorMessage('Please select a valid .ic file to compile.');
                    return;
                }
                vscode.window.showInformationMessage(`Compiling ${path.basename(uri.fsPath)}...`);
                const result = await this.compile(uri.fsPath);
                if (result.success) {
                    vscode.window.showInformationMessage('Compilation successful!');
                } else {
                    vscode.window.showErrorMessage(`Compilation failed with ${result.errors.length} errors.`);
                }
            }),
            vscode.commands.registerCommand('ic.download', async () => {
                vscode.window.showInformationMessage('Download to board not yet implemented.');
            })
        );
    }

    /**
     * Resolves the compiler executable path.
     */
    private getCompilerPath(): string {
        const config = vscode.workspace.getConfiguration('ic');
        const customPath = config.get<string>('compilerPath');
        if (customPath) {
            return customPath;
        }
        return path.join(this.context.extensionPath, 'resources', 'bin', 'ic.exe');
    }

    /**
     * Compiles the specified file.
     * @param filePath The absolute path of the file to compile.
     * @returns A promise resolving to the compilation result.
     */
    public async compile(filePath: string): Promise<CompileResult> {
        return new Promise((resolve) => {
            const compilerPath = this.getCompilerPath();
            const child = spawn(compilerPath, [filePath]);

            let output = '';
            let errorOutput = '';

            child.stdout.on('data', (data) => {
                output += data.toString();
            });

            child.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });

            child.on('close', (code) => {
                const combinedOutput = output + '\n' + errorOutput;
                const errors = this.parseErrors(combinedOutput);
                resolve({
                    success: code === 0 && errors.filter(e => e.severity === 'error').length === 0,
                    output: combinedOutput,
                    errors
                });
            });

            child.on('error', (err) => {
                resolve({
                    success: false,
                    output: err.message,
                    errors: [{ file: filePath, line: 1, column: 1, message: `Failed to start compiler: ${err.message}`, severity: 'error' }]
                });
            });
        });
    }

    /**
     * Parses compiler output to extract errors and warnings.
     * @param output The combined stdout/stderr of the compiler process.
     * @returns An array of CompileError objects.
     */
    private parseErrors(output: string): CompileError[] {
        const errors: CompileError[] = [];
        // Expected Pattern: "filename:line: error message" or "filename:line:column: severity message"
        const regex = /^(.*?):(\d+)(?::(\d+))?:\s*(error|warning)?\s*(.*)$/gm;
        let match;

        while ((match = regex.exec(output)) !== null) {
            const file = match[1].trim();
            const line = parseInt(match[2], 10);
            const column = match[3] ? parseInt(match[3], 10) : 1;
            const severityStr = match[4] ? match[4].toLowerCase() : 'error';
            const message = match[5].trim();

            errors.push({
                file,
                line,
                column,
                message,
                severity: severityStr === 'warning' ? 'warning' : 'error'
            });
        }
        return errors;
    }
}
