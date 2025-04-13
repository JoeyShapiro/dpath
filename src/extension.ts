import * as vscode from 'vscode';
import { TreeDataProvider } from './treeDataProvider';

export function activate(context: vscode.ExtensionContext) {
	console.log('Extension "dpath" is now active!');

	const editor = vscode.window.activeTextEditor;

	// Create the tree data provider
	const line = editor?.selection.active.line || 0 + 1; // +1 to make it 1-based
	const treeDataProvider = new TreeDataProvider(editor?.document.fileName, editor?.document.languageId, line);

	// Register the tree view
	const treeView = vscode.window.createTreeView('dpath', {
		treeDataProvider: treeDataProvider,
		showCollapseAll: true
	});

	vscode.window.onDidChangeActiveTextEditor(editor => {
		if (editor) {
			treeDataProvider.refresh(editor.document.fileName, editor.document.languageId, editor.selection.active.line+1);
		}
	});

	const debouncedOnCursorStable = debounce((editor: vscode.TextEditorSelectionChangeEvent) => {
		if (editor) {
			treeDataProvider.refresh(editor.textEditor.document.fileName, editor.textEditor.document.languageId, editor.selections[0].active.line+1);
		}
	}, 1000);
	vscode.window.onDidChangeTextEditorSelection(editor => {
		debouncedOnCursorStable(editor);
	});

	// Register refresh command
	context.subscriptions.push(
		vscode.commands.registerCommand('dpath.refresh', () => {
			const editor = vscode.window.activeTextEditor;
			if (editor) {
				const document = editor.document;
				treeDataProvider.refresh(document.fileName, document.languageId, editor.selection.active.line);
			}
		}),
		vscode.commands.registerCommand('dpath.jump', (line: number) => {
			const editor = vscode.window.activeTextEditor;
			if (editor) {
				const position = new vscode.Position(line - 1, 0);
				editor.revealRange(new vscode.Range(position, position));
				editor.selection = new vscode.Selection(position, position);
			}
		})
	);

	// Add the tree view to the context subscriptions
	context.subscriptions.push(treeView);
}

export function deactivate() { }

function debounce(func: Function, wait: number): (...args: any[]) => void {
	let timeout: NodeJS.Timeout | null = null;
	
	return function(...args: any[]) {
	  // Clear the previous timeout if there is one
	  if (timeout) {
		clearTimeout(timeout);
	  }
	  
	  // Set a new timeout
	  timeout = setTimeout(() => {
		func(...args);
	  }, wait);
	};
  }
