import * as vscode from 'vscode';
import { IC_FUNCTIONS } from './icFunctions';

export class ICHoverProvider implements vscode.HoverProvider {
    public provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.Hover> {
        const wordRange = document.getWordRangeAtPosition(position);
        if (!wordRange) {
            return undefined;
        }

        const word = document.getText(wordRange);

        const func = IC_FUNCTIONS.find(f => f.name === word);
        if (func) {
            const doc = new vscode.MarkdownString();
            doc.appendCodeblock(`${func.returnType} ${func.signature}`, 'c');
            doc.appendMarkdown(`\n\n${func.description}`);
            if (func.boardSupport) {
                doc.appendMarkdown(`\n\n**Supported Boards:** ${func.boardSupport.join(', ')}`);
            }
            return new vscode.Hover(doc, wordRange);
        }

        return undefined;
    }
}
