# Preview Panel Option A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改变三栏布局和执行流程的前提下，把右侧预览列表升级为“旧名 -> 新名”的双行映射视图，提升执行前确认效率。

**Architecture:** 改动集中在 `virtual-preview-list` 展示层，继续复用现有 `PreviewItem` 结构，不修改 `file-selector-panel` 的预览数据协议。状态、失败原因和冲突提示由列表组件在渲染时根据 `item.file.name`、`item.newName`、`item.conflict`、`item.done`、`item.error` 推导生成；`preview-panel` 仍只负责统计区和外层容器。

**Tech Stack:** TypeScript、Lit Web Components、Vitest、现有 i18n 资源

---

## 文件结构

### 需要修改
- `src/content/components/virtual-preview-list.ts`
  - 将单行新文件名渲染改成双行映射结构。
  - 把状态标签从单独徽标调整为与旧文件名同层展示。
  - 为冲突项/失败项补充可读的辅助说明。
  - 保持虚拟列表切换逻辑与长列表性能不变。
- `src/locales/zh_CN.json`
- `src/locales/zh_TW.json`
- `src/locales/en.json`
  - 仅在实现时确认现有文案不足的情况下补充预览项辅助说明文案。

### 需要新增
- `tests/unit/virtual-preview-list.test.ts`
  - 覆盖双行映射结构、状态标签、冲突/失败说明、长文件名 title 合约。

### 需要验证但通常不必修改
- `src/content/components/preview-panel.ts`
  - 确认统计区和列表容器不需要跟随变更。
- `src/types/file-selector.ts`
  - 确认 `PreviewItem` 结构已足够承载新视图。

---

### Task 1: 先为双行映射视图补失败测试

**Files:**
- Create: `tests/unit/virtual-preview-list.test.ts`
- Modify: `src/content/components/virtual-preview-list.ts`

- [ ] **Step 1: 写失败测试，锁定“旧名 -> 新名”最小契约**

```ts
it('renders original name and new name for a pending preview item', async () => {
  const element = document.createElement('virtual-preview-list') as VirtualPreviewListElement;
  element.items = [
    {
      file: { id: '1', name: 'old-name.mkv', ext: 'mkv', isDir: false, size: 1, mtime: Date.now() },
      newName: 'new-name.mkv',
      conflict: false,
    },
  ];

  document.body.appendChild(element);
  await element.updateComplete;

  expect(element.shadowRoot?.textContent).toContain('old-name.mkv');
  expect(element.shadowRoot?.textContent).toContain('new-name.mkv');
});
```

- [ ] **Step 2: 运行测试，确认当前实现先失败**

Run:
```bash
npx vitest run tests/unit/virtual-preview-list.test.ts
```

Expected:
- FAIL，因为当前组件只渲染新文件名，看不到旧文件名。

- [ ] **Step 3: 最小实现双行渲染结构**

Implementation notes:
- 在 `renderPreviewItem()` 中新增“旧文件名行”和“新文件名行”。
- 旧文件名使用 `item.file.name`。
- 新文件名继续使用 `item.newName`。
- 保留现有 `title` 以支持完整名称悬浮查看。

- [ ] **Step 4: 再跑测试，确认最小映射能力已成立**

Run:
```bash
npx vitest run tests/unit/virtual-preview-list.test.ts
```

Expected:
- PASS。

- [ ] **Step 5: 提交本任务**

```bash
git add tests/unit/virtual-preview-list.test.ts src/content/components/virtual-preview-list.ts
git commit -m "test: cover preview list old-to-new mapping"
```

---

### Task 2: 为状态项和辅助说明补测试，再完善展示逻辑

**Files:**
- Modify: `tests/unit/virtual-preview-list.test.ts`
- Modify: `src/content/components/virtual-preview-list.ts`
- Modify: `src/locales/zh_CN.json`
- Modify: `src/locales/zh_TW.json`
- Modify: `src/locales/en.json`

- [ ] **Step 1: 写失败测试，描述冲突项和失败项的展示预期**

```ts
it('renders conflict summary next to the original name row', async () => {
  // conflict: true
  // 断言冲突徽标存在，且旧文件名和新文件名同时可见
});

it('renders a user-friendly failure message for extract errors', async () => {
  // error: 'extract_episode_not_found'
  // 断言显示本地化错误文案，而不是仅有原始错误码
});

it('renders pending badge only when showStatus is true', async () => {
  // showStatus false/true 分别断言 pending 徽标行为
});
```

- [ ] **Step 2: 运行测试，确认现有实现不满足新行为**

Run:
```bash
npx vitest run tests/unit/virtual-preview-list.test.ts
```

Expected:
- FAIL，原因可能包括：
  - 状态标签位置和结构不符合预期
  - 辅助说明未渲染
  - 原始错误码未转译成用户可读文案

- [ ] **Step 3: 实现状态重排和说明文案**

Implementation notes:
- 将状态标签放在旧文件名同行右侧。
- `conflict` 项显示固定说明，如“与现有文件名重复”或等效文案。
- `error` 项优先尝试 `I18nService.t('error_' + item.error)`，找不到再回退到原始错误文本。
- 若现有 locale 缺少冲突说明文案，再补充最少的新 key。
- 保持 `showStatus` 逻辑不变，只改变展示位置与结构。

- [ ] **Step 4: 运行测试，确认状态与说明文案通过**

Run:
```bash
npx vitest run tests/unit/virtual-preview-list.test.ts
```

Expected:
- PASS。

- [ ] **Step 5: 提交本任务**

```bash
git add tests/unit/virtual-preview-list.test.ts src/content/components/virtual-preview-list.ts src/locales/zh_CN.json src/locales/zh_TW.json src/locales/en.json
git commit -m "feat: show original-to-new mapping in preview items"
```

---

### Task 3: 锁定样式合约，避免新结构破坏列表可读性

**Files:**
- Modify: `tests/unit/virtual-preview-list.test.ts`
- Modify: `src/content/components/virtual-preview-list.ts`

- [ ] **Step 1: 写样式/结构测试，锁定层级和截断约束**

```ts
it('keeps original name visually secondary and new name visually prominent', () => {
  const cssText = VirtualPreviewList.styles.cssText;
  expect(cssText).toContain('.file-name.old');
  expect(cssText).toContain('.file-name.new');
  expect(cssText).toContain('text-overflow: ellipsis;');
});

it('keeps preview items compatible with virtualized long lists', () => {
  const cssText = VirtualPreviewList.styles.cssText;
  expect(cssText).toContain('.preview-item');
  expect(cssText).toContain('.preview-content');
});
```

- [ ] **Step 2: 运行测试，确认样式契约尚未全部满足**

Run:
```bash
npx vitest run tests/unit/virtual-preview-list.test.ts
```

Expected:
- FAIL，因为新类名或截断样式尚未完整落地。

- [ ] **Step 3: 完成样式收尾**

Implementation notes:
- 为旧名/新名分别设置类名和视觉层级。
- 为两行文件名保持单行截断。
- 保持冲突/失败/成功背景与边框系统延续现有主题变量。
- 不新增会影响虚拟列表布局计算的绝对定位复杂结构。

- [ ] **Step 4: 再跑测试，确认样式合约通过**

Run:
```bash
npx vitest run tests/unit/virtual-preview-list.test.ts
```

Expected:
- PASS。

- [ ] **Step 5: 提交本任务**

```bash
git add tests/unit/virtual-preview-list.test.ts src/content/components/virtual-preview-list.ts
git commit -m "style: refine preview item hierarchy for option a"
```

---

### Task 4: 做集成验证，确认预览面板主链路未回归

**Files:**
- Modify: `tests/unit/virtual-preview-list.test.ts`
- Verify: `src/content/components/preview-panel.ts`
- Verify: `src/content/components/file-selector-panel.ts`

- [ ] **Step 1: 补一条轻量集成测试，验证 `preview-panel` 仍能透传数据到列表**

```ts
it('renders preview items through preview-panel without changing counters', async () => {
  // 挂载 preview-panel，传入含 old/new/conflict/error 的 items
  // 断言统计区仍正确，列表中可见旧名与新名
});
```

- [ ] **Step 2: 运行聚焦测试，确认先看到真实集成结果**

Run:
```bash
npx vitest run tests/unit/virtual-preview-list.test.ts
```

Expected:
- 若 `preview-panel` 不需要改动，则测试应直接 PASS；
- 若透传或 DOM 结构假设有误，则在这里修正测试或最小代码。

- [ ] **Step 3: 只在必要时做最小集成修复**

Implementation notes:
- 优先不改 `preview-panel.ts`。
- 若测试显示统计区布局受影响，再做最小 CSS 或 DOM 修正。

- [ ] **Step 4: 运行本轮相关测试和基础校验**

Run:
```bash
npx vitest run tests/unit/virtual-preview-list.test.ts tests/unit/file-selector-panel-conflict.test.ts tests/unit/file-selector-panel-diagnostic-feedback.test.ts tests/unit/file-selector-panel-undo.test.ts
npx tsc --noEmit
```

Expected:
- 所有测试 PASS。
- TypeScript 检查通过。

- [ ] **Step 5: 提交本任务**

```bash
git add tests/unit/virtual-preview-list.test.ts src/content/components/virtual-preview-list.ts src/content/components/preview-panel.ts
git commit -m "test: verify preview panel option a integration"
```

---

### Task 5: 做最终回归验证并整理交付

**Files:**
- Verify only: `src/content/components/virtual-preview-list.ts`
- Verify only: `src/content/components/preview-panel.ts`
- Verify only: `docs/superpowers/specs/2026-03-20-preview-panel-option-a-design.md`

- [ ] **Step 1: 运行完整单测回归**

Run:
```bash
npx vitest run
```

Expected:
- 全部单测 PASS。

- [ ] **Step 2: 运行 lint 和类型检查**

Run:
```bash
npm run lint
npm run typecheck
```

Expected:
- 无 lint 错误。
- 无 type error。

- [ ] **Step 3: 如有必要，运行一次聚焦 E2E 验证预览未破坏主流程**

Run:
```bash
npx playwright test tests/e2e/batch-rename.spec.ts
```

Expected:
- 预览面板主流程可打开、可展示、执行前无明显回归。

- [ ] **Step 4: 更新进度文件并整理交付说明**

Implementation notes:
- 更新 `task_plan.md`、`findings.md`、`progress.md` 中的实施状态。
- 汇总本次改动点、测试结果和剩余风险。

- [ ] **Step 5: 提交最终任务**

```bash
git add src tests task_plan.md findings.md progress.md
git commit -m "feat: upgrade preview panel to option a mapping view"
```

---

## 备注

- 本计划默认优先走最小可用版本，不额外引入“剧集提取摘要标签”这类增强信息，除非实现时确认不会增加明显噪声。
- 若 Task 2 中发现现有 locale 已足够支撑失败原因转译，则不必机械新增 i18n key；保持 DRY。
- 如果后续用户希望在预览项上增加“从该项填充剧名/锚点”的交互，应单独立 spec 和 plan，不应在本计划中顺手扩 scope。
