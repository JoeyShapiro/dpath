import * as vscode from 'vscode';

export class TreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly children?: TreeItem[]
  ) {
    super(label, collapsibleState);
  }
}

export class TreeDataProvider implements vscode.TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<TreeItem | undefined | null | void> = new vscode.EventEmitter<TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  constructor() {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: TreeItem): Thenable<TreeItem[]> {
    if (element) {
      return Promise.resolve(element.children || []);
    } else {
      // Root elements
      return Promise.resolve([
        new TreeItem('Group 1', vscode.TreeItemCollapsibleState.Collapsed, [
          new TreeItem('Item 1.1', vscode.TreeItemCollapsibleState.None),
          new TreeItem('Item 1.2', vscode.TreeItemCollapsibleState.None),
        ]),
        new TreeItem('Group 2', vscode.TreeItemCollapsibleState.Collapsed, [
          new TreeItem('Item 2.1', vscode.TreeItemCollapsibleState.None),
          new TreeItem('Item 2.2', vscode.TreeItemCollapsibleState.None),
        ]),
      ]);
    }
  }
}