# Last Batch Undo Design（仅撤销最近一次批量重命名）

**Date:** 2026-03-18

## Goal
在现有批量重命名面板中增加“撤销上一次批量重命名”能力：只回退当前平台、当前目录下最近一次点击“批量重命名”按钮触发的那次批量操作，并允许用户关闭面板查看真实结果后再返回撤销。

## Scope
- 在 `file-selector-panel` 中保存 1 条可撤销记录，而不是历史队列。
- 该记录绑定当前平台 + 当前目录。
- 关闭面板后保留记录；只要用户仍在原目录即可执行撤销。
- `retry` 不创建新历史，但 retry 成功项要并入这唯一的一条记录。
- 在 `config-panel` 中新增单一撤销按钮，不做 split-button / 下拉历史。
- 撤销部分失败时，弹窗列出失败文件并提示用户手动处理。

## Non-goals
- 不保留最近 10 次历史。
- 不支持选择任意历史回退。
- 不做跨刷新、跨页面、跨平台持久化撤销。
- 不新增独立弹窗组件；第一版沿用现有 `alert/confirm` 风格提示。

## Decisions
- 可撤销记录只有 1 条，新的批量重命名会覆盖旧记录。
- 生命周期采用“当前平台 + 当前目录 + 当前页面会话”的交集：
  - 关闭面板不清空；
  - 离开当前目录、刷新页面、页面卸载、跨平台访问时失效。
- “离开目录即销毁”第一版采用**懒校验**：在面板打开、点击撤销、点击批量重命名、点击 retry 时检查当前目录 scope；若 scope 不匹配，则先清空记录。
- `retry` 成功项并入当前记录，保证 undo 对应“这次批量操作最终成功改名的全部文件”。
- 部分撤销失败后，保留失败项为新的可撤销记录，方便用户在未离开目录前再次点击 undo；同时弹窗提示手动处理建议。

## Architecture

### 1) 目录 scope 抽象
为 `PlatformAdapter` 增加统一能力：

```ts
getCurrentDirectoryKey(): string;
```

实现方式：
- Quark：复用现有 `getCurrentFolderId()`。
- Aliyun：复用现有 `getParentIdFromUrl()`。
- Baidu：复用现有 `getCurrentPath()`。

`file-selector-panel` 只依赖 `adapter.platform + adapter.getCurrentDirectoryKey()` 判断当前撤销记录是否仍在有效 scope 内。

### 2) 单条撤销记录模型
新增一个轻量数据模型，仅保存 undo 必需信息：

```ts
interface UndoRenameItem {
  fileId: string;
  original: string;
  renamed: string;
  index: number;
}

interface LastRenameOperation {
  platform: PlatformName;
  directoryKey: string;
  createdAt: number;
  updatedAt: number;
  items: UndoRenameItem[];
}
```

只存成功改名项；不存完整 `FileItem`，避免状态冗余。

### 3) 记录写入与合并
#### 主执行（点击“批量重命名”）
- `handleExecute()` 执行完成后，如果存在成功项：
  - 用当前 `platform + directoryKey + results.success` 创建一条新的 `LastRenameOperation`；
  - 覆盖旧记录。

#### Retry
- `handleRetryFailed()` 执行完成后，如果存在成功项：
  - 先校验当前 scope 是否仍与现有记录一致；
  - 一致则把 retry 成功项 merge 进现有记录；
  - 若记录已失效，则不再创建新记录（因为 retry 只是补全原操作，不应在丢失上下文后凭空产生新 undo 历史）。

### 4) 撤销执行
新增 `handleUndoLastRename()`：
1. 校验当前 scope；不匹配则清空记录并退出。
2. 从当前记录生成反向任务：`fileId` 不变，`newName = original`。
3. 复用 `BatchExecutor` 执行这些 tasks。
4. 成功项通过现有 `applyExecutionResults()` + `syncAfterRename()` 回写页面与面板状态。
5. 若全部成功：清空记录。
6. 若部分失败：将记录收窄为失败项，并弹窗提示用户手动处理。

### 5) UI 变更
`config-panel` 新增：
- `canUndo: boolean`
- `undoBusy: boolean`
- `@undo` 事件

页脚按钮区新增：
- `撤销上一次批量重命名`

按钮行为：
- 仅当当前 scope 有有效记录时可点击；
- 正在执行批量重命名或撤销时禁用；
- 文案建议加辅助说明：仅针对当前目录最近一次批量重命名。

### 6) 错误处理
- scope 不匹配：静默清空记录，并隐藏/禁用撤销按钮。
- 撤销零任务：若记录为空或已无可回退项，直接清空记录并返回。
- 部分失败：使用 i18n 头部文案 + 文件列表 + 手动处理提示拼接成 `alert()` 文本。
- 全部失败：记录保留，便于用户在确认真实页面状态后再次尝试。

## Data Flow

### A. 主执行
```
点击 Execute
  -> handleExecute()
  -> BatchExecutor.execute()
  -> applyExecutionResults()
  -> create LastRenameOperation from results.success
```

### B. Retry
```
点击 Retry
  -> handleRetryFailed()
  -> BatchExecutor.execute(tasks=failed only)
  -> applyExecutionResults()
  -> merge retry success into LastRenameOperation
```

### C. Undo
```
点击 Undo
  -> validate current scope
  -> build reverse tasks from LastRenameOperation.items
  -> BatchExecutor.execute(tasks=undo)
  -> applyExecutionResults()
  -> clear record OR keep only failed items
```

## Testing Strategy (TDD)
- 单元测试新建纯函数/帮助模块：
  - 从 `BatchResults.success` 创建记录；
  - retry 成功项 merge；
  - scope 校验；
  - 部分 undo 失败后保留失败项。
- 适配器测试覆盖 `getCurrentDirectoryKey()`。
- 现有依赖 `PlatformAdapter` 的 mock 全部补上 `getCurrentDirectoryKey()` 以通过 typecheck。
- 回归验证：
  - 普通批量重命名流程不受影响；
  - retry 后 undo 能覆盖首次成功项 + retry 成功项；
  - 离开目录后 undo 按钮消失/失效。

## Rollout
- 第一版优先采用懒校验而不是复杂的实时路由监听。
- 若后续观察到“切目录后按钮残留到下一次交互前”影响体验，再补目录变化监听器。
