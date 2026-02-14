# CloudDrive Renamer

<div align="center">

**一款强大的云盘文件批量重命名工具**

支持夸克网盘、阿里云盘、百度网盘的智能化文件管理

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-blue.svg)](https://www.typescriptlang.org/)
[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-Add--ons-green.svg)](https://chromewebstore.google.com/detail/kadpaidccbagkojkdghnkpehkmmbobll)
[![Edge Add-ons](https://img.shields.io/badge/Microsoft%20Edge-Add--ons-blue.svg)](https://microsoftedge.microsoft.com/addons/detail/kdfapbfjaoigjlbhjdnkhkkpnggnhkjp)

</div>

---

## 📖 目录

- [核心特性](#核心特性)
- [快速开始](#快速开始)
- [功能详解](#功能详解)
- [使用指南](#使用指南)
- [技术架构](#技术架构)
- [二次开发](#二次开发)
- [常见问题](#常见问题)
- [许可协议](#许可协议)

---

## ✨ 核心特性

### 🎯 多平台支持

- **夸克网盘** - 完全支持，可立即使用
- **阿里云盘** - 完全支持，可立即使用
- **百度网盘** - 完全支持，可立即使用

### 🔧 强大的重命名规则

#### 1. 替换规则 (Replace)
批量替换文件名中的特定文本，支持大小写敏感和全局替换。

**使用场景**：
- 统一修改文件前缀：`file-v1` → `file-v2`
- 替换不规范命名：`IMG_` → `Photo_`

**配置参数**：
```typescript
{
  search: string;        // 要查找的文本
  replace: string;       // 替换为的文本
  caseSensitive: boolean; // 是否区分大小写
  global: boolean;       // 是否全局替换
}
```

#### 2. 正则替换规则 (Regex)
使用正则表达式批量替换文件名（默认不处理扩展名），支持捕获组与 `$1` 等替换语法。

**使用场景**：
- 交换两段内容：`001-hello` → `hello-001`
- 清理特定模式：删除 `【1080p】`、`(字幕组)` 等

**配置参数**：
```typescript
{
  pattern: string;        // 正则表达式（不包含前后 /）
  replace: string;        // 替换表达式
  caseSensitive: boolean; // 是否区分大小写（false 会启用 i）
  global: boolean;        // 是否全局替换（true 会启用 g）
  flags?: string;         // 自定义 flags（高级，可选，建议填 m/s/u 等；g/i 由上面开关控制）
  includeExtension?: boolean; // 是否包含扩展名（允许修改后缀）
}
```

#### 3. 前缀规则 (Prefix)
为所有文件添加统一前缀，可自定义分隔符。

**使用场景**：
- 标记项目归属：添加 `Project-A_`
- 添加日期标记：添加 `2025-01-`

**配置参数**：
```typescript
{
  prefix: string;    // 前缀文本
  separator: string; // 分隔符，默认为空
}
```

#### 4. 后缀规则 (Suffix)
为文件名（扩展名之前）添加后缀标记。

**使用场景**：
- 添加版本标记：`document` → `document_v2`
- 标注处理状态：`image` → `image_processed`

**配置参数**：
```typescript
{
  suffix: string;    // 后缀文本
  separator: string; // 分隔符，默认为空
}
```

#### 5. 编号规则 (Numbering)
自动为文件添加序号，支持自定义格式。

**使用场景**：
- 照片整理：`photo` → `photo_001`, `photo_002`
- 文档排序：`Chapter` → `001_Chapter`, `002_Chapter`

**配置参数**：
```typescript
{
  startNumber: number;              // 起始编号
  digits: number;                   // 位数（补零）
  position: 'prefix' | 'suffix';    // 编号位置
  format: string;                   // 格式化模板
  separator: string;                // 分隔符
}
```

#### 6. 清理规则 (Sanitize)
清除文件名中的非法字符或特定字符集。

**使用场景**：
- 移除特殊符号：`file@#$` → `file`
- 清理空格和标点：`my file!.txt` → `myfile.txt`

**配置参数**：
```typescript
{
  removeChars: string;    // 要移除的字符集
  removeIllegal: boolean; // 是否移除非法字符
}
```

### 🚀 智能执行引擎

#### 批量处理系统
- **速率控制**：800ms 间隔执行，防止 API 限流
- **最大并发**：默认 3（按平台可调），避免请求堆积导致的失败/风控
- **重试机制**：指数退避算法，自动重试失败操作
- **崩溃恢复**：异常中断后可继续未完成的任务
- **幂等性保证**：避免重复执行相同操作

#### 实时预览功能
- 应用规则前预览所有变更
- 清晰对比原名称与新名称
- 即时调整规则参数，所见即所得

#### 冲突检测
- 自动检测重名冲突
- 智能提示潜在问题
- 保护文件安全

### 🔒 隐私保护

- **100% 本地处理**：所有重命名操作在浏览器本地完成
- **无数据上传**：不收集、不传输任何用户数据
- **透明操作**：开源代码，完全可审计

---

## 🚀 快速开始

### 前置要求

- **Node.js** >= 18.0
- **npm** >= 9.0
- **Chrome/Edge 浏览器** >= 110

### 安装步骤

#### 在线安装

- [Chrome 扩展商店](https://chromewebstore.google.com/detail/kadpaidccbagkojkdghnkpehkmmbobll) - 一键安装并自动保持最新版本
- [Edge 扩展商店](https://microsoftedge.microsoft.com/addons/detail/kdfapbfjaoigjlbhjdnkhkkpnggnhkjp) - 适用于 Microsoft Edge 浏览器的官方版本

#### 1. 克隆项目

```bash
git clone https://github.com/lhly/cloud-drive-renamer.git
cd cloud-drive-renamer
```

#### 2. 安装依赖

```bash
npm install
```

#### 3. 构建扩展

```bash
# 开发模式（支持热重载）
npm run dev

# 生产构建
npm run build
```

#### 4. 加载到浏览器

1. 打开 Chrome 浏览器
2. 访问 `chrome://extensions/`
3. 启用右上角的 **"开发者模式"**
4. 点击 **"加载已解压的扩展程序"**
5. 选择项目的 `dist` 目录
6. 扩展安装完成！

### 快速验证

访问 [夸克网盘](https://pan.quark.cn/list#/list/all)，页面右侧会出现 **悬浮按钮**（可拖拽）。点击即可打开批量重命名面板。

---

## 📘 使用指南

### 基础使用流程

#### 1. 打开云盘页面
访问支持的云盘平台（如夸克网盘），并进入需要处理的目录。

#### 2. 打开批量重命名面板
点击页面右侧的 **悬浮按钮**，打开“文件选择器”面板（左/中/右三栏）。

#### 3. 选择需要处理的文件
在中间栏的文件列表中进行选择：
- 默认全选当前目录的文件
- 支持搜索、按类型筛选、全选/取消全选
- 可单独勾选/取消勾选文件或文件夹

#### 4. 配置规则
在左侧栏选择重命名规则类型并设置参数。

#### 5. 预览结果
在右侧栏查看预览列表，确认所有变更符合预期（包含冲突提示）。

#### 6. 执行重命名
点击执行按钮，系统自动批量执行；执行进度与结果会在面板内实时显示。部分平台支持在执行后自动同步页面文件列表。

### 实战示例

#### 示例 1：整理照片集
**场景**：为旅行照片添加统一前缀和编号

```
原名称：IMG_001.jpg, IMG_002.jpg, IMG_003.jpg
规则组合：
  1. 前缀规则：prefix="Tokyo2025_"
  2. 编号规则：startNumber=1, digits=3, position="suffix"
结果：Tokyo2025_001.jpg, Tokyo2025_002.jpg, Tokyo2025_003.jpg
```

#### 示例 2：清理文档命名
**场景**：移除特殊字符并统一格式

```
原名称：报告@2024#最终版.docx
规则组合：
  1. 清理规则：removeChars="@#"
  2. 替换规则：search="最终版", replace="Final"
结果：报告2024Final.docx
```

#### 示例 3：版本管理
**场景**：为项目文件添加版本后缀

```
原名称：design.psd, mockup.fig, prototype.xd
规则：后缀规则：suffix="_v2", separator=""
结果：design_v2.psd, mockup_v2.fig, prototype_v2.xd
```

### 高级技巧

#### 规则组合使用
多个规则可以叠加应用，执行顺序为配置顺序：

```typescript
// 组合示例
[
  { type: 'sanitize', params: { removeIllegal: true } },
  { type: 'prefix', params: { prefix: 'Project_' } },
  { type: 'numbering', params: { startNumber: 1, digits: 2 } }
]
```

#### 格式化模板
编号规则支持自定义格式化：

```typescript
format: "[{n}]"     // → [001], [002]
format: "No.{n}"    // → No.001, No.002
format: "{n}번"     // → 001번, 002번
```

---

## 🏗️ 技术架构

### 整体架构

```
┌─────────────────────────────────────────────┐
│           Chrome Extension                  │
├─────────────────────────────────────────────┤
│                                             │
│  ┌─────────────┐      ┌─────────────┐      │
│  │   Popup     │      │  Background │      │
│  │    UI       │◄────►│   Service   │      │
│  └─────────────┘      │   Worker    │      │
│                       └─────────────┘      │
│         ▲                    ▲             │
│         │                    │             │
│         ▼                    ▼             │
│  ┌─────────────────────────────────┐      │
│  │      Content Script              │      │
│  │  ┌────────────┐  ┌────────────┐ │      │
│  │  │ UI Components  Rule Engine │ │      │
│  │  └────────────┘  └────────────┘ │      │
│  │  ┌──────────────────────────┐   │      │
│  │  │   Platform Adapters       │   │      │
│  │  │  • Quark  • Aliyun • Baidu│   │      │
│  │  └──────────────────────────┘   │      │
│  └─────────────────────────────────┘      │
│                   │                        │
└───────────────────┼────────────────────────┘
                    │
                    ▼
         ┌──────────────────┐
         │  Cloud Drive API  │
         └──────────────────┘
```

### 核心模块

#### 1. 规则引擎 (Rule Engine)
- **职责**：规则解析、验证、执行
- **位置**：`src/rules/`
- **关键类**：
  - `RuleFactory`：规则工厂，创建规则实例
  - `BaseRule`：规则基类，定义通用接口
  - 具体规则实现：`ReplaceRule`, `PrefixRule`, 等

#### 2. 平台适配器 (Platform Adapters)
- **职责**：封装不同平台的 API 调用
- **位置**：`src/adapters/`
- **设计模式**：适配器模式
- **扩展性**：新平台只需实现 `PlatformAdapter` 接口

#### 3. 执行引擎 (Executor)
- **职责**：批量任务调度、速率控制、错误处理
- **位置**：`src/core/executor.ts`
- **特性**：
  - 任务队列管理
  - 速率限制 (Rate Limiting)
  - 重试策略 (Retry Policy)
  - 崩溃恢复 (Crash Recovery)

#### 4. UI 组件 (UI Components)
- **技术栈**：Lit Web Components
- **位置**：`src/content/components/`
- **组件**：
  - `floating-button`：悬浮按钮（Shadow DOM 注入、拖拽/位置记忆、可在 Popup 中隐藏）
  - `file-selector-panel`：主面板（三栏容器：规则配置 / 文件列表 / 预览）
  - `config-panel`：规则选择与参数配置、执行/暂停/取消、进度与同步状态
  - `file-list-panel`：文件列表（搜索、类型筛选、全选/取消全选）
  - `preview-panel`：预览结果（冲突提示、执行状态）
  - `virtual-file-list` / `virtual-preview-list`：大列表虚拟渲染提升性能

### 项目结构

```
src/
├── types/              # TypeScript 类型定义
│   ├── rule.ts         # 规则类型
│   ├── platform.ts     # 平台接口
│   ├── core.ts         # 核心类型
│   └── message.ts      # 消息类型
├── background/         # Background Service Worker
│   └── service-worker.ts
├── content/            # Content Scripts
│   ├── index.ts        # 入口文件
│   └── components/     # Lit Web Components
│       ├── floating-button.ts
│       ├── file-selector-panel.ts
│       ├── config-panel.ts
│       ├── file-list-panel.ts
│       ├── preview-panel.ts
│       ├── search-box.ts
│       ├── toolbar.ts
│       ├── virtual-file-list.ts
│       └── virtual-preview-list.ts
├── adapters/           # 平台适配器
│   ├── base/           # 适配器基类和接口
│   │   └── adapter.interface.ts
│   ├── quark/          # 夸克网盘适配器
│   │   ├── quark.ts
│   │   └── errors.ts
│   ├── aliyun/         # 阿里云盘适配器
│   └── baidu/          # 百度网盘适配器
├── rules/              # 重命名规则
│   ├── base-rule.ts    # 规则基类
│   ├── rule-factory.ts # 规则工厂
│   ├── replace.ts      # 替换规则
│   ├── prefix.ts       # 前缀规则
│   ├── suffix.ts       # 后缀规则
│   ├── numbering.ts    # 编号规则
│   └── sanitize.ts     # 清理规则
├── core/               # 核心引擎
│   ├── executor.ts     # 批量执行引擎
│   ├── retry.ts        # 重试机制
│   ├── crash-recovery.ts # 崩溃恢复
│   └── conflict-detector.ts # 冲突检测
├── popup/              # Popup 界面
│   ├── popup.ts
│   └── index.html
├── dialog/             # 独立对话框页面
│   └── dialog.ts
└── utils/              # 工具函数
    ├── storage.ts      # 存储抽象
    ├── logger.ts       # 日志系统
    └── helpers.ts      # 辅助函数
```

### 技术栈

| 类别 | 技术 | 版本 | 用途 |
|------|------|------|------|
| 语言 | TypeScript | 5.3+ | 类型安全的开发体验 |
| 构建 | Vite | 5.0+ | 快速构建和热重载 |
| UI框架 | Lit | 3.1+ | 轻量级 Web Components |
| 打包 | @crxjs/vite-plugin | 2.3+ | Chrome 扩展专用打包 |
| 测试 | Vitest + Playwright | 1.6+ | 单元测试和E2E测试 |
| 代码质量 | ESLint + Prettier | 最新 | 代码规范和格式化 |

---

## 🛠️ 二次开发

### 开发环境配置

#### 1. 安装依赖

```bash
npm install
```

#### 2. 启动开发模式

```bash
npm run dev
```

开发模式支持热重载，修改代码后自动重新构建。

#### 3. 代码质量检查

```bash
# 代码规范检查
npm run lint

# 自动修复代码问题
npm run lint:fix

# TypeScript 类型检查
npm run typecheck
```

#### 4. 运行测试

```bash
# 单元测试
npm test

# 测试覆盖率
npm run test:coverage

# E2E 测试
npm run test:e2e

# E2E 测试（可视化模式）
npm run test:e2e:ui
```

### 扩展新平台

#### 实现平台适配器

1. 在 `src/adapters/` 下创建新平台目录
2. 实现 `PlatformAdapter` 接口

```typescript
// src/adapters/newplatform/newplatform.ts

import { PlatformAdapter } from '../base/adapter.interface';
import { FileItem } from '../../types/platform';

export class NewPlatformAdapter implements PlatformAdapter {
  // 获取当前选中的文件列表
  async getSelectedFiles(): Promise<FileItem[]> {
    // TODO: 实现文件列表获取逻辑
  }

  // 执行重命名操作
  async renameFile(fileId: string, newName: string): Promise<void> {
    // TODO: 实现重命名 API 调用
  }

  // 验证文件名合法性
  validateFileName(fileName: string): boolean {
    // TODO: 实现文件名验证规则
  }

  // 检测当前是否在目标平台页面
  isCurrentPlatform(): boolean {
    return window.location.hostname === 'newplatform.com';
  }
}
```

#### 注册平台适配器

在 `manifest.json` 中添加 content script 配置：

```json
{
  "content_scripts": [
    {
      "matches": ["https://newplatform.com/*"],
      "js": ["src/content/index.ts"],
      "run_at": "document_idle"
    }
  ],
  "host_permissions": [
    "https://newplatform.com/*"
  ]
}
```

### 添加新规则

#### 实现规则类

```typescript
// src/rules/custom-rule.ts

import { BaseRule } from './base-rule';

export interface CustomRuleParams {
  // 定义规则参数
  paramA: string;
  paramB: number;
}

export class CustomRule extends BaseRule {
  constructor(private params: CustomRuleParams) {
    super();
  }

  execute(fileName: string, index: number, total: number): string {
    // TODO: 实现规则逻辑
    return fileName; // 返回处理后的文件名
  }

  validate(config: CustomRuleParams): boolean {
    // TODO: 实现参数验证
    return true;
  }
}
```

#### 注册到规则工厂

```typescript
// src/rules/rule-factory.ts

import { CustomRule } from './custom-rule';

export class RuleFactory {
  static create(config: RuleConfig): RuleExecutor {
    switch (config.type) {
      // ... 其他规则
      case 'custom':
        return new CustomRule(config.params as any);
      default:
        throw new Error(`Unknown rule type: ${config.type}`);
    }
  }
}
```

#### 更新类型定义

```typescript
// src/types/rule.ts

export type RuleType =
  | 'replace'
  | 'prefix'
  | 'suffix'
  | 'numbering'
  | 'sanitize'
  | 'custom'; // 添加新规则类型
```

### 调试技巧

#### 1. Chrome DevTools

```typescript
// 在代码中添加调试信息
console.log('[CloudDrive Renamer]', data);
```

在 Chrome DevTools 中可以看到所有日志输出。

#### 2. 使用断点

在 Chrome DevTools 的 Sources 面板中，可以直接在扩展代码中设置断点。

#### 3. 查看扩展状态

访问 `chrome://extensions/` 可以查看扩展加载状态、错误信息、权限等。

#### 4. 热重载

开发模式下修改代码后：
1. 代码自动重新构建
2. 在 `chrome://extensions/` 点击刷新按钮
3. 刷新目标网页即可看到变更

### 代码规范

#### TypeScript 规范

- 所有公共 API 必须有类型注解
- 优先使用 `interface` 而非 `type`
- 使用严格的 `tsconfig.json` 配置

#### 命名规范

- 类名：PascalCase（如 `RuleFactory`）
- 方法名：camelCase（如 `getSelectedFiles`）
- 常量：UPPER_SNAKE_CASE（如 `MAX_RETRY_COUNT`）
- 文件名：kebab-case（如 `rule-factory.ts`）

#### 注释规范

```typescript
/**
 * 规则工厂类
 * 负责根据配置创建对应的规则实例
 */
export class RuleFactory {
  /**
   * 创建规则实例
   * @param config - 规则配置对象
   * @returns 规则执行器实例
   * @throws {Error} 当规则类型未知时抛出错误
   */
  static create(config: RuleConfig): RuleExecutor {
    // ...
  }
}
```

### 测试指南

#### 单元测试示例

```typescript
// src/rules/__tests__/prefix-rule.test.ts

import { describe, it, expect } from 'vitest';
import { PrefixRule } from '../prefix';

describe('PrefixRule', () => {
  it('should add prefix to filename', () => {
    const rule = new PrefixRule({ prefix: 'test_' });
    const result = rule.execute('file.txt', 0, 1);
    expect(result).toBe('test_file.txt');
  });

  it('should add prefix with separator', () => {
    const rule = new PrefixRule({
      prefix: 'test',
      separator: '-'
    });
    const result = rule.execute('file.txt', 0, 1);
    expect(result).toBe('test-file.txt');
  });
});
```

#### E2E 测试示例

```typescript
// tests/e2e/panel-open.spec.ts (示例)

import { test, expect } from '@playwright/test';

test('should open file selector panel on Quark drive', async ({ page }) => {
  await page.goto('https://pan.quark.cn/list#/list/all');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000); // 等待扩展注入

  // 点击悬浮按钮（Shadow DOM）
  await page.locator('#cloud-drive-renamer-shadow-host >>> .floating-button').click();

  // 面板应出现
  await expect(page.locator('file-selector-panel >>> .panel-overlay')).toBeVisible();
});
```

### 贡献指南

我们欢迎各种形式的贡献！

#### 提交 Issue

- Bug 报告：详细描述复现步骤和环境信息
- 功能建议：说明使用场景和预期效果
- 文档改进：指出不清楚或有误的地方

#### 提交 Pull Request

1. Fork 项目仓库
2. 创建功能分支：`git checkout -b feature/amazing-feature`
3. 提交变更：`git commit -m 'Add amazing feature'`
4. 推送分支：`git push origin feature/amazing-feature`
5. 提交 Pull Request

**PR 要求**：
- 通过所有测试：`npm test`
- 代码规范检查：`npm run lint`
- 添加必要的测试用例
- 更新相关文档

---

## ❓ 常见问题

### 安装和使用

**Q: 为什么安装后找不到悬浮按钮/面板打不开？**

A: 请检查：
1. 扩展是否正确加载（访问 `chrome://extensions/` 确认）
2. 是否访问了支持的网盘平台
3. 是否处于分享链接页面（分享页通常不注入 UI）
4. 在扩展 Popup 中确认“显示悬浮按钮”未被关闭
5. 刷新页面后重试

**Q: 为什么重命名失败？**

A: 可能的原因：
1. 网络连接问题
2. 新文件名与现有文件冲突
3. 文件名包含非法字符
4. 云盘 API 限流

解决方案：扩展会自动重试，如果持续失败，请查看浏览器控制台日志。

**Q: 是否支持文件夹重命名？**

A: 目前版本支持文件和文件夹的批量重命名。

### 隐私和安全

**Q: 扩展会上传我的文件名或数据吗？**

A: 不会。所有处理都在本地完成，不会向任何第三方服务器发送数据。

**Q: 为什么需要存储权限？**

A: 用于保存用户的规则配置和崩溃恢复数据，所有数据存储在浏览器本地。

**Q: 为什么需要访问云盘网站的权限？**

A: 扩展需要在云盘页面注入 UI 组件和调用云盘 API，这些都在浏览器沙箱环境中运行。

### 开发相关

**Q: 如何添加对新云盘平台的支持？**

A: 请参考 [扩展新平台](#扩展新平台) 章节。

**Q: 如何贡献代码？**

A: 请参考 [贡献指南](#贡献指南) 章节。

**Q: 遇到 Bug 如何报告？**

A: 请在 GitHub Issues 中提交，包含：
- 浏览器版本
- 扩展版本
- 复现步骤
- 错误截图或日志

---

## 🗺️ 版本历程与路线图

### 当前版本 (v1.0.0) 🎉

**稳定版本正式发布！** 相比 v0.4.1 新增功能：

#### 🚀 核心功能增强
- ✅ **完整的三大平台支持**
  - 夸克网盘 - 完全支持，包含文件夹重命名和页面同步
  - 阿里云盘 - 完全支持，自动同步页面文件列表
  - 百度网盘 - 完全支持，优化API调用和列表解析

#### 🎨 用户界面优化
- ✅ **文件选择器三栏面板** - 规则配置 / 文件列表 / 实时预览
- ✅ **智能悬浮按钮** - 可拖拽定位，支持位置记忆，可在 Popup 中隐藏
- ✅ **虚拟滚动优化** - 大文件列表性能提升，支持数千文件流畅操作
- ✅ **搜索与筛选** - 文件名搜索、类型筛选、全选/取消全选

#### ⚡ 执行引擎增强
- ✅ **页面自动同步** - 重命名完成后自动刷新页面文件列表（阿里云盘、百度网盘）
- ✅ **重试机制优化** - 支持手动重试失败项，显示详细错误信息
- ✅ **进度可视化** - 实时展示执行进度、成功/失败统计、同步状态
- ✅ **平台使用统计** - 记录并展示各平台使用情况

#### 🌍 国际化支持
- ✅ **多语言界面** - 简体中文 / 繁体中文 / English
- ✅ **语言自动检测** - 根据浏览器语言自动切换
- ✅ **脚本注入优化** - 改进多语言环境下的脚本加载逻辑

#### 🛡️ 稳定性改进
- ✅ **平台检测增强** - 统一的平台识别逻辑，支持分享链接检测
- ✅ **错误处理优化** - 完善的错误提示和降级处理
- ✅ **文件名提取改进** - 过滤 UI 噪音文本，提升准确性

### 历史版本

#### v0.4.1 (2025-12)
- 三大平台基础支持
- 基础文件选择器面板
- 五种重命名规则
- 基础多语言支持

#### v0.3.0 (2025-12)
- 添加阿里云盘和百度网盘支持
- 平台检测逻辑重构

### 未来规划

#### 平台扩展
- 📋 支持更多云盘平台（根据平台 API 开放程度逐步适配）

#### 规则增强
- 📋 更多灵活的重命名规则
- 📋 规则模板保存与分享功能

#### 高级功能
- 📋 历史记录与撤销
- 📋 批量任务优化

---

## 📄 许可协议

本项目基于 [MIT License](LICENSE) 开源。

---

## 🙏 致谢

感谢所有贡献者和用户的支持！

特别感谢：
- [Lit](https://lit.dev/) - 出色的 Web Components 框架
- [Vite](https://vitejs.dev/) - 极速构建工具
- [CRXJS](https://crxjs.dev/) - Chrome 扩展开发利器

---

## 📞 联系我们

- **问题反馈**：[GitHub Issues](https://github.com/lhly/cloud-drive-renamer/issues)
- **功能建议**：[GitHub Discussions](https://github.com/lhly/cloud-drive-renamer/discussions)
- **邮件联系**：lhlyzh@qq.com

---

<div align="center">

**如果这个项目对你有帮助，请给我们一个 ⭐️**

Made with ❤️ by 冷火凉烟

</div>
