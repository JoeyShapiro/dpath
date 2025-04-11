import * as vscode from 'vscode';
import { TreeDataProvider } from './treeDataProvider';

export function activate(context: vscode.ExtensionContext) {
  console.log('Extension "dpath" is now active!');

  // Create the tree data provider
  const treeDataProvider = new TreeDataProvider();
  
  // Register the tree view
  const treeView = vscode.window.createTreeView('dpath', {
    treeDataProvider: treeDataProvider,
    showCollapseAll: true
  });

  // Register refresh command
  context.subscriptions.push(
    vscode.commands.registerCommand('dpath.refresh', () => {
      treeDataProvider.refresh();
    })
  );

  // Add the tree view to the context subscriptions
  context.subscriptions.push(treeView);
}

export function deactivate() {}