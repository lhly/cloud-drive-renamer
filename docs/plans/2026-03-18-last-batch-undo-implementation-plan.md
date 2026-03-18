# Last Batch Undo Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为批量重命名面板增加“仅撤销当前目录最近一次批量重命名”的能力，并让 retry 成功项并入同一条可撤销记录。

**Architecture:** 在平台适配器层统一暴露 `getCurrentDirectoryKey()`，在 `file-selector-panel` 维护单条 `LastRenameOperation`，通过纯函数帮助模块完成记录创建、合并、scope 校验和失败项收窄，再由 `config-panel` 提供单按钮 UI。执行与撤销都复用 `BatchExecutor`，避免重复实现节流、进度和错误汇总逻辑。

**Tech Stack:** TypeScript, Lit Web Components, Vitest, Playwright（回归可选）

---

### Task 1: 增加统一目录 scope API

**Files:**
- Modify: `src/types/platform.ts`
- Modify: `src/adapters/base/adapter.interface.ts`
- Modify: `src/adapters/quark/quark.ts`
- Modify: `src/adapters/aliyun/aliyun-adapter.ts`
- Modify: `src/adapters/baidu/baidu-adapter.ts`
- Modify: `tests/unit/executor.test.ts`
- Modify: `tests/integration/batch-execution.test.ts`
- Modify: `tests/integration/folder-batch-execution.test.ts`
- Modify: `tests/performance/benchmark.test.ts`

**Step 1: 写一个最小失败测试（或先让 typecheck 暴露接口缺失）**

在 `tests/unit/executor.test.ts` 的 mock adapter 中先补一条注释，准备添加：

```ts
getCurrentDirectoryKey(): string {
  return 'root';
}
```

**Step 2: 修改平台接口与抽象基类**

在 `src/types/platform.ts` 增加：

```ts
getCurrentDirectoryKey(): string;
```

在 `src/adapters/base/adapter.interface.ts` 增加抽象声明：

```ts
abstract getCurrentDirectoryKey(): string;
```

**Step 3: 在三个平台适配器中实现该方法**

目标实现：

```ts
getCurrentDirectoryKey(): string {
  return this.getCurrentFolderId(); // Quark
}
```

```ts
getCurrentDirectoryKey(): string {
  return this.getParentIdFromUrl(); // Aliyun
}
```

```ts
getCurrentDirectoryKey(): string {
  return this.getCurrentPath(); // Baidu
}
```

**Step 4: 更新所有测试 mock adapter**

给所有 `implements PlatformAdapter` 的 mock 增加：

```ts
getCurrentDirectoryKey(): string {
  return 'root';
}
```

**Step 5: 运行定向类型检查/测试**

Run:
```bash
npm run typecheck
npx vitest run tests/unit/executor.test.ts tests/integration/batch-execution.test.ts
```

Expected: 新接口编译通过，mock 不再缺少 `getCurrentDirectoryKey()`。

**Step 6: Commit**

```bash
git add src/types/platform.ts src/adapters/base/adapter.interface.ts src/adapters/quark/quark.ts src/adapters/aliyun/aliyun-adapter.ts src/adapters/baidu/baidu-adapter.ts tests/unit/executor.test.ts tests/integration/batch-execution.test.ts tests/integration/folder-batch-execution.test.ts tests/performance/benchmark.test.ts
git commit -m "refactor: expose current directory scope on adapters"
```

### Task 2: 提取单条 undo 记录帮助模块（TDD）

**Files:**
- Create: `src/types/undo.ts`
- Create: `src/core/last-rename-operation.ts`
- Create: `tests/unit/last-rename-operation.test.ts`

**Step 1: 先写失败测试**

在 `tests/unit/last-rename-operation.test.ts` 写出以下核心用例：

```ts
it('creates a last rename operation from success results', () => {
  const op = createLastRenameOperation('quark', 'dir-1', [
    { fileId: '1', original: 'a.txt', renamed: 'b.txt', index: 0 },
  ]);
  expect(op?.items).toHaveLength(1);
  expect(op?.items[0].original).toBe('a.txt');
});

it('merges retry success items into the existing operation', () => {
  const merged = mergeLastRenameOperation(existing, [
    { fileId: '2', original: 'c.txt', renamed: 'd.txt', index: 1 },
  ]);
  expect(merged.items.map(i => i.fileId)).toEqual(['1', '2']);
});

it('shrinks the operation to failed undo items only', () => {
  const next = retainFailedUndoItems(existing, new Set(['2']));
  expect(next?.items.map(i => i.fileId)).toEqual(['2']);
});
```

**Step 2: 运行测试确认失败**

Run:
```bash
npx vitest run tests/unit/last-rename-operation.test.ts
```

Expected: FAIL，提示模块或导出不存在。

**Step 3: 实现最小类型与纯函数**

在 `src/types/undo.ts` 增加：

```ts
export interface UndoRenameItem {
  fileId: string;
  original: string;
  renamed: string;
  index: number;
}

export interface LastRenameOperation {
  platform: PlatformName;
  directoryKey: string;
  createdAt: number;
  updatedAt: number;
  items: UndoRenameItem[];
}
```

在 `src/core/last-rename-operation.ts` 实现：
- `createLastRenameOperation(...)`
- `mergeLastRenameOperation(...)`
- `isLastRenameOperationInScope(...)`
- `retainFailedUndoItems(...)`

**Step 4: 再次运行测试**

Run:
```bash
npx vitest run tests/unit/last-rename-operation.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/types/undo.ts src/core/last-rename-operation.ts tests/unit/last-rename-operation.test.ts
git commit -m "test: cover last rename undo operation helpers"
```

### Task 3: 在 file-selector-panel 中接入记录、retry 合并与 undo 主逻辑

**Files:**
- Modify: `src/content/components/file-selector-panel.ts`
- Modify: `src/types/core.ts`（如需补充 undo 结果或辅助类型，否则保持不动）

**Step 1: 先写失败测试或至少列出要补的帮助方法**

如果暂不引入组件测试，先在代码注释中列出 4 个目标方法：

```ts
private getCurrentUndoScope(): { platform: PlatformName; directoryKey: string }
private clearLastRenameOperationIfOutOfScope(): void
private updateLastRenameOperationFromExecute(results: BatchResults): void
private async handleUndoLastRename(): Promise<void>
```

**Step 2: 增加状态字段**

在 `file-selector-panel.ts` 增加：

```ts
@state()
private lastRenameOperation: LastRenameOperation | null = null;

@state()
private undoBusy = false;
```

**Step 3: 在关键入口先做 scope 校验**

在这些方法开头调用：

```ts
this.clearLastRenameOperationIfOutOfScope();
```

目标入口：
- `updated()`（当 `open` 变为 true 时）
- `handleExecute()`
- `handleRetryFailed()`
- `handleUndoLastRename()`

**Step 4: 在主执行后创建单条记录**

在 `handleExecute()` 成功路径里：

```ts
if (results.success.length > 0) {
  this.lastRenameOperation = createLastRenameOperation(
    this.adapter.platform,
    this.adapter.getCurrentDirectoryKey(),
    results.success
  );
}
```

**Step 5: 在 retry 成功后合并记录**

在 `handleRetryFailed()` 成功路径里：

```ts
if (results.success.length > 0 && this.lastRenameOperation) {
  this.lastRenameOperation = mergeLastRenameOperation(
    this.lastRenameOperation,
    this.adapter.platform,
    this.adapter.getCurrentDirectoryKey(),
    results.success
  );
}
```

**Step 6: 实现 undo 执行**

核心逻辑：

```ts
const tasks = this.lastRenameOperation.items.map((item, index) => ({
  file: this.allFiles.find(file => file.id === item.fileId) ?? {
    id: item.fileId,
    name: item.renamed,
    ext: parseFileName(item.renamed).ext,
    parentId: '',
    size: 0,
    mtime: Date.now(),
  },
  newName: item.original,
  index,
}));
```

然后复用 `BatchExecutor`：

```ts
const executor = new BatchExecutor(tasks.map(t => t.file), this.ruleConfig, this.adapter, {
  requestInterval: this.adapter.getConfig().requestInterval,
  maxConcurrent: this.adapter.getConfig().maxConcurrent,
  tasks,
  onProgress: (progress) => this.handleProgress(progress),
});
```

**Step 7: 处理撤销后的记录状态**
- 全部成功：`this.lastRenameOperation = null`
- 部分失败：只保留失败 fileId 对应的项

```ts
const failedIds = new Set(results.failed.map(item => item.fileId));
this.lastRenameOperation = retainFailedUndoItems(this.lastRenameOperation, failedIds);
```

**Step 8: 运行定向测试与类型检查**

Run:
```bash
npm run typecheck
npx vitest run tests/unit/last-rename-operation.test.ts tests/unit/executor.test.ts
```

Expected: PASS

**Step 9: Commit**

```bash
git add src/content/components/file-selector-panel.ts src/types/core.ts
git commit -m "feat: add single-operation undo flow"
```

### Task 4: 在 config-panel 加入撤销按钮和多语言文案

**Files:**
- Modify: `src/content/components/config-panel.ts`
- Modify: `src/locales/zh_CN.json`
- Modify: `src/locales/en.json`
- Modify: `src/locales/zh_TW.json`

**Step 1: 先加 props 和事件**

在 `config-panel.ts` 增加：

```ts
@property({ type: Boolean }) canUndo = false;
@property({ type: Boolean }) undoBusy = false;
```

以及：

```ts
private handleUndo(): void {
  this.dispatchEvent(new CustomEvent('undo', { bubbles: true, composed: true }));
}
```

**Step 2: 在执行区渲染按钮**

在 `renderExecutionActions()` 的非 executing 分支中加入：

```ts
<button
  class="button button-default"
  ?disabled=${!this.canUndo || this.undoBusy}
  @click=${this.handleUndo}
>
  ${this.undoBusy ? I18nService.t('undo_in_progress') : I18nService.t('undo_last_rename')}
</button>
```

并在 `file-selector-panel.ts` 的 `render()` 中传入：

```ts
.canUndo=${Boolean(this.lastRenameOperation)}
.undoBusy=${this.undoBusy}
@undo=${this.handleUndoLastRename}
```

**Step 3: 增加 i18n 文案**

至少新增：
- `undo_last_rename`
- `undo_in_progress`
- `undo_failed_prefix`
- `undo_failed_manual_hint`
- `undo_scope_hint`

**Step 4: 运行定向测试/构建检查**

Run:
```bash
npm run typecheck
npm run lint
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/content/components/config-panel.ts src/locales/zh_CN.json src/locales/en.json src/locales/zh_TW.json
git commit -m "feat: add undo action to rename panel"
```

### Task 5: 完成失败提示与整体验证

**Files:**
- Modify: `src/content/components/file-selector-panel.ts`
- Modify: `tests/integration/batch-execution.test.ts`（如需新增集成回归样例）
- Optional: `tests/e2e/batch-rename.spec.ts`

**Step 1: 在 undo 失败分支拼接提示文本**

示例：

```ts
const failedLines = results.failed.map(item => `- ${item.file.name}: ${item.error}`);
alert([
  I18nService.t('undo_failed_prefix'),
  ...failedLines,
  '',
  I18nService.t('undo_failed_manual_hint'),
].join('\n'));
```

**Step 2: 增加一条集成回归样例（推荐）**

目标断言：
- 首次执行成功 + retry 成功后，唯一记录包含两批成功项
- undo 后两批文件都恢复原名

**Step 3: 运行完整验证**

Run:
```bash
npm run test:ci
npm run typecheck
npm run lint
```

Expected: 全部通过

**Step 4: 手工验证当前目录 scope**

Run:
```bash
npm run dev
```

手工检查：
1. 在同目录执行批量重命名；
2. 关闭面板，再打开，undo 按钮仍可用；
3. 切换目录，再打开面板，undo 按钮消失；
4. 回原目录（若页面未刷新且采用懒清理，则记录已被清空，这是符合当前规则的）；
5. retry 成功的文件也会被 undo 回退。

**Step 5: Commit**

```bash
git add src/content/components/file-selector-panel.ts tests/integration/batch-execution.test.ts tests/e2e/batch-rename.spec.ts
git commit -m "test: verify last batch undo workflow"
```
