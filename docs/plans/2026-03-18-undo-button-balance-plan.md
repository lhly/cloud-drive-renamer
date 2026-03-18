# Undo Button Balance Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 通过收紧 footer 主按钮尺寸并增强右侧撤销图标的存在感，改善批量重命名面板底部操作区的视觉失衡问题。

**Architecture:** 保持现有交互结构不变，继续使用“主操作按钮组 + 最右侧撤销 icon”布局。仅调整 `config-panel` 的 DOM 约束与 CSS：让主按钮不再被 flex 拉满，同时给 undo icon 一个稳定的容器尺寸和轻量 disabled 视觉反馈。

**Tech Stack:** TypeScript, Lit, Vitest

---

### Task 1: 用测试约束平衡化 footer 样式

**Files:**
- Modify: `tests/unit/config-panel-undo.test.ts`
- Modify: `src/content/components/config-panel.ts`

- [ ] **Step 1: 写一个失败测试，约束 footer 使用紧凑布局与可见的 disabled undo 容器**
- [ ] **Step 2: 运行 `npx vitest run tests/unit/config-panel-undo.test.ts`，确认新断言先失败**
- [ ] **Step 3: 最小化调整 `config-panel` 的样式与必要类名**
- [ ] **Step 4: 再次运行 `npx vitest run tests/unit/config-panel-undo.test.ts`，确认通过**

### Task 2: 回归验证撤销相关交互不受影响

**Files:**
- Modify: `src/content/components/config-panel.ts`
- Test: `tests/unit/file-selector-panel-undo.test.ts`

- [ ] **Step 1: 运行 `npx vitest run tests/unit/config-panel-undo.test.ts tests/unit/file-selector-panel-undo.test.ts`**
- [ ] **Step 2: 运行 `npx vitest run tests/unit/current-directory-scope.test.ts tests/unit/last-rename-operation.test.ts tests/unit/file-selector-panel-undo.test.ts tests/unit/config-panel-undo.test.ts tests/unit/executor.test.ts tests/integration/batch-execution.test.ts tests/integration/folder-batch-execution.test.ts`**
- [ ] **Step 3: 运行 `npm run typecheck`**
