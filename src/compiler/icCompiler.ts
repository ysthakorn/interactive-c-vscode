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
 * ICCompiler wraps the ic.exe CLI compiler using its interactive REPL command pipe.
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

        const currentBoard = this.boardManager.getCurrentBoard() || 'ax11';
        const iclibPath = path.join(this.context.extensionPath, 'resources', 'lib', currentBoard, 'iclib.txt');

        this.outputChannel.clear();
        this.outputChannel.show(true);
        this.outputChannel.appendLine(`=========================================`);
        this.outputChannel.appendLine(`Compiling: ${path.basename(targetFile)}`);
        this.outputChannel.appendLine(`Target Board Profile: ${currentBoard.toUpperCase()} (${iclibPath})`);
        this.outputChannel.appendLine(`=========================================\n`);

        const compilerPath = this.getCompilerPath();

        return new Promise((resolve) => {
            if (!fs.existsSync(compilerPath)) {
                const errMsg = `Compiler binary not found at: ${compilerPath}`;
                this.outputChannel.appendLine(`[Error] ${errMsg}`);
                const err: CompileError = { file: targetFile!, line: 1, column: 1, message: errMsg, severity: 'error' };
                this.diagnosticsProvider.updateDiagnostics([err]);
                resolve({ success: false, output: errMsg, errors: [err] });
                return;
            }

            // Interactive C 5 CLI expects pipe input:
            // settings <iclibPath>
            // userfile <targetFile>
            // compile
            // q
            const cleanIclib = iclibPath.replace(/\\/g, '/');
            const cleanTarget = targetFile!.replace(/\\/g, '/');

            const child = spawn(compilerPath, [], { cwd: path.dirname(iclibPath) });

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

            // Write CLI commands to ic.exe stdin
            child.stdin.write(`settings ${cleanIclib}\n`);
            child.stdin.write(`userfile ${cleanTarget}\n`);
            child.stdin.write(`compile\n`);
            child.stdin.write(`q\n`);
            child.stdin.end();

            child.on('close', (code) => {
                const combinedOutput = (stdoutStr + '\n' + stderrStr).trim();
                const errors = this.parseErrors(combinedOutput, targetFile!);
                const isSuccess = combinedOutput.includes('IC: Compile success') && errors.length === 0;

                this.diagnosticsProvider.updateDiagnostics(errors);

                if (isSuccess) {
                    this.outputChannel.appendLine('\n🎉 [Success] IC Compilation finished cleanly!');
                } else {
                    this.outputChannel.appendLine(`\n❌ [Failed] Compilation finished with ${errors.length} error(s).`);
                }

                resolve({
                    success: isSuccess,
                    output: combinedOutput,
                    errors
                });
            });

            child.on('error', (err) => {
                const errMsg = `Failed to execute compiler: ${err.message}`;
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

            // Pattern: "CompilerError: file.ic : line 12 : Error : message"
            const match1 = /^CompilerError:\s*(.*?)\s*:\s*line\s*(\d+)\s*:\s*(Error|Warning)?\s*:\s*(.*)$/i.exec(trimmed);
            if (match1) {
                errors.push({
                    file: match1[1].trim() || currentFile,
                    line: parseInt(match1[2], 10) || 1,
                    column: 1,
                    message: match1[4] ? match1[4].trim() : trimmed,
                    severity: (match1[3] && match1[3].toLowerCase().includes('warning')) ? 'warning' : 'error'
                });
                continue;
            }

            // Generic Error pattern: "Error: message"
            if (trimmed.startsWith('Error:') && !trimmed.includes('Compiler command')) {
                errors.push({
                    file: currentFile,
                    line: 1,
                    column: 1,
                    message: trimmed.replace('Error:', '').trim(),
                    severity: 'error'
                });
            }
        }

        return errors;
    }
}
