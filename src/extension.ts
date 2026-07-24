import * as vscode from 'vscode';
import { ICCompletionItemProvider } from './language/completionProvider';
import { ICHoverProvider } from './language/hoverProvider';
import { BoardManager } from './board/boardManager';
import { SerialManager } from './serial/serialManager';
import { ICCompiler } from './compiler/icCompiler';
import { DiagnosticsProvider } from './compiler/diagnosticsProvider';
import { ICTerminal } from './terminal/icTerminal';
import { FirmwareWizardPanel } from './webview/firmwareWizard';
import { BoardDiagramPanel } from './webview/boardDiagram';
import { FunctionReferencePanel } from './webview/functionReference';
import { FirmwareDownloader } from './board/firmwareDownloader';
import { BoardInfoTreeProvider, FunctionsTreeProvider, SensorsMotorsTreeProvider } from './views/treeViewProviders';

export function activate(context: vscode.ExtensionContext) {
    console.log('Interactive C extension is now active!');

    // Initialize core components
    const boardManager = new BoardManager(context);
    const serialManager = new SerialManager(context);
    const diagnosticsProvider = new DiagnosticsProvider(context);
    const compiler = new ICCompiler(context, boardManager, serialManager, diagnosticsProvider);
    const firmwareDownloader = new FirmwareDownloader(boardManager, serialManager);

    context.subscriptions.push(boardManager, serialManager);

    // Register Tree Views in Sidebar (ic-explorer)
    const boardInfoTreeProvider = new BoardInfoTreeProvider(boardManager);
    const functionsTreeProvider = new FunctionsTreeProvider();
    const sensorsMotorsTreeProvider = new SensorsMotorsTreeProvider(boardManager);

    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('ic-board-info', boardInfoTreeProvider),
        vscode.window.registerTreeDataProvider('ic-functions', functionsTreeProvider),
        vscode.window.registerTreeDataProvider('ic-sensors', sensorsMotorsTreeProvider)
    );

    // Register Language Providers (.ic)
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider('ic', new ICCompletionItemProvider(), '.')
    );
    context.subscriptions.push(
        vscode.languages.registerHoverProvider('ic', new ICHoverProvider())
    );

    // Register Helper Command for Code Insertion
    context.subscriptions.push(
        vscode.commands.registerCommand('ic.insertText', (text: string) => {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                editor.edit(editBuilder => {
                    editBuilder.insert(editor.selection.active, text);
                });
            }
        })
    );

    // Register Commands
    context.subscriptions.push(
        vscode.commands.registerCommand('ic.compile', async (uri?: vscode.Uri) => {
            const result = await compiler.compile(uri?.fsPath);
            if (result.success) {
                vscode.window.showInformationMessage('Compilation successful!');
            } else {
                vscode.window.showErrorMessage(`Compilation failed with ${result.errors.length} error(s). Check Output channel for details.`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('ic.download', async () => {
            await firmwareDownloader.downloadFirmware();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('ic.connect', () => {
            serialManager.connect();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('ic.disconnect', () => {
            serialManager.disconnect();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('ic.selectBoard', () => {
            boardManager.selectBoard();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('ic.selectPort', () => {
            serialManager.selectPort();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('ic.firmwareWizard', () => {
            FirmwareWizardPanel.createOrShow(context.extensionUri);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('ic.boardDiagram', () => {
            BoardDiagramPanel.createOrShow(context.extensionUri);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('ic.functionReference', () => {
            FunctionReferencePanel.createOrShow(context.extensionUri);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('ic.openTerminal', () => {
            const pty = new ICTerminal();
            const terminal = vscode.window.createTerminal({ name: 'IC Terminal', pty });
            terminal.show();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('ic.newProject', async () => {
            const templates = [
                'AX-11 Blank Project',
                'AX-11 Line Follower',
                'AX-11 Obstacle Avoidance (GP2D120)',
                'Handy Board Motor Test',
                'Sumo11 Test Program',
                'RCX Robot Test'
            ];
            const selected = await vscode.window.showQuickPick(templates, {
                placeHolder: 'Select a project template'
            });
            if (selected) {
                vscode.window.showInformationMessage(`Creating ${selected} template...`);
            }
        })
    );
}

export function deactivate() {
    // Cleanup handled by context.subscriptions
}
