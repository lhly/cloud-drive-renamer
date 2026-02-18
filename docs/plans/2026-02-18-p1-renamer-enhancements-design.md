# P1 Enhancements Design (冲突检测 / 自适应节流 / 崩溃恢复)

**Date:** 2026-02-18

## Goal
在当前扩展中补齐三项 P1 能力：
1) 执行前的外部冲突检测 + 策略选择；
2) 自适应节流（仅拉长请求间隔）；
3) 崩溃恢复流程在面板打开时可触达。

## Scope
- 覆盖三项能力的 UI 交互与核心逻辑接入。
- 保持现有执行引擎并发语义不变。
- 不引入新平台适配或规则类型。

## Non-goals
- 不调整最大并发（仅动态调整 requestInterval）。
- 不改变现有规则引擎与 preview 逻辑。
- 不引入新的 UI 页面，仅在现有面板内提示/弹窗。

## Decisions
- 冲突检测采用“执行前统一检测 + 策略选择”。
- 自适应节流只拉长请求间隔，不调并发。
- 崩溃恢复在面板打开时自动检测并弹窗。

## Architecture

### 1) 外部冲突检测（UI 执行前）
- 接入点：`file-selector-panel.ts` 的 `handleExecute()`。
- 流程：
  1. 计算当前 `selectedFiles` + `newNameMap`。
  2. 调用 `ConflictDetector.detectConflicts(files, newNames)`。
  3. 若有冲突 -> 弹窗 `showConflictResolutionDialog()` 选择策略。
  4. 根据策略 `resolveConflicts(...)` 生成 `resolvedNames`。
  5. 用 `resolvedNames` 生成任务列表，并交给 `BatchExecutor` 执行。
- 错误兜底：冲突检测失败时提示用户是否继续执行（默认取消）。

### 2) 自适应节流（BatchExecutor 内）
- 新增 `adaptiveIntervalFactor`（初始 1.0）。
- `waitForRequestSlot()` 使用 `requestInterval * factor` 作为实际间隔。
- 在 `processTask` 识别“限流/重试信号”时上调 factor（例如 x1.5, capped）。
- 识别策略：基于错误对象特征（如 `code/errno`、错误名或消息包含“TooManyRequests/429/频繁”等）。
- 可选回落：连续成功 N 次后缓慢回落 factor（保持稳定性）。

### 3) 崩溃恢复接入
- 面板打开时调用 `initCrashRecovery(adapter)`。
- 执行开始前调用 `crashRecovery.saveOperationState` 写入任务与规则。
- 执行中根据进度调用 `crashRecovery.markAsCompleted/markAsFailed`。
- 执行完成/取消后 `crashRecovery.clearOperationState`。

## Data Flow

### 冲突检测
```
用户点击执行
  -> 构造 newNames
  -> detectConflicts
  -> showConflictResolutionDialog
  -> resolveConflicts
  -> BatchExecutor(tasks)
```

### 自适应节流
```
processTask -> detectBackoffSignal(error)
  -> increase adaptiveIntervalFactor
  -> waitForRequestSlot uses interval * factor
```

### 崩溃恢复
```
面板打开 -> initCrashRecovery(adapter)
执行开始 -> saveOperationState
执行中 -> markAsCompleted/markAsFailed
完成/取消 -> clearOperationState
```

## Error Handling
- 冲突检测失败：提示“检测失败，是否继续执行？”默认取消。
- 策略选择取消：终止执行。
- 恢复失败：提示失败原因并清理恢复状态。

## Testing Strategy (TDD)
- 新增单元测试：
  - 冲突检测/策略解析生成的任务是否正确。
  - 自适应节流：触发 backoff 信号后间隔增长。
- 回归：原有执行流程应保持一致（并发/暂停/取消不变）。

## Rollout
- 功能在现有面板内呈现，无需迁移数据。
- 若出现问题，可通过配置开关回退（如将 backoff 逻辑禁用）。
