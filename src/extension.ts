// src/extension.ts - VS Code 插件主入口
// 依赖模块类型声明需通过 npm 安装后解决 linter 错误
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';

function getPatchOutputDir(workspaceFolder: vscode.WorkspaceFolder): string {
  // 读取用户配置
  const config = vscode.workspace.getConfiguration('gitDiffPatchGenerator', workspaceFolder);
  let outputDir = config.get<string>('patchOutputDir');
  if (!outputDir) {
    outputDir = 'patch'; // 默认 patch 目录
  }
  const absDir = path.isAbsolute(outputDir) ? outputDir : path.join(workspaceFolder.uri.fsPath, outputDir);
  if (!fs.existsSync(absDir)) {
    fs.mkdirSync(absDir, { recursive: true });
  }
  return absDir;
}

export function activate(context: vscode.ExtensionContext) {
  // 调试信息
  console.log('插件已激活');
  vscode.window.showInformationMessage('Git Diff Patch Generator 插件已激活');

  // 右键菜单命令：从 diff 视图生成 patch
  const disposable = vscode.commands.registerCommand('gitDiffPatchGenerator.generatePatch', async () => {
    const tab = vscode.window.tabGroups.activeTabGroup.activeTab;
    console.log('当前tab信息:', tab);
    if (!tab || !tab.label) {
      vscode.window.showErrorMessage('未能获取当前标签信息。');
      return;
    }
    // 解析标签
    const label = tab.label;
    const match = label.match(/\((\w{7,40})\)\s*↔\s*.*\((\w{7,40})\)/);
    if (!match) {
      vscode.window.showErrorMessage('未能从标签解析出 commit 哈希。');
      return;
    }
    const hash1 = match[1];
    const hash2 = match[2];
    console.log('解析到 commit:', hash1, hash2);

    // 获取文件路径
    let filePath = '';
    if (tab.input && (tab.input as any).modified && (tab.input as any).original) {
      const modified = (tab.input as any).modified;
      filePath = vscode.Uri.parse(modified.uri || modified).fsPath;
    } else if ((tab as any).resource) {
      filePath = (tab as any).resource.fsPath;
    } else {
      vscode.window.showErrorMessage('未能获取对比文件路径。');
      return;
    }
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(filePath));
    if (!workspaceFolder) {
      vscode.window.showErrorMessage('未能定位到工作区。');
      return;
    }
    const relPath = path.relative(workspaceFolder.uri.fsPath, filePath);
    const patchDir = getPatchOutputDir(workspaceFolder);
    const patchFileName = `${path.basename(filePath)}.${hash1}_${hash2}.patch`;
    const patchFilePath = path.join(patchDir, patchFileName);
    console.log('patch 路径:', patchFilePath);

    // 执行 git diff
    const gitCmd = `git diff ${hash1} ${hash2} -- "${relPath}" > "${patchFilePath}"`;
    console.log('执行命令:', gitCmd);
    exec(gitCmd, { cwd: workspaceFolder.uri.fsPath }, (err: Error | null) => {
      if (err) {
        vscode.window.showErrorMessage('生成 patch 失败: ' + err.message);
        console.error('生成 patch 失败:', err);
      } else {
        vscode.window.showInformationMessage(`Patch 文件已生成: ${patchFileName}`);
        vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(patchFilePath));
      }
    });
  });

  // 新命令：输入 commit id 生成完整 patch
  const disposable2 = vscode.commands.registerCommand('gitDiffPatchGenerator.generateFullPatch', async () => {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showErrorMessage('未打开任何工作区。');
      return;
    }
    const workspaceFolder = workspaceFolders[0];
    const commitId = await vscode.window.showInputBox({
      prompt: '请输入 commit id（如 24a2f307）',
      validateInput: (v) => v && v.length >= 7 ? undefined : '请输入至少7位 commit id',
    });
    if (!commitId) {
      return;
    }
    const patchDir = getPatchOutputDir(workspaceFolder);
    const patchFileName = `full_${commitId}.patch`;
    const patchFilePath = path.join(patchDir, patchFileName);
    const gitCmd = `git format-patch -1 ${commitId} --stdout > "${patchFilePath}"`;
    console.log('执行命令:', gitCmd);
    exec(gitCmd, { cwd: workspaceFolder.uri.fsPath }, (err: Error | null) => {
      if (err) {
        vscode.window.showErrorMessage('生成完整 patch 失败: ' + err.message);
        console.error('生成完整 patch 失败:', err);
      } else {
        vscode.window.showInformationMessage(`完整 Patch 文件已生成: ${patchFileName}`);
        vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(patchFilePath));
      }
    });
  });

  context.subscriptions.push(disposable, disposable2);
}

export function deactivate() {} 