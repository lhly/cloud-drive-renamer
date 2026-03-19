# Diagnostic Export & Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为批量重命名失败场景补齐一套面向小白用户的诊断导出与反馈引导流程：失败后在结果区内联显示导出入口，一键下载 JSON 诊断文件，并在下载后原地提示用户去 GitHub/邮件反馈或复制说明。

**Architecture:** 保持现有执行结果页不变形，在 `ConfigPanel` 里增设一个低打扰的诊断提示条状态机。日志采集采用“结构化 logger + background 持久化最近 300 条日志 + content 侧保存最近失败任务摘要”的双源模型；导出时由 background 组装 payload，再由 content 侧通过 Blob 下载，避免新增 `downloads` 权限。

**Tech Stack:** TypeScript、Lit Web Components、Chrome Extension Manifest V3、chrome.storage.local、chrome.runtime messaging、Vitest、jsdom

---

## Inputs
- Spec: `docs/superpowers/specs/2026-03-19-diagnostic-export-feedback-design.md`
- Existing execution UI: `src/content/components/config-panel.ts`, `src/content/components/file-selector-panel.ts`
- Existing logger/storage utilities: `src/utils/logger.ts`, `src/utils/storage.ts`
- Background integration point: `src/background/service-worker.ts`

## File Structure

### Create
- `src/types/diagnostic.ts`
  - 诊断导出领域类型、storage keys、UI 状态枚举。
- `src/types/runtime-message.ts`
  - 诊断相关 runtime message 类型，避免继续在 `service-worker.ts` 中散落魔法字符串。
- `src/background/diagnostic-log-store.ts`
  - 负责最近 300 条结构化日志的持久化和裁剪。
- `src/background/diagnostic-service.ts`
  - 负责接收日志追加、读取失败快照、组装导出 payload、打开反馈链接。
- `src/core/diagnostic-session.ts`
  - 纯函数：创建失败任务摘要、记录重试、合并结果、生成反馈说明摘要。
- `src/utils/diagnostic-download.ts`
  - content 侧 Blob 下载 helper，以及 GitHub/邮件/复制说明所需的文案构建函数。
- `tests/unit/logger.test.ts`
- `tests/unit/diagnostic-log-store.test.ts`
- `tests/unit/diagnostic-service.test.ts`
- `tests/unit/diagnostic-session.test.ts`
- `tests/unit/config-panel-diagnostic-feedback.test.ts`
- `tests/unit/file-selector-panel-diagnostic-feedback.test.ts`

### Modify
- `src/utils/logger.ts`
  - 在保持现有 `logger.info/warn/error` 调用方式兼容的前提下，增加结构化诊断 transport。
- `src/content/index.ts`
  - content 启动时配置 logger，把诊断日志 fire-and-forget 地发给 background。
- `src/background/service-worker.ts`
  - 启动 diagnostic service；处理 `APPEND_DIAGNOSTIC_LOG`、`GET_DIAGNOSTIC_EXPORT`、`OPEN_EXTERNAL_URL`。
- `src/content/components/config-panel.ts`
  - 渲染“导出诊断 / 暂不处理”提示条以及导出后的引导条。
- `src/content/components/file-selector-panel.ts`
  - 维护诊断 UI 状态、失败摘要、导出与反馈动作。
- `src/locales/zh_CN.json`
- `src/locales/zh_TW.json`
- `src/locales/en.json`
  - 新增诊断提示条、导出成功文案、按钮标签、错误提示。
- `README.md`
  - 更新“问题反馈/故障排查”说明，加入新导出流程。
- `docs/store-assets/PRIVACY_POLICY.md`
  - 补充“用户主动导出诊断文件时可能包含文件名，但不会自动上传”。
- `docs/testing/manual-test-cases.md`
  - 增补手动验证步骤。

### Keep Unchanged
- `manifest.json`
  - **不要**增加 `downloads` 权限；MVP 通过 content 侧 Blob 下载避免商店权限变更。
- `src/popup/popup.ts`
  - MVP 不改 popup，二期再考虑“再次导出最近一次诊断”。

---

### Task 1: 建立诊断领域模型与最近 300 条日志存储

**Files:**
- Create: `src/types/diagnostic.ts`
- Create: `src/background/diagnostic-log-store.ts`
- Create: `tests/unit/diagnostic-log-store.test.ts`
- Modify: `src/utils/storage.ts` (only if a tiny helper is truly needed; otherwise keep untouched)

- [ ] **Step 1: 先写失败测试，锁定 ring buffer 行为**

```ts
it('keeps only the latest 300 diagnostic log entries', async () => {
  const store = new DiagnosticLogStore(mockStorage);
  for (let i = 0; i < 305; i++) {
    await store.append({ id: `log-${i}`, level: 'INFO', message: `m-${i}` } as DiagnosticLogEntry);
  }
  const logs = await store.getRecent();
  expect(logs).toHaveLength(300);
  expect(logs[0].id).toBe('log-5');
  expect(logs.at(-1)?.id).toBe('log-304');
});

it('clears the buffer without touching unrelated keys', async () => {
  await store.clear();
  expect(mockChromeStorage.remove).toHaveBeenCalledWith(DIAGNOSTIC_STORAGE_KEYS.RECENT_LOGS);
});
```

- [ ] **Step 2: 运行测试，确认先失败**

Run:
```bash
npx vitest run tests/unit/diagnostic-log-store.test.ts
```

Expected:
- FAIL，提示 `DiagnosticLogStore` 或 `DIAGNOSTIC_STORAGE_KEYS` 尚不存在。

- [ ] **Step 3: 最小化实现诊断类型与日志存储**

Implementation notes:
- 在 `src/types/diagnostic.ts` 定义：
  - `DiagnosticLogEntry`
  - `DiagnosticFailureEntry`
  - `LastFailureDiagnosticSnapshot`
  - `DiagnosticExportPayload`
  - `DiagnosticPromptState`
  - `DIAGNOSTIC_STORAGE_KEYS`
- 在 `src/background/diagnostic-log-store.ts` 实现：
  - `append(entry)`
  - `getRecent()`
  - `clear()`
- 使用现有 `chrome.storage.local`，不要引入额外依赖。

```ts
export const DIAGNOSTIC_STORAGE_KEYS = {
  RECENT_LOGS: 'diagnostic_recent_logs',
  LAST_FAILURE: 'diagnostic_last_failure',
} as const;
```

- [ ] **Step 4: 复跑测试，确认通过**

Run:
```bash
npx vitest run tests/unit/diagnostic-log-store.test.ts tests/unit/storage.test.ts
```

Expected:
- PASS。
- 不应破坏既有 `storage` 行为。

- [ ] **Step 5: 提交本任务**

```bash
git add src/types/diagnostic.ts src/background/diagnostic-log-store.ts tests/unit/diagnostic-log-store.test.ts
git commit -m "feat: add diagnostic log ring buffer"
```

---

### Task 2: 给 logger 接上结构化诊断 transport，并在 background 暴露导出服务

**Files:**
- Create: `src/types/runtime-message.ts`
- Create: `src/background/diagnostic-service.ts`
- Create: `tests/unit/logger.test.ts`
- Create: `tests/unit/diagnostic-service.test.ts`
- Modify: `src/utils/logger.ts`
- Modify: `src/content/index.ts`
- Modify: `src/background/service-worker.ts`

- [ ] **Step 1: 先写 logger 与 diagnostic service 的失败测试**

```ts
it('normalizes bracket-prefixed messages into structured diagnostic entries', () => {
  const transport = vi.fn();
  configureLoggerDiagnostics({ source: 'content', transport });
  logger.error('[FileSelectorPanel] Retry failed:', new Error('boom'));
  expect(transport).toHaveBeenCalledWith(expect.objectContaining({
    module: 'FileSelectorPanel',
    level: 'ERROR',
    message: 'Retry failed:',
  }));
});

it('builds an export payload from the last failure snapshot and recent logs', async () => {
  const payload = await service.getExportPayload();
  expect(payload.summary.failed).toBe(2);
  expect(payload.logs).toHaveLength(2);
});
```

- [ ] **Step 2: 运行测试，确认先失败**

Run:
```bash
npx vitest run tests/unit/logger.test.ts tests/unit/diagnostic-service.test.ts
```

Expected:
- FAIL，提示缺少 logger transport / diagnostic service。

- [ ] **Step 3: 以兼容方式扩展 logger**

Implementation notes:
- 保持现有 `logger.info(message, ...args)` 兼容，不做全仓库调用点重写。
- 新增轻量配置入口，例如：
  - `configureLoggerDiagnostics({ source, transport })`
- 用正则提取 `[FileSelectorPanel]` 这类模块名前缀；提不到就回退到 `source`。
- transport 必须是 fire-and-forget，任何异常都不能影响原有 UI 行为。

```ts
const MODULE_PREFIX_RE = /^\[([^\]]+)\]\s*/;
```

- [ ] **Step 4: 实现 background diagnostic service 与 runtime message**

Implementation notes:
- `src/types/runtime-message.ts` 至少定义：
  - `APPEND_DIAGNOSTIC_LOG`
  - `GET_DIAGNOSTIC_EXPORT`
  - `OPEN_EXTERNAL_URL`
- `src/background/diagnostic-service.ts` 负责：
  - `appendLog(entry)`
  - `getExportPayload()`
  - `openExternalUrl(url)`
- `service-worker.ts` 只做 message routing，不写业务拼装逻辑。
- `content/index.ts` 启动时调用 logger diagnostic 配置，把结构化日志转发到 background。

- [ ] **Step 5: 复跑聚焦测试**

Run:
```bash
npx vitest run tests/unit/logger.test.ts tests/unit/diagnostic-service.test.ts
```

Expected:
- PASS。
- `service-worker.ts` 只需最薄的一层接线。

- [ ] **Step 6: 提交本任务**

```bash
git add src/types/runtime-message.ts src/background/diagnostic-service.ts src/utils/logger.ts src/content/index.ts src/background/service-worker.ts tests/unit/logger.test.ts tests/unit/diagnostic-service.test.ts
git commit -m "feat: add structured diagnostic logging service"
```

---

### Task 3: 把“最近一次失败任务摘要”从纯 UI 状态提炼成可导出的领域对象

**Files:**
- Create: `src/core/diagnostic-session.ts`
- Create: `tests/unit/diagnostic-session.test.ts`
- Modify: `src/content/components/file-selector-panel.ts`

- [ ] **Step 1: 先写失败测试，锁定失败摘要与重试合并行为**

```ts
it('builds a failure snapshot from execution plan and results', () => {
  const snapshot = finalizeDiagnosticSession({
    platform: 'quark',
    ruleConfig,
    tasks,
    results,
    startedAt: 1,
    finishedAt: 2,
    retried: false,
  });
  expect(snapshot.summary.failed).toBe(1);
  expect(snapshot.failures[0]).toEqual(expect.objectContaining({
    originalName: 'old-a.txt',
    targetName: 'new-a.txt',
    errorMessage: 'quota limited',
  }));
});

it('marks the snapshot as retried and merges retry failures by file id', () => {
  const merged = mergeRetryIntoDiagnosticSnapshot(snapshot, retryResults, 3);
  expect(merged.summary.retried).toBe(true);
  expect(merged.failures).toHaveLength(1);
});
```

- [ ] **Step 2: 运行测试，确认先失败**

Run:
```bash
npx vitest run tests/unit/diagnostic-session.test.ts
```

Expected:
- FAIL，提示缺少 session helper。

- [ ] **Step 3: 实现纯函数 helper，再接入 `FileSelectorPanel`**

Implementation notes:
- `src/core/diagnostic-session.ts` 只负责数据变换，不依赖 DOM。
- `file-selector-panel.ts` 中新增：
  - `diagnosticPromptState`
  - `diagnosticSnapshot`
  - `diagnosticExportFilename`
- 在首次执行完成且 `failed > 0` 时保存最近失败快照到 `chrome.storage.local`。
- 在全成功、返回、关闭时清理对应 UI 状态；是否清理 storage 由产品决定：MVP 允许保留最近一次失败快照，供同页导出即可。

- [ ] **Step 4: 复跑测试，确认通过**

Run:
```bash
npx vitest run tests/unit/diagnostic-session.test.ts tests/unit/file-selector-panel-undo.test.ts
```

Expected:
- PASS。
- 不影响现有撤销逻辑。

- [ ] **Step 5: 提交本任务**

```bash
git add src/core/diagnostic-session.ts src/content/components/file-selector-panel.ts tests/unit/diagnostic-session.test.ts
git commit -m "feat: persist last failure diagnostic snapshot"
```

---

### Task 4: 先写 UI 测试，再给 `ConfigPanel` 加内联诊断提示条与导出后引导条

**Files:**
- Create: `tests/unit/config-panel-diagnostic-feedback.test.ts`
- Modify: `src/content/components/config-panel.ts`
- Modify: `src/locales/zh_CN.json`
- Modify: `src/locales/zh_TW.json`
- Modify: `src/locales/en.json`

- [ ] **Step 1: 写失败测试，锁定 ready / exporting / exported / error 四种状态**

```ts
it('renders an inline diagnostic prompt when execution finished with failures', async () => {
  const panel = new ConfigPanel();
  panel.finished = true;
  panel.progress = { completed: 3, total: 3, currentFile: '', success: 1, failed: 2 };
  panel.diagnosticPromptState = 'ready';
  panel.diagnosticFailureCount = 2;
  document.body.appendChild(panel);
  await panel.updateComplete;
  expect(panel.shadowRoot?.textContent).toContain('可导出诊断文件');
});

it('dispatches export and dismiss events from the inline prompt', async () => {
  // 点击 data-role="diagnostic-export-button" / "diagnostic-dismiss-button"
});
```

- [ ] **Step 2: 运行测试，确认先失败**

Run:
```bash
npx vitest run tests/unit/config-panel-diagnostic-feedback.test.ts
```

Expected:
- FAIL，提示 `diagnosticPromptState` 等属性或按钮不存在。

- [ ] **Step 3: 实现最小可用的提示条状态机**

Implementation notes:
- 新增公开属性：
  - `diagnosticPromptState`
  - `diagnosticFailureCount`
  - `diagnosticFileName`
  - `diagnosticErrorMessage`
- ready 状态显示：
  - 文案 + `导出诊断` + `暂不处理`
- exporting 状态显示 loading 文案；导出按钮 disabled。
- exported 状态显示：
  - `去 GitHub 反馈`
  - `邮件反馈`
  - `复制说明`
  - `暂不处理`
- error 状态显示：
  - `重新导出`
  - `暂不处理`
- 保持视觉级别低于主操作按钮，避免使用醒目的 danger 样式。

- [ ] **Step 4: 更新三套 locale，并复跑 UI 测试**

Run:
```bash
npx vitest run tests/unit/config-panel-diagnostic-feedback.test.ts tests/unit/config-panel-undo.test.ts
```

Expected:
- PASS。
- 不影响既有 footer 按钮布局与 undo 按钮展示。

- [ ] **Step 5: 提交本任务**

```bash
git add src/content/components/config-panel.ts src/locales/zh_CN.json src/locales/zh_TW.json src/locales/en.json tests/unit/config-panel-diagnostic-feedback.test.ts
git commit -m "feat: add inline diagnostic feedback prompt"
```

---

### Task 5: 集成导出、Blob 下载、反馈链接与复制说明到 `FileSelectorPanel`

**Files:**
- Create: `src/utils/diagnostic-download.ts`
- Create: `tests/unit/file-selector-panel-diagnostic-feedback.test.ts`
- Modify: `src/content/components/file-selector-panel.ts`
- Modify: `src/content/components/config-panel.ts` (only event typings / bindings if required)

- [ ] **Step 1: 先写失败测试，锁定导出与后续动作的状态切换**

```ts
it('requests export payload, downloads a json file, then switches the prompt into exported state', async () => {
  vi.spyOn(chrome.runtime, 'sendMessage')
    .mockResolvedValueOnce({ payload })
    .mockResolvedValueOnce({ success: true });
  const download = vi.spyOn(diagnosticDownload, 'downloadDiagnosticPayload').mockResolvedValue('cloud-drive-renamer-diagnostic-2026-03-19-1432.json');
  await panel.handleDiagnosticExport();
  expect(download).toHaveBeenCalledWith(payload);
  expect(panel.diagnosticPromptState).toBe('exported');
});

it('dismisses the prompt without blocking retry/back actions', async () => {
  panel.handleDiagnosticDismiss();
  expect(panel.diagnosticPromptState).toBe('hidden');
});
```

- [ ] **Step 2: 运行测试，确认先失败**

Run:
```bash
npx vitest run tests/unit/file-selector-panel-diagnostic-feedback.test.ts
```

Expected:
- FAIL，提示导出 handler、download helper、prompt state 尚未实现。

- [ ] **Step 3: 实现 content 侧导出与反馈 helper**

Implementation notes:
- `src/utils/diagnostic-download.ts` 提供：
  - `downloadDiagnosticPayload(payload): Promise<string>`
  - `buildGitHubIssueUrl(snapshot, fileName): string`
  - `buildMailtoUrl(snapshot, fileName): string`
  - `buildFeedbackCopyText(snapshot, fileName): string`
- 下载使用 Blob + object URL + hidden anchor 点击。
- **不要**修改 `manifest.json` 增加 `downloads` 权限。

```ts
const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
const url = URL.createObjectURL(blob);
```

- [ ] **Step 4: 把 helper 接到 `FileSelectorPanel` 事件流**

Implementation notes:
- 在模板绑定中新增事件：
  - `@diagnostic-export`
  - `@diagnostic-dismiss`
  - `@diagnostic-feedback-github`
  - `@diagnostic-feedback-email`
  - `@diagnostic-copy`
- `handleDiagnosticExport()`：
  - 切 `ready -> exporting`
  - `chrome.runtime.sendMessage({ type: 'GET_DIAGNOSTIC_EXPORT' })`
  - 调用 Blob 下载 helper
  - 成功后切 `exported`
  - 失败时切 `error`
- GitHub / 邮件动作统一走 background `OPEN_EXTERNAL_URL`，避免 content 直接处理新标签页细节。
- 复制说明优先 `navigator.clipboard.writeText`，失败时回退到临时 textarea。

- [ ] **Step 5: 复跑聚焦测试**

Run:
```bash
npx vitest run tests/unit/file-selector-panel-diagnostic-feedback.test.ts tests/unit/config-panel-diagnostic-feedback.test.ts tests/unit/file-selector-panel-undo.test.ts
```

Expected:
- PASS。
- `重试 / 返回 / 撤销` 仍可正常工作。

- [ ] **Step 6: 提交本任务**

```bash
git add src/utils/diagnostic-download.ts src/content/components/file-selector-panel.ts src/content/components/config-panel.ts tests/unit/file-selector-panel-diagnostic-feedback.test.ts
git commit -m "feat: wire diagnostic export and feedback actions"
```

---

### Task 6: 更新文档并做最终验证

**Files:**
- Modify: `README.md`
- Modify: `docs/store-assets/PRIVACY_POLICY.md`
- Modify: `docs/testing/manual-test-cases.md`

- [ ] **Step 1: 先补文档改动**

Documentation checklist:
- README 的“问题反馈 / 故障排查”章节补充：
  - 失败后可直接导出诊断文件
  - GitHub / 邮件两种反馈方式
- 隐私政策补充：
  - 诊断文件只在用户主动点击导出时生成
  - 文件可能包含真实文件名
  - 诊断文件不会自动上传
- 手动测试文档增加 smoke case：
  - 失败后显示内联提示条
  - 导出成功后出现引导条
  - GitHub / 邮件 / 复制说明 / 暂不处理均可工作

- [ ] **Step 2: 运行针对性单测集合**

Run:
```bash
npx vitest run \
  tests/unit/logger.test.ts \
  tests/unit/diagnostic-log-store.test.ts \
  tests/unit/diagnostic-service.test.ts \
  tests/unit/diagnostic-session.test.ts \
  tests/unit/config-panel-diagnostic-feedback.test.ts \
  tests/unit/file-selector-panel-diagnostic-feedback.test.ts \
  tests/unit/config-panel-undo.test.ts \
  tests/unit/file-selector-panel-undo.test.ts \
  tests/unit/storage.test.ts
```

Expected:
- PASS。

- [ ] **Step 3: 跑静态校验**

Run:
```bash
npm run lint
npm run typecheck
```

Expected:
- 两个命令都通过，无新增 lint / type 错误。

- [ ] **Step 4: 跑完整 CI 测试**

Run:
```bash
npm run test:ci
```

Expected:
- PASS。
- 如已有不稳定用例，先记录，再决定是否单独修复后继续。

- [ ] **Step 5: 做手动 smoke 验证**

Manual checklist:
1. 在支持平台制造一个失败结果。
2. 确认结果区显示内联提示条，而不是 modal / toast。
3. 点击 `导出诊断`，确认下载 JSON 文件。
4. 确认原地切换为引导条。
5. 点击 `去 GitHub 反馈`，确认打开 Issues 页面并带模板。
6. 点击 `邮件反馈`，确认打开邮件客户端并带模板。
7. 点击 `复制说明`，确认剪贴板内容正确。
8. 点击 `暂不处理`，确认提示条隐藏，但 `重试 / 返回` 仍可用。

- [ ] **Step 6: 提交本任务**

```bash
git add README.md docs/store-assets/PRIVACY_POLICY.md docs/testing/manual-test-cases.md
git commit -m "docs: explain diagnostic export workflow"
```

---

## Notes for the Implementer
- 优先做 MVP，避免把 popup 历史导出、脱敏导出、诊断历史页一起塞进同一轮实现。
- 所有日志 transport 都必须“吞掉自己的异常”，绝不能让导出链路影响重命名主流程。
- UI 视觉等级要压低：提示条是辅助信息，不是主 CTA；不要破坏 `retry/back/undo` 的现有布局平衡。
- 若 `chrome.runtime.sendMessage` 在特定上下文失败，允许降级：导出提示进入 `error`，而不是抛未捕获异常。
- 做完每个任务都先跑对应测试，再提交，不要攒一个大提交。
