// i18n.ts - 简单国际化支持
import * as vscode from 'vscode';

const messages = {
  'zh-cn': {
    pluginActivated: 'Git Diff Patch Generator 插件已激活',
    patchGenerated: (file: string) => `Patch 文件已生成: ${file}`,
    patchFullGenerated: (file: string) => `完整 Patch 文件已生成: ${file}`,
    patchFailed: '生成 patch 失败',
    patchEmpty: '生成的 patch 为空，请检查 commit id',
    notGitRepo: '不是 Git 仓库',
    commitNotExist: 'commit 不存在',
    noWorkspace: '未打开任何工作区。',
    noTab: '未能获取当前标签信息。',
    parseCommitFail: '未能从标签解析出 commit 哈希。',
    getFilePathFail: '未能获取对比文件路径。',
    getWorkspaceFail: '未能定位到工作区。',
    inputCommitId: '请输入 commit id',
    inputCommitIdPlaceholder: '例如: 24a2f307',
    inputCommitIdInvalid: '请输入有效的 commit id',
    inputCommitIdShort: '请输入至少7位 commit id',
  },
  'en': {
    pluginActivated: 'Git Diff Patch Generator extension activated',
    patchGenerated: (file: string) => `Patch file generated: ${file}`,
    patchFullGenerated: (file: string) => `Full patch file generated: ${file}`,
    patchFailed: 'Failed to generate patch',
    patchEmpty: 'Generated patch is empty, please check commit id',
    notGitRepo: 'Not a Git repository',
    commitNotExist: 'Commit does not exist',
    noWorkspace: 'No workspace opened.',
    noTab: 'Failed to get current tab info.',
    parseCommitFail: 'Failed to parse commit hash from tab.',
    getFilePathFail: 'Failed to get diff file path.',
    getWorkspaceFail: 'Failed to locate workspace.',
    inputCommitId: 'Please enter commit id',
    inputCommitIdPlaceholder: 'e.g. 24a2f307',
    inputCommitIdInvalid: 'Please enter a valid commit id',
    inputCommitIdShort: 'Please enter at least 7 characters for commit id',
  }
};

function getLang() {
  const lang = vscode.env.language.toLowerCase();
  if (lang.startsWith('zh')) return 'zh-cn';
  return 'en';
}

export function getI18nText(key: keyof typeof messages['zh-cn'], ...args: any[]): string {
  const lang = getLang();
  const msg = messages[lang][key];
  if (typeof msg === 'function') {
    return (msg as Function)(...args);
  }
  return msg as string;
} 