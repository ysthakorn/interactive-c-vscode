import * as vscode from 'vscode';
import { IC_FUNCTIONS, IC_KEYWORDS } from './icFunctions';

export class ICCompletionItemProvider implements vscode.CompletionItemProvider {
    public provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext
    ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
        const completions: vscode.CompletionItem[] = [];

        // Provide keyword completions
        for (const kw of IC_KEYWORDS) {
            const item = new vscode.CompletionItem(kw, vscode.CompletionItemKind.Keyword);
            completions.push(item);
        }

        // Provide function completions
        for (const func of IC_FUNCTIONS) {
            const item = new vscode.CompletionItem(func.name, vscode.CompletionItemKind.Function);
            item.detail = `(${func.category}) ${func.returnType} ${func.signature}`;
            
            const doc = new vscode.MarkdownString();
            doc.appendCodeblock(`${func.returnType} ${func.signature}`, 'c');
            doc.appendMarkdown(`\n\n${func.description}`);
            if (func.boardSupport) {
                doc.appendMarkdown(`\n\n**Supported Boards:** ${func.boardSupport.join(', ')}`);
            }
            item.documentation = doc;
            completions.push(item);
        }

        return completions;
    }
}
