import * as vscode from 'vscode';
import { CompileError } from './icCompiler';

/**
 * DiagnosticsProvider provides VS Code diagnostics for compilation errors.
 */
export class DiagnosticsProvider {
    private diagnosticCollection: vscode.DiagnosticCollection;
    private statusBarItem: vscode.StatusBarItem;

    constructor(context: vscode.ExtensionContext) {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('ic');
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
        
        context.subscriptions.push(this.diagnosticCollection, this.statusBarItem);

        // Clear diagnostics when file is edited
        vscode.workspace.onDidChangeTextDocument(e => {
            if (e.document.languageId === 'ic' || e.document.fileName.endsWith('.ic')) {
                this.clearDiagnostics(e.document.uri);
            }
        }, null, context.subscriptions);
    }

    /**
     * Converts a list of CompileError objects to VS Code Diagnostics and updates the UI.
     * @param errors The list of compilation errors.
     */
    public updateDiagnostics(errors: CompileError[]): void {
        this.diagnosticCollection.clear();
        const diagnosticsMap = new Map<string, vscode.Diagnostic[]>();

        let errorCount = 0;

        for (const error of errors) {
            if (error.severity === 'error') {
                errorCount++;
            }
            
            const uri = vscode.Uri.file(error.file);
            const range = new vscode.Range(
                Math.max(0, error.line - 1),
                Math.max(0, error.column - 1),
                Math.max(0, error.line - 1),
                Math.max(0, error.column + 100) // Rough highlight of the error section
            );

            const diagnostic = new vscode.Diagnostic(
                range,
                error.message,
                error.severity === 'warning' ? vscode.DiagnosticSeverity.Warning : vscode.DiagnosticSeverity.Error
            );
            diagnostic.source = 'ic';

            const uriString = uri.toString();
            if (!diagnosticsMap.has(uriString)) {
                diagnosticsMap.set(uriString, []);
            }
            diagnosticsMap.get(uriString)!.push(diagnostic);
        }

        // Set diagnostics for all mapped URIs
        for (const [uriString, diagnostics] of diagnosticsMap.entries()) {
            this.diagnosticCollection.set(vscode.Uri.parse(uriString), diagnostics);
        }

        this.updateStatusBar(errorCount);
    }

    /**
     * Clears diagnostics for a specific file URI.
     * @param uri The URI of the file.
     */
    public clearDiagnostics(uri: vscode.Uri): void {
        this.diagnosticCollection.delete(uri);
        this.updateStatusBar(0); // Optional: you might want to recalculate global errors instead
    }

    /**
     * Updates the status bar with the error count.
     * @param errorCount The total number of errors.
     */
    private updateStatusBar(errorCount: number): void {
        if (errorCount > 0) {
            this.statusBarItem.text = `$(error) ${errorCount} IC Errors`;
            this.statusBarItem.show();
        } else {
            this.statusBarItem.hide();
        }
    }
}
