import * as vscode from 'vscode';

export class FirmwareWizardPanel {
    public static currentPanel: FirmwareWizardPanel | undefined;
    public static readonly viewType = 'icFirmwareWizard';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (FirmwareWizardPanel.currentPanel) {
            FirmwareWizardPanel.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            FirmwareWizardPanel.viewType,
            'Firmware Wizard',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
            }
        );

        FirmwareWizardPanel.currentPanel = new FirmwareWizardPanel(panel, extensionUri);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        this._update();

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'alert':
                        vscode.window.showErrorMessage(message.text);
                        return;
                    case 'download':
                        vscode.window.showInformationMessage('Downloading firmware...');
                        return;
                    case 'cancel':
                        this.dispose();
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    public dispose() {
        FirmwareWizardPanel.currentPanel = undefined;
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
                <title>Firmware Wizard</title>
                <style>
                    body { font-family: var(--vscode-font-family); color: var(--vscode-editor-foreground); background-color: var(--vscode-editor-background); padding: 20px; }
                    .step { display: none; }
                    .step.active { display: block; }
                    button { background-color: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 8px 12px; cursor: pointer; margin-right: 8px; }
                    button:hover { background-color: var(--vscode-button-hoverBackground); }
                </style>
            </head>
            <body>
                <h1>Firmware Download Wizard</h1>
                
                <div id="step1" class="step active">
                    <h2>Step 1: Select COM Port</h2>
                    <p>Select the COM port your board is connected to.</p>
                    <button id="next1">Next</button>
                    <button class="cancel">Cancel</button>
                </div>
                
                <div id="step2" class="step">
                    <h2>Step 2: Connect Cable</h2>
                    <p>Ensure your serial cable is connected securely to the board and PC.</p>
                    <button id="back2">Back</button>
                    <button id="next2">Next</button>
                    <button class="cancel">Cancel</button>
                </div>
                
                <div id="step3" class="step">
                    <h2>Step 3: Enter Bootstrap Mode</h2>
                    <p>Turn off the board, hold down the bootstrap button, and turn it back on.</p>
                    <button id="back3">Back</button>
                    <button id="next3">Next</button>
                    <button class="cancel">Cancel</button>
                </div>

                <div id="step4" class="step">
                    <h2>Step 4: Download Firmware</h2>
                    <p>Ready to download.</p>
                    <button id="back4">Back</button>
                    <button id="download">Download Firmware</button>
                    <button class="cancel">Cancel</button>
                </div>

                <div id="step5" class="step">
                    <h2>Complete</h2>
                    <p>Firmware download finished successfully.</p>
                    <button id="finish">Finish</button>
                </div>

                <script nonce="${nonce}">
                    const vscode = acquireVsCodeApi();
                    
                    document.getElementById('next1').addEventListener('click', () => { showStep(2); });
                    document.getElementById('back2').addEventListener('click', () => { showStep(1); });
                    document.getElementById('next2').addEventListener('click', () => { showStep(3); });
                    document.getElementById('back3').addEventListener('click', () => { showStep(2); });
                    document.getElementById('next3').addEventListener('click', () => { showStep(4); });
                    document.getElementById('back4').addEventListener('click', () => { showStep(3); });
                    
                    document.getElementById('download').addEventListener('click', () => { 
                        vscode.postMessage({ command: 'download' });
                        showStep(5);
                    });
                    
                    document.getElementById('finish').addEventListener('click', () => {
                        vscode.postMessage({ command: 'cancel' });
                    });
                    
                    document.querySelectorAll('.cancel').forEach(btn => {
                        btn.addEventListener('click', () => {
                            vscode.postMessage({ command: 'cancel' });
                        });
                    });

                    function showStep(stepNumber) {
                        document.querySelectorAll('.step').forEach(el => el.classList.remove('active'));
                        document.getElementById('step' + stepNumber).classList.add('active');
                    }
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
