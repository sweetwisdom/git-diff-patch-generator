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
  // vscode.window.showInformationMessage('Git Diff Patch Generator 插件已激活');

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

  // 新命令：输入 commit id 生成完整 patch（支持 timeline 右键自动带入 commit id）
// 参考 git.timeline.copyCommitId 的实现方式
const disposable2 = vscode.commands.registerCommand('gitDiffPatchGenerator.generateFullPatch', async (item?: any, ...args: any[]) => {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage('未打开任何工作区。');
    return;
  }
  const workspaceFolder = workspaceFolders[0];
  let commitId: string | undefined|null;

  // 调试信息
  console.log('=== Timeline 参数调试 ===');
  console.log('item:', item);
  console.log('item 类型:', typeof item);
  console.log('其他参数:', args);

  // 方法1: 检查 item 是否是 GitTimelineItem 类型
  if (item) {
    console.log('item 的所有属性:', Object.keys(item));
    console.log('item 详细信息:', JSON.stringify(item, null, 2));
    
    // 检查常见的 commit id 属性
    const possibleCommitProps = ['id', 'ref', 'commitish', 'sha', 'hash', 'revision'];
    for (const prop of possibleCommitProps) {
      if (item[prop] && typeof item[prop] === 'string') {
        const value = item[prop];
        if (/^[a-f0-9]{7,40}$/i.test(value)) {
          commitId = value;
          console.log(`✅ 从 item.${prop} 获取 commit id:`, commitId);
          break;
        }
      }
    }
    
    // 检查 resourceUri
    if (!commitId && item.resourceUri) {
      console.log('resourceUri:', item.resourceUri);
      
      // 从 URI 的 query 参数获取
      if (item.resourceUri.query) {
        const params = new URLSearchParams(item.resourceUri.query);
        commitId = params.get('ref') || params.get('commit') || params.get('revision');
        if (commitId) {
          console.log('✅ 从 resourceUri.query 获取 commit id:', commitId);
        }
      }
      
      // 从 URI 的 fragment 获取
      if (!commitId && item.resourceUri.fragment) {
        const fragment = item.resourceUri.fragment;
        const match = fragment.match(/[a-f0-9]{7,40}/i);
        if (match) {
          commitId = match[0];
          console.log('✅ 从 resourceUri.fragment 获取 commit id:', commitId);
        }
      }
      
      // 从 URI 的 path 获取（某些情况下 commit id 在路径中）
      if (!commitId && item.resourceUri.path) {
        const path = item.resourceUri.path;
        const match = path.match(/[a-f0-9]{7,40}/i);
        if (match) {
          commitId = match[0];
          console.log('✅ 从 resourceUri.path 获取 commit id:', commitId);
        }
      }
    }
    
    // 检查 command 属性
    if (!commitId && item.command && item.command.arguments) {
      console.log('command.arguments:', item.command.arguments);
      for (const arg of item.command.arguments) {
        if (typeof arg === 'string' && /^[a-f0-9]{7,40}$/i.test(arg)) {
          commitId = arg;
          console.log('✅ 从 command.arguments 获取 commit id:', commitId);
          break;
        } else if (arg && typeof arg === 'object') {
          // 检查参数对象中的 commit id
          const argCommitId = arg.id || arg.ref || arg.commit || arg.sha || arg.hash;
          if (argCommitId && typeof argCommitId === 'string' && /^[a-f0-9]{7,40}$/i.test(argCommitId)) {
            commitId = argCommitId;
            console.log('✅ 从 command.arguments 对象获取 commit id:', commitId);
            break;
          }
        }
      }
    }
    
    // 从 tooltip 或 description 提取
    if (!commitId) {
      const textSources = [item.tooltip, item.description, item.label, item.detail];
      for (const text of textSources) {
        if (text && typeof text === 'string') {
          const match = text.match(/\b([a-f0-9]{7,40})\b/i);
          if (match) {
            commitId = match[1];
            console.log('✅ 从文本提取 commit id:', commitId);
            break;
          }
        }
      }
    }
  }

  // 方法2: 尝试获取当前选中的文件和行，然后用 git blame
  if (!commitId) {
    try {
      const activeEditor = vscode.window.activeTextEditor;
      if (activeEditor) {
        const document = activeEditor.document;
        const selection = activeEditor.selection;
        const line = selection.active.line + 1; // git blame 行号从1开始
        
        console.log('尝试从当前文件获取 commit:', document.uri.fsPath, '行:', line);
        
        // 使用同步方式获取 git blame 信息
        const { execSync } = require('child_process');
        try {
          const blameResult = execSync(
            `git blame -L ${line},${line} --porcelain "${document.uri.fsPath}"`,
            { 
              cwd: workspaceFolder.uri.fsPath,
              encoding: 'utf8',
              timeout: 5000
            }
          );
          
          const commitMatch = blameResult.match(/^([a-f0-9]{40})/);
          if (commitMatch && commitMatch[1] !== '0000000000000000000000000000000000000000') {
            commitId = commitMatch[1].substring(0, 8); // 使用短格式
            console.log('✅ 从 git blame 获取 commit id:', commitId);
          }
        } catch (blameError: any) {
          // 修复类型错误，确保 blameError 有 message 属性
          console.log('git blame 失败:', (blameError && blameError.message) ? blameError.message : String(blameError));
        }
      }
    } catch (e: any) {
      console.log('获取当前编辑器信息失败:', (e && e.message) ? e.message : String(e));
    }
  }

  console.log('=== 调试结束 ===');

  // 如果还是没获取到，手动输入
  if (!commitId) {
    // 尝试从剪贴板获取
    let clipboardText = '';
    try {
      clipboardText = await vscode.env.clipboard.readText();
      if (clipboardText && /^[a-f0-9]{7,40}$/i.test(clipboardText.trim())) {
        clipboardText = clipboardText.trim();
      } else {
        clipboardText = '';
      }
    } catch (e) {
      clipboardText = '';
    }

    commitId = await vscode.window.showInputBox({
      prompt: '请输入 commit id',
      placeHolder: '例如: 24a2f307',
      value: clipboardText,
      validateInput: (v) => {
        if (!v) return '请输入 commit id';
        const trimmed = v.trim();
        if (trimmed.length < 7) return '请输入至少7位 commit id';
        if (!/^[a-f0-9]+$/i.test(trimmed)) return '请输入有效的 commit id';
        return undefined;
      },
    });
  }

  if (!commitId) {
    return;
  }

  commitId = commitId.trim();
  console.log('最终使用的 commit id:', commitId);

  const patchDir = getPatchOutputDir(workspaceFolder);
  const patchFileName = `full_${commitId}.patch`;
  const patchFilePath = path.join(patchDir, patchFileName);

  // 确保输出目录存在
  try {
    await vscode.workspace.fs.createDirectory(vscode.Uri.file(patchDir));
  } catch (err) {
    // 目录可能已存在
  }

  // 生成 patch
  const gitCmd = `git format-patch -1 ${commitId} --stdout`;
  console.log('执行命令:', gitCmd);

  const { exec } = require('child_process');
  exec(gitCmd, { 
    cwd: workspaceFolder.uri.fsPath,
    maxBuffer: 1024 * 1024 * 10
  }, (err: Error | null, stdout: string, stderr: string) => {
    if (err) {
      console.error('生成 patch 失败:', err);
      let errorMsg = '生成 patch 失败';
      if (stderr.includes('unknown revision') || stderr.includes('bad revision')) {
        errorMsg += ': commit 不存在';
      } else if (stderr.includes('not a git repository')) {
        errorMsg += ': 不是 Git 仓库';
      } else {
        errorMsg += ': ' + err.message;
      }
      vscode.window.showErrorMessage(errorMsg);
    } else if (!stdout.trim()) {
      vscode.window.showErrorMessage('生成的 patch 为空，请检查 commit id');
    } else {
      require('fs').writeFileSync(patchFilePath, stdout, 'utf8');
      vscode.window.showInformationMessage(`完整 Patch 文件已生成: ${patchFileName}`);
      vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(patchFilePath));
    }
  });
});

  context.subscriptions.push(disposable, disposable2);
}

export function deactivate() { } 