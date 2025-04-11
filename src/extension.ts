import * as vscode from 'vscode';
import { TreeDataProvider } from './treeDataProvider';

export function activate(context: vscode.ExtensionContext) {
	console.log('Extension "dpath" is now active!');

	const editor = vscode.window.activeTextEditor;
			if (editor) {
				const document = editor.document;
			}

	// Create the tree data provider
	const treeDataProvider = new TreeDataProvider(editor?.document.fileName || '');

	// Register the tree view
	const treeView = vscode.window.createTreeView('dpath', {
		treeDataProvider: treeDataProvider,
		showCollapseAll: true
	});

	vscode.window.onDidChangeActiveTextEditor(editor => {
		if (editor) {
			treeDataProvider.refresh(editor.document.fileName);
		}
	});

	// Register refresh command
	context.subscriptions.push(
		vscode.commands.registerCommand('dpath.refresh', () => {
			const editor = vscode.window.activeTextEditor;
			if (editor) {
				const document = editor.document;
				treeDataProvider.refresh(document.fileName);
			}
		})
	);

	// Add the tree view to the context subscriptions
	context.subscriptions.push(treeView);
}

export function deactivate() { }