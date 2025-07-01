// src/extension.ts - VS Code 插件主入口
// 依赖模块类型声明需通过 npm 安装后解决 linter 错误
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand('gitDiffPatchGenerator.generatePatch', async () => {
    const tab = vscode.window.tabGroups.activeTabGroup.activeTab;
    if (!tab || !tab.label) {
      vscode.window.showErrorMessage('未能获取当前标签信息。');
      return;
    }
    // 解析标签，格式如：auxiliaryBarPart.css (24a2f307) ↔ auxiliaryBarPart.css (22d1bfc7)
    const label = tab.label;
    const match = label.match(/\((\w{7,40})\)\s*↔\s*.*\((\w{7,40})\)/);
    if (!match) {
      vscode.window.showErrorMessage('未能从标签解析出 commit 哈希。');
      return;
    }
    const hash1 = match[1];
    const hash2 = match[2];

    // 获取文件路径
    let filePath = '';
    if (tab.input && (tab.input as any).modified && (tab.input as any).original) {
      // 兼容新版 VS Code API
      const modified = (tab.input as any).modified;
      filePath = vscode.Uri.parse(modified.uri || modified).fsPath;
    } else if ((tab as any).resource) {
      // 兼容旧版 API
      filePath = (tab as any).resource.fsPath;
    } else {
      vscode.window.showErrorMessage('未能获取对比文件路径。');
      return;
    }
    // 获取相对路径
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(filePath));
    if (!workspaceFolder) {
      vscode.window.showErrorMessage('未能定位到工作区。');
      return;
    }
    const relPath = path.relative(workspaceFolder.uri.fsPath, filePath);

    // 生成 patch 文件名
    const patchFileName = `${path.basename(filePath)}.${hash1}_${hash2}.patch`;
    const patchFilePath = path.join(workspaceFolder.uri.fsPath, patchFileName);

    // 执行 git diff
    const gitCmd = `git diff ${hash1} ${hash2} -- "${relPath}" > "${patchFilePath}"`;
    exec(gitCmd, { cwd: workspaceFolder.uri.fsPath }, (err: Error | null) => {
      if (err) {
        vscode.window.showErrorMessage('生成 patch 失败: ' + err.message);
      } else {
        vscode.window.showInformationMessage(`Patch 文件已生成: ${patchFileName}`);
        vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(patchFilePath));
      }
    });
  });
  context.subscriptions.push(disposable);
}

export function deactivate() {} 