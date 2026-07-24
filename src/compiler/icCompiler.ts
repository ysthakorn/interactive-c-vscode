import * as vscode from 'vscode';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { BoardManager } from '../board/boardManager';
import { SerialManager } from '../serial/serialManager';
import { DiagnosticsProvider } from './diagnosticsProvider';

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
    private outputChannel: vscode.OutputChannel;

    constructor(
        private context: vscode.ExtensionContext,
        private boardManager: BoardManager,
        private serialManager: SerialManager,
        private diagnosticsProvider: DiagnosticsProvider
    ) {
        this.outputChannel = vscode.window.createOutputChannel('Interactive C Compiler');
        this.context.subscriptions.push(this.outputChannel);
    }

    /**
     * Resolves the compiler executable path.
     */
    private getCompilerPath(): string {
        const config = vscode.workspace.getConfiguration('ic');
        const customPath = config.get<string>('icPath');
        if (customPath && fs.existsSync(customPath)) {
            return customPath;
        }
        return path.join(this.context.extensionPath, 'resources', 'bin', 'ic.exe');
    }

    /**
     * Compiles the specified file or current active file.
     * @param filePath Optional file path.
     * @returns A promise resolving to the compilation result.
     */
    public async compile(filePath?: string): Promise<CompileResult> {
        let targetFile = filePath;
        if (!targetFile) {
            const activeDoc = vscode.window.activeTextEditor?.document;
            if (activeDoc && (activeDoc.languageId === 'ic' || activeDoc.fileName.endsWith('.ic'))) {
                targetFile = activeDoc.fileName;
            }
        }

        if (!targetFile) {
            vscode.window.showErrorMessage('Please open an Interactive C (.ic) file to compile.');
            return { success: false, output: 'No file selected.', errors: [] };
        }

        this.outputChannel.clear();
        this.outputChannel.show(true);
        this.outputChannel.appendLine(`=========================================`);
        this.outputChannel.appendLine(`Compiling: ${path.basename(targetFile)}`);
        this.outputChannel.appendLine(`Target Board: ${this.boardManager.getCurrentBoard() || 'ax11'}`);
        this.outputChannel.appendLine(`=========================================\n`);

        const compilerPath = this.getCompilerPath();
        const currentBoard = this.boardManager.getCurrentBoard() || 'ax11';
        const libDir = path.join(this.context.extensionPath, 'resources', 'lib', currentBoard);

        return new Promise((resolve) => {
            if (!fs.existsSync(compilerPath)) {
                const errMsg = `Compiler binary not found at: ${compilerPath}`;
                this.outputChannel.appendLine(`[Error] ${errMsg}`);
                const err: CompileError = { file: targetFile!, line: 1, column: 1, message: errMsg, severity: 'error' };
                this.diagnosticsProvider.updateDiagnostics([err]);
                resolve({ success: false, output: errMsg, errors: [err] });
                return;
            }

            // Spawn compiler: ic.exe -l <libdir> <filepath>
            const args = ['-l', libDir, targetFile!];
            this.outputChannel.appendLine(`Running: ${compilerPath} ${args.join(' ')}\n`);

            const child = spawn(compilerPath, args, { cwd: path.dirname(targetFile!) });

            let stdoutStr = '';
            let stderrStr = '';

            child.stdout.on('data', (data) => {
                const text = data.toString();
                stdoutStr += text;
                this.outputChannel.append(text);
            });

            child.stderr.on('data', (data) => {
                const text = data.toString();
                stderrStr += text;
                this.outputChannel.append(text);
            });

            child.on('close', (code) => {
                const combinedOutput = (stdoutStr + '\n' + stderrStr).trim();
                let errors = this.parseErrors(combinedOutput, targetFile!);

                if (code !== 0 && errors.length === 0) {
                    // Fallback error if process exited non-zero but no regex line match
                    const summaryMsg = combinedOutput || `Compiler process exited with code ${code}`;
                    errors.push({
                        file: targetFile!,
                        line: 1,
                        column: 1,
                        message: summaryMsg,
                        severity: 'error'
                    });
                }

                const isSuccess = code === 0 && errors.filter(e => e.severity === 'error').length === 0;

                this.diagnosticsProvider.updateDiagnostics(errors);

                if (isSuccess) {
                    this.outputChannel.appendLine('\n[Success] Compilation finished cleanly!');
                } else {
                    this.outputChannel.appendLine(`\n[Failed] Compilation finished with ${errors.length} error(s).`);
                }

                resolve({
                    success: isSuccess,
                    output: combinedOutput,
                    errors
                });
            });

            child.on('error', (err) => {
                const errMsg = `Failed to start compiler executable: ${err.message}`;
                this.outputChannel.appendLine(`\n[Error] ${errMsg}`);
                const compileErr: CompileError = {
                    file: targetFile!,
                    line: 1,
                    column: 1,
                    message: errMsg,
                    severity: 'error'
                };
                this.diagnosticsProvider.updateDiagnostics([compileErr]);
                resolve({
                    success: false,
                    output: err.message,
                    errors: [compileErr]
                });
            });
        });
    }

    /**
     * Parses compiler output to extract errors and warnings.
     */
    private parseErrors(output: string, currentFile: string): CompileError[] {
        const errors: CompileError[] = [];
        const lines = output.split(/\r?\n/);

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            // Pattern 1: "file.ic:15: error: syntax error"
            const match1 = /^(.*?):(\d+)(?::(\d+))?:\s*(error|warning|fatal error)?\s*(.*)$/i.exec(trimmed);
            if (match1) {
                errors.push({
                    file: match1[1].trim() || currentFile,
                    line: parseInt(match1[2], 10) || 1,
                    column: match1[3] ? parseInt(match1[3], 10) : 1,
                    message: match1[5] ? match1[5].trim() : trimmed,
                    severity: (match1[4] && match1[4].toLowerCase().includes('warning')) ? 'warning' : 'error'
                });
                continue;
            }

            // Pattern 2: "Line 15: Error message"
            const match2 = /^line\s+(\d+):\s*(.*)$/i.exec(trimmed);
            if (match2) {
                errors.push({
                    file: currentFile,
                    line: parseInt(match2[1], 10) || 1,
                    column: 1,
                    message: match2[2].trim(),
                    severity: 'error'
                });
            }
        }

        return errors;
    }
}
