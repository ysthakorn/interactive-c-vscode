import * as vscode from 'vscode';

export class BoardDiagramPanel {
    public static currentPanel: BoardDiagramPanel | undefined;
    public static readonly viewType = 'icBoardDiagram';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (BoardDiagramPanel.currentPanel) {
            BoardDiagramPanel.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            BoardDiagramPanel.viewType,
            'Board Diagram',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
            }
        );

        BoardDiagramPanel.currentPanel = new BoardDiagramPanel(panel, extensionUri);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._update();
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    }

    public dispose() {
        BoardDiagramPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private _update() {
        this._panel.webview.html = this._getHtmlForWebview();
    }

    private _getHtmlForWebview() {
        const nonce = this.getNonce();
        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Board Diagram</title>
                <style>
                    body { font-family: var(--vscode-font-family); color: var(--vscode-editor-foreground); background-color: var(--vscode-editor-background); padding: 20px; }
                    .info { margin-bottom: 20px; padding: 10px; border: 1px solid var(--vscode-panel-border); }
                    .pins { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
                </style>
            </head>
            <body>
                <h1>Handy Board</h1>
                <div class="info">
                    <p><strong>Processor:</strong> Motorola 68HC11</p>
                    <p><strong>Motors:</strong> 4</p>
                    <p><strong>Servos:</strong> 2</p>
                    <p><strong>Analog Channels:</strong> 7</p>
                    <p><strong>Digital Channels:</strong> 9</p>
                </div>
                <h2>Pins</h2>
                <div class="pins">
                    <div>Analog 0-6</div>
                    <div>Digital 7-15</div>
                    <div>Motor 0-3</div>
                    <div>Servo 0-1</div>
                </div>
            </body>
            </html>`;
    }

    private getNonce() {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }
}
