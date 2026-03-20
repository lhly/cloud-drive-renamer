# Diagnostic Export Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 补完失败诊断导出与反馈引导剩余链路，使用户在失败结果页中可以直接导出 JSON 诊断文件并看到后续反馈动作。

**Architecture:** 以 `FileSelectorPanel` 为诊断状态源，`ConfigPanel` 仅负责渲染提示条并抛事件；background 通过 `diagnostic-service` 管理最近日志与导出 payload；content 侧通过 Blob 下载文件，不新增权限。

**Tech Stack:** TypeScript、Lit、Chrome Extension MV3、chrome.runtime messaging、chrome.storage.local、Vitest、jsdom

---

## Inputs

- Spec: `docs/superpowers/specs/2026-03-20-diagnostic-export-completion-design.md`
- Existing design: `docs/superpowers/specs/2026-03-19-diagnostic-export-feedback-design.md`
- Existing ring buffer: `src/background/diagnostic-log-store.ts`

## File Structure

### Create
- `src/types/runtime-message.ts`
- `src/background/diagnostic-service.ts`
- `src/core/diagnostic-session.ts`
- `src/utils/diagnostic-download.ts`
- `tests/unit/logger.test.ts`
- `tests/unit/diagnostic-service.test.ts`
- `tests/unit/diagnostic-session.test.ts`
- `tests/unit/config-panel-diagnostic-feedback.test.ts`
- `tests/unit/file-selector-panel-diagnostic-feedback.test.ts`

### Modify
- `src/utils/logger.ts`
- `src/background/service-worker.ts`
- `src/content/index.ts`
- `src/content/components/config-panel.ts`
- `src/content/components/file-selector-panel.ts`
- `src/types/diagnostic.ts`
- `src/locales/zh_CN.json`
- `src/locales/zh_TW.json`
- `src/locales/en.json`
- `docs/testing/manual-test-cases.md`

### Keep Unchanged
- `manifest.json`

---

### Task 1: Runtime message 与 background diagnostic service

**Files:**
- Create: `src/types/runtime-message.ts`
- Create: `src/background/diagnostic-service.ts`
- Modify: `src/background/service-worker.ts`
- Test: `tests/unit/diagnostic-service.test.ts`

- [ ] **Step 1: 写 `diagnostic-service` 的失败测试**

```ts
it('builds export payload from stored last failure and recent logs', async () => {
  const payload = await service.getExportPayload();
  expect(payload.lastFailure?.failure.reason).toBe('batch-execution-failed');
  expect(payload.logs).toHaveLength(2);
});

it('returns null lastFailure when no snapshot is stored', async () => {
  const payload = await service.getExportPayload();
  expect(payload.lastFailure).toBeNull();
});
```

- [ ] **Step 2: 运行测试确认先失败**

Run:
```bash
npx vitest run tests/unit/diagnostic-service.test.ts
```

Expected:
- FAIL，提示 `diagnostic-service` 或相关 message type 不存在。

- [ ] **Step 3: 实现最小 runtime message 类型**

Implementation notes:
- 在 `src/types/runtime-message.ts` 定义：
  - `APPEND_DIAGNOSTIC_LOG`
  - `GET_DIAGNOSTIC_EXPORT`
  - `OPEN_EXTERNAL_URL`

- [ ] **Step 4: 实现 `diagnostic-service.ts`**

Implementation notes:
- 封装 `appendLog(entry)`
- 封装 `getExportPayload()`
- 封装 `openExternalUrl(url)`
- 读取 `DIAGNOSTIC_STORAGE_KEYS.LAST_FAILURE` 和 ring buffer

- [ ] **Step 5: 接到 `service-worker.ts`**

Implementation notes:
- `service-worker.ts` 只做 message routing
- 不把 payload 组装逻辑散落在 switch 中

- [ ] **Step 6: 复跑测试确认通过**

Run:
```bash
npx vitest run tests/unit/diagnostic-service.test.ts tests/unit/diagnostic-log-store.test.ts
```

Expected:
- PASS

---

### Task 2: Logger diagnostic transport

**Files:**
- Modify: `src/utils/logger.ts`
- Modify: `src/content/index.ts`
- Test: `tests/unit/logger.test.ts`

- [ ] **Step 1: 写 logger transport 的失败测试**

```ts
it('extracts module prefix and forwards structured diagnostic entry', () => {
  const transport = vi.fn();
  configureLoggerDiagnostics({ source: 'content', transport });
  logger.error('[FileSelectorPanel] Retry failed:', new Error('boom'));
  expect(transport).toHaveBeenCalledWith(expect.objectContaining({
    module: 'FileSelectorPanel',
    level: 'ERROR',
    message: 'Retry failed:',
  }));
});
```

- [ ] **Step 2: 运行测试确认先失败**

Run:
```bash
npx vitest run tests/unit/logger.test.ts
```

Expected:
- FAIL，提示 `configureLoggerDiagnostics` 不存在或 transport 未被调用。

- [ ] **Step 3: 在 `logger.ts` 实现 transport 配置**

Implementation notes:
- 保持既有 `logger.info/warn/error` 调用方式兼容
- 用模块前缀正则提取 `[Module]`
- transport 异常要吞掉，不影响 console 输出

- [ ] **Step 4: 在 `content/index.ts` 里接入 transport**

Implementation notes:
- 启动时配置一次
- transport 使用 `chrome.runtime.sendMessage`
- 失败时静默降级

- [ ] **Step 5: 复跑测试确认通过**

Run:
```bash
npx vitest run tests/unit/logger.test.ts
```

Expected:
- PASS

---

### Task 3: 最近失败快照领域模型

**Files:**
- Modify: `src/types/diagnostic.ts`
- Create: `src/core/diagnostic-session.ts`
- Test: `tests/unit/diagnostic-session.test.ts`

- [ ] **Step 1: 写失败快照构建的失败测试**

```ts
it('builds failure snapshot from batch results', () => {
  const snapshot = buildLastFailureDiagnosticSnapshot(...);
  expect(snapshot.summary.failed).toBe(2);
  expect(snapshot.failures[0]?.targetName).toBe('new-a.txt');
});

it('builds feedback summary text with platform and file name', () => {
  const text = buildDiagnosticFeedbackText(...);
  expect(text).toContain('夸克网盘');
  expect(text).toContain('cloud-drive-renamer-diagnostic');
});
```

- [ ] **Step 2: 运行测试确认先失败**

Run:
```bash
npx vitest run tests/unit/diagnostic-session.test.ts
```

Expected:
- FAIL，提示诊断 session 纯函数不存在。

- [ ] **Step 3: 在 `diagnostic.ts` 扩展必要类型**

Implementation notes:
- 增加 summary / failure item / prompt state 联合类型
- 保持现有 ring buffer 类型兼容

- [ ] **Step 4: 实现 `diagnostic-session.ts`**

Implementation notes:
- 提供构造快照、重试统计合并、反馈摘要构造等纯函数

- [ ] **Step 5: 复跑测试确认通过**

Run:
```bash
npx vitest run tests/unit/diagnostic-session.test.ts
```

Expected:
- PASS

---

### Task 4: ConfigPanel 结果区诊断提示条

**Files:**
- Modify: `src/content/components/config-panel.ts`
- Modify: `src/locales/zh_CN.json`
- Modify: `src/locales/zh_TW.json`
- Modify: `src/locales/en.json`
- Test: `tests/unit/config-panel-diagnostic-feedback.test.ts`

- [ ] **Step 1: 写 `ConfigPanel` 提示条失败测试**

```ts
it('renders diagnostic ready prompt when finished with failures', async () => {
  const panel = new ConfigPanel();
  panel.finished = true;
  panel.progress = { completed: 2, total: 2, currentFile: '', success: 0, failed: 2 };
  panel.diagnosticPromptState = 'ready';
  panel.diagnosticFailureCount = 2;
  document.body.appendChild(panel);
  await panel.updateComplete;
  expect(panel.shadowRoot?.querySelector('[data-role=\"diagnostic-export-button\"]')).toBeTruthy();
});
```

- [ ] **Step 2: 运行测试确认先失败**

Run:
```bash
npx vitest run tests/unit/config-panel-diagnostic-feedback.test.ts
```

Expected:
- FAIL，提示诊断属性或按钮不存在。

- [ ] **Step 3: 在 `ConfigPanel` 增加诊断只读属性与事件**

Implementation notes:
- 新增 `diagnosticPromptState`
- 新增 `diagnosticFailureCount`
- 新增 `diagnosticFileName`
- 新增 `diagnosticErrorMessage`
- 新增导出/反馈相关事件

- [ ] **Step 4: 在 `renderExecutionView()` 插入提示条**

Implementation notes:
- 提示条位置放在 sync status 后、动作区前
- 不破坏现有 footer 布局

- [ ] **Step 5: 补齐 i18n**

- [ ] **Step 6: 复跑测试确认通过**

Run:
```bash
npx vitest run tests/unit/config-panel-diagnostic-feedback.test.ts tests/unit/config-panel-undo.test.ts
```

Expected:
- PASS

---

### Task 5: FileSelectorPanel 导出与反馈动作闭环

**Files:**
- Modify: `src/content/components/file-selector-panel.ts`
- Create: `src/utils/diagnostic-download.ts`
- Test: `tests/unit/file-selector-panel-diagnostic-feedback.test.ts`
- Modify: `docs/testing/manual-test-cases.md`

- [ ] **Step 1: 写 `FileSelectorPanel` 导出动作失败测试**

```ts
it('stores a diagnostic snapshot and exposes ready state after failed execution', async () => {
  // arrange failed results
  expect(panel.diagnosticPromptState).toBe('ready');
});

it('downloads diagnostic payload and transitions to exported state', async () => {
  await panel.handleDiagnosticExport();
  expect(downloadDiagnosticPayload).toHaveBeenCalled();
  expect(panel.diagnosticPromptState).toBe('exported');
});
```

- [ ] **Step 2: 运行测试确认先失败**

Run:
```bash
npx vitest run tests/unit/file-selector-panel-diagnostic-feedback.test.ts
```

Expected:
- FAIL，提示导出状态/方法不存在。

- [ ] **Step 3: 实现 `diagnostic-download.ts`**

Implementation notes:
- `downloadDiagnosticPayload(payload): Promise<string>`
- `buildGithubIssueUrl(...)`
- `buildMailtoUrl(...)`
- `buildDiagnosticFeedbackText(...)`

- [ ] **Step 4: 在 `FileSelectorPanel` 实现诊断状态机**

Implementation notes:
- 在 execute / retry 结果落地后保存最近失败快照
- 失败数为 0 时隐藏提示条
- 导出时请求 `GET_DIAGNOSTIC_EXPORT`
- 成功后进入 `exported`
- 失败后进入 `error`

- [ ] **Step 5: 把状态透传到 `ConfigPanel` 并接线事件**

- [ ] **Step 6: 补充手动测试文档**

- [ ] **Step 7: 复跑针对性测试**

Run:
```bash
npx vitest run \
  tests/unit/file-selector-panel-diagnostic-feedback.test.ts \
  tests/unit/config-panel-diagnostic-feedback.test.ts \
  tests/unit/diagnostic-session.test.ts \
  tests/unit/diagnostic-service.test.ts \
  tests/unit/logger.test.ts
```

Expected:
- PASS

---

### Task 6: 全量验证

**Files:**
- Verify only

- [ ] **Step 1: 运行完整验证**

Run:
```bash
npm run validate
```

Expected:
- PASS，允许既有 lint warnings 存在，但不得新增 error

- [ ] **Step 2: 运行构建验证**

Run:
```bash
npm run build
```

Expected:
- PASS

- [ ] **Step 3: 整理手动测试路径**

Manual:
- 在开发环境制造至少 1 个失败结果
- 验证结果区出现导出入口
- 点击下载 JSON
- 检查导出后引导状态
- 验证“暂不处理”会隐藏提示条
