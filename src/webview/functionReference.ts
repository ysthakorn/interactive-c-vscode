import * as vscode from 'vscode';

export class FunctionReferencePanel {
    public static currentPanel: FunctionReferencePanel | undefined;
    public static readonly viewType = 'icFunctionReference';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (FunctionReferencePanel.currentPanel) {
            FunctionReferencePanel.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            FunctionReferencePanel.viewType,
            'Function Reference',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
            }
        );

        FunctionReferencePanel.currentPanel = new FunctionReferencePanel(panel, extensionUri);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        this._update();

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'insertFunction':
                        this.insertFunction(message.text);
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    private insertFunction(text: string) {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            editor.edit(editBuilder => {
                editBuilder.insert(editor.selection.active, text);
            });
        }
    }

    public dispose() {
        FunctionReferencePanel.currentPanel = undefined;
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
                <title>Function Reference</title>
                <style>
                    body { font-family: var(--vscode-font-family); color: var(--vscode-editor-foreground); background-color: var(--vscode-editor-background); padding: 20px; }
                    input { width: 100%; padding: 8px; margin-bottom: 20px; box-sizing: border-box; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); }
                    .category { margin-top: 20px; }
                    .function { margin-bottom: 10px; padding: 10px; border: 1px solid var(--vscode-panel-border); cursor: pointer; }
                    .function:hover { background-color: var(--vscode-list-hoverBackground); }
                    .name { font-weight: bold; color: var(--vscode-symbolIcon-functionForeground); }
                    .sig { font-family: monospace; }
                </style>
            </head>
            <body>
                <h1>IC Function Reference</h1>
                <input type="text" id="search" placeholder="Search functions...">
                
                <div class="category">
                    <h2>Motor Control</h2>
                    <div class="function" onclick="insert('motor(int m, int p);')">
                        <div class="name">motor</div>
                        <div class="sig">void motor(int m, int p);</div>
                        <div class="desc">Turns on motor m at power level p.</div>
                        <div class="compat">All boards</div>
                    </div>
                    <div class="function" onclick="insert('fd(int m);')">
                        <div class="name">fd</div>
                        <div class="sig">void fd(int m);</div>
                        <div class="desc">Turns motor m on forward.</div>
                        <div class="compat">All boards</div>
                    </div>
                </div>

                <div class="category">
                    <h2>Sensor Input</h2>
                    <div class="function" onclick="insert('analog(int p);')">
                        <div class="name">analog</div>
                        <div class="sig">int analog(int p);</div>
                        <div class="desc">Returns analog value of port p.</div>
                        <div class="compat">All boards</div>
                    </div>
                </div>

                <script nonce="${nonce}">
                    const vscode = acquireVsCodeApi();
                    
                    function insert(text) {
                        vscode.postMessage({
                            command: 'insertFunction',
                            text: text
                        });
                    }
                    
                    document.getElementById('search').addEventListener('input', function(e) {
                        const term = e.target.value.toLowerCase();
                        document.querySelectorAll('.function').forEach(el => {
                            if (el.textContent.toLowerCase().includes(term)) {
                                el.style.display = 'block';
                            } else {
                                el.style.display = 'none';
                            }
                        });
                    });
                </script>
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
