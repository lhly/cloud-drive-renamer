# 批量重命名冲突修复与冲突弹窗优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复未改名文件被误判为冲突的问题，并将原生冲突 prompt 替换为可展示滚动冲突详情的自定义对话框，同时移除误导性的“强制覆盖”选项。

**Architecture:** 在 `FileSelectorPanel` 中先过滤出真正会改名的候选项，再对候选项执行冲突检测和后续执行计划构建。冲突详情由 `conflict-detector` 提供标准化数据，交给新的 `conflict-resolution-dialog` Lit 组件渲染；组件只负责展示和回传用户选择，不直接参与执行逻辑。

**Tech Stack:** TypeScript、Lit Web Components、Vitest、现有平台适配器抽象

---

## 文件结构

### 需要修改
- `src/content/components/file-selector-panel.ts`
  - 过滤未变化文件，统一预览/检测/执行候选集。
  - 管理冲突对话框状态与异步选择流程。
- `src/core/conflict-detector.ts`
  - 保留现有冲突检测能力。
  - 新增冲突详情整理函数。
  - 删除 `OVERWRITE` 相关分支/文案。
- `src/core/execution-plan.ts`
  - 删除 `OVERWRITE` 分支，保持与最新可选策略一致。
- `src/locales/zh_CN.json`
- `src/locales/zh_TW.json`
- `src/locales/en.json`
  - 新增冲突弹窗标题、说明、字段标签、按钮文案、冲突类型说明。
- `docs/superpowers/specs/2026-03-18-conflict-dialog-design.md`
  - 已更新为删除“强制覆盖”选项后的最终规格。

### 需要新增
- `src/content/components/conflict-resolution-dialog.ts`
  - 自定义冲突处理对话框组件。
- `tests/unit/conflict-detector.test.ts`
  - 冲突详情与策略逻辑测试。
- `tests/unit/file-selector-panel-conflict.test.ts`
  - `handleExecute()` 对未变化文件的过滤与冲突对话框集成测试。
- `tests/unit/conflict-resolution-dialog.test.ts`
  - 新对话框的渲染与事件测试。

---

### Task 1: 为核心冲突逻辑补失败测试

**Files:**
- Create: `tests/unit/conflict-detector.test.ts`
- Modify: `src/core/conflict-detector.ts`
- Modify: `src/core/execution-plan.ts`

- [ ] **Step 1: 写出失败测试，描述最新行为契约**

```ts
it('builds conflict detail rows for duplicate and existing-name conflicts', () => {
  // 给定 files/newNames/conflicts
  // 断言 detail 中包含 originalName / targetName / type / conflictingFiles
});

it('resolves skip strategy without any overwrite branch', () => {
  // 断言 skip 仅保留冲突文件原名
});
```

- [ ] **Step 2: 运行测试，确认它先失败**

Run:
```bash
npx vitest run tests/unit/conflict-detector.test.ts
```

Expected:
- 因缺少冲突详情整理函数或枚举/逻辑不匹配而失败。

- [ ] **Step 3: 最小化实现核心详情整理和策略收敛**

Implementation notes:
- 在 `conflict-detector.ts` 新增面向 UI 的 detail 类型与构建函数。
- 删除 `ConflictResolution.OVERWRITE`。
- 在 `execution-plan.ts` 中同步去除该分支。

- [ ] **Step 4: 再跑测试，确认通过**

Run:
```bash
npx vitest run tests/unit/conflict-detector.test.ts tests/unit/execution-plan.test.ts
```

Expected:
- 全部 PASS。

- [ ] **Step 5: 提交本任务**

```bash
git add tests/unit/conflict-detector.test.ts src/core/conflict-detector.ts src/core/execution-plan.ts
git commit -m "test: cover conflict detail model and strategy cleanup"
```

---

### Task 2: 先写面板流程的失败测试，锁定误报回归

**Files:**
- Create: `tests/unit/file-selector-panel-conflict.test.ts`
- Modify: `src/content/components/file-selector-panel.ts`

- [ ] **Step 1: 写出“未变化文件不参与冲突检测”的失败测试**

```ts
it('only checks conflicts for files whose names actually change', async () => {
  // 9 个选中文件，只有 7 个发生变化
  // 断言 adapter.checkNameConflict 只针对 7 个变化文件被调用
});

it('does not open conflict dialog when unchanged files would only conflict with themselves', async () => {
  // 2 个 unchanged 文件 + 若干 changed 文件
  // 断言不会弹冲突框，且执行计划只包含 changed 文件
});
```

- [ ] **Step 2: 运行测试，确认当前实现失败**

Run:
```bash
npx vitest run tests/unit/file-selector-panel-conflict.test.ts
```

Expected:
- 当前实现会把 unchanged 文件也送去检测，测试失败。

- [ ] **Step 3: 以最小改动实现候选项过滤**

Implementation notes:
- 在 `handleExecute()` 中先构造 `renameCandidates`。
- 候选项为空时沿用 `no_rename_needed`。
- 冲突检测、执行计划、结果映射都改为基于候选项。

- [ ] **Step 4: 再跑测试，确认误报回归已消失**

Run:
```bash
npx vitest run tests/unit/file-selector-panel-conflict.test.ts
```

Expected:
- PASS，且调用次数与候选项数量一致。

- [ ] **Step 5: 提交本任务**

```bash
git add tests/unit/file-selector-panel-conflict.test.ts src/content/components/file-selector-panel.ts
git commit -m "fix: exclude unchanged files from conflict detection"
```

---

### Task 3: 先写新对话框组件测试，再实现自定义冲突弹窗

**Files:**
- Create: `src/content/components/conflict-resolution-dialog.ts`
- Create: `tests/unit/conflict-resolution-dialog.test.ts`
- Modify: `src/locales/zh_CN.json`
- Modify: `src/locales/zh_TW.json`
- Modify: `src/locales/en.json`

- [ ] **Step 1: 写对话框失败测试**

```ts
it('renders a scrollable conflict list with original and target names', async () => {
  // 挂载组件，传入 2 条冲突详情
  // 断言存在滚动容器、文件名文本、冲突类型标签
});

it('emits auto-number and skip actions, and emits close on cancel', async () => {
  // 分别点击按钮，断言事件 detail/resolution 正确
});
```

- [ ] **Step 2: 运行测试，确认先失败**

Run:
```bash
npx vitest run tests/unit/conflict-resolution-dialog.test.ts
```

Expected:
- 因组件不存在或未定义而失败。

- [ ] **Step 3: 实现最小可用对话框组件**

Implementation notes:
- 组件属性至少包含：`open`、`conflictCount`、`items`。
- 使用与现有面板风格一致的 overlay/dialog/card 布局。
- 明细列表容器必须 `max-height + overflow-y: auto`。
- 按钮仅保留：自动添加编号、跳过冲突文件、取消本次执行。

- [ ] **Step 4: 更新 i18n 文案并验证测试通过**

Run:
```bash
npx vitest run tests/unit/conflict-resolution-dialog.test.ts
```

Expected:
- PASS。

- [ ] **Step 5: 提交本任务**

```bash
git add src/content/components/conflict-resolution-dialog.ts tests/unit/conflict-resolution-dialog.test.ts src/locales/zh_CN.json src/locales/zh_TW.json src/locales/en.json
git commit -m "feat: add custom conflict resolution dialog"
```

---

### Task 4: 集成对话框到面板执行流

**Files:**
- Modify: `src/content/components/file-selector-panel.ts`
- Modify: `src/content/components/conflict-resolution-dialog.ts`
- Modify: `tests/unit/file-selector-panel-conflict.test.ts`

- [ ] **Step 1: 先补一条集成失败测试**

```ts
it('waits for user conflict resolution from the custom dialog before building the execution plan', async () => {
  // 模拟检测出冲突
  // 断言先渲染 dialog
  // 触发 auto-number 事件后才继续执行
});
```

- [ ] **Step 2: 运行测试，确认集成点尚未成立**

Run:
```bash
npx vitest run tests/unit/file-selector-panel-conflict.test.ts
```

Expected:
- 因仍走旧 prompt 流程或未等待对话框事件而失败。

- [ ] **Step 3: 最小实现异步等待选择流程**

Implementation notes:
- 在 `FileSelectorPanel` 中新增状态：对话框开关、冲突详情、resolver。
- 将旧的 `showConflictResolutionDialog()` 调用改为面板内 Promise 流程。
- 关闭对话框时返回 `null`，中止执行。

- [ ] **Step 4: 运行聚焦测试，确认集成完成**

Run:
```bash
npx vitest run tests/unit/file-selector-panel-conflict.test.ts tests/unit/conflict-resolution-dialog.test.ts
```

Expected:
- PASS。

- [ ] **Step 5: 提交本任务**

```bash
git add src/content/components/file-selector-panel.ts src/content/components/conflict-resolution-dialog.ts tests/unit/file-selector-panel-conflict.test.ts
git commit -m "feat: integrate custom conflict dialog into execute flow"
```

---

### Task 5: 全量验证与回归检查

**Files:**
- Modify: `progress.md`
- Modify: `findings.md`

- [ ] **Step 1: 运行聚焦测试套件**

Run:
```bash
npx vitest run tests/unit/conflict-detector.test.ts tests/unit/execution-plan.test.ts tests/unit/file-selector-panel-conflict.test.ts tests/unit/conflict-resolution-dialog.test.ts
```

Expected:
- 全部 PASS。

- [ ] **Step 2: 运行项目级静态校验**

Run:
```bash
npm run lint
npm run typecheck
```

Expected:
- 无报错。

- [ ] **Step 3: 如时间允许，运行更广范围单测**

Run:
```bash
npm run test:ci
```

Expected:
- 无新增回归。

- [ ] **Step 4: 更新工作记录**

Update:
- `findings.md`：补充“强制覆盖”误导性结论与最终改法。
- `progress.md`：记录测试命令与结果。

- [ ] **Step 5: 提交最终修改**

```bash
git add src tests docs/superpowers/specs docs/superpowers/plans findings.md progress.md
git commit -m "fix: improve conflict detection and dialog UX"
```
