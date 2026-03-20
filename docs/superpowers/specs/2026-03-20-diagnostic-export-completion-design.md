# 失败诊断导出补完设计

## 背景

`main` 当前只包含诊断日志 ring buffer 的底层能力：
- `src/background/diagnostic-log-store.ts`
- `src/types/diagnostic.ts`

用户可见链路尚未接通，因此即使批量重命名发生失败，界面也不会出现“导出诊断”入口，更不会生成可下载的 JSON 文件。

## 目标

补完一个最小可手测的失败诊断导出闭环：
- 批量执行结束且 `failed > 0` 时，在结果区显示内联诊断提示条
- 用户点击后下载 JSON 诊断文件
- 下载成功后，原地切换为 GitHub / 邮件 / 复制说明 / 暂不处理四个动作
- 不增加 `downloads` 权限

## 非目标

- 不做 popup 诊断中心
- 不做历史失败列表
- 不自动上传诊断数据
- 不导出 Cookie、Token、Authorization Header 等敏感信息

## 交互设计

### 触发时机

仅在以下条件同时满足时显示诊断提示条：
- 批量执行已结束
- 本次结果存在失败项

若全部成功，则不显示诊断入口。

### 提示条状态

使用 5 个显式 UI 状态：
- `hidden`
- `ready`
- `exporting`
- `exported`
- `error`

状态流如下：

`hidden -> ready -> exporting -> exported`

若导出失败，则：

`ready -> exporting -> error`

用户点击“暂不处理”后回到 `hidden`。

### 结果区文案

`ready`：
> 有 N 个文件重命名失败，可导出诊断文件发给开发者排查

动作：
- `导出诊断`
- `暂不处理`

`exported`：
> 诊断文件已下载到浏览器默认下载位置。如果你愿意反馈问题，可以选择一种方式发送给开发者。

动作：
- `去 GitHub 反馈`
- `邮件反馈`
- `复制说明`
- `暂不处理`

`error`：
> 诊断文件生成失败，请稍后重试

动作：
- `重试导出`
- `暂不处理`

## 数据设计

### 最近日志

继续使用现有 `DiagnosticLogStore`，仅保留最近 300 条结构化日志。

### 最近失败快照

在 `FileSelectorPanel` 里，当执行完成且 `failed > 0` 时，基于当前 `BatchResults` 和执行上下文构造最近失败快照，并存入 `chrome.storage.local` 的 `DIAGNOSTIC_STORAGE_KEYS.LAST_FAILURE`。

快照最小字段：
- `failure`
  - `id`
  - `occurredAt`
  - `reason`
  - `message`
- `summary`
  - `platform`
  - `startedAt`
  - `finishedAt`
  - `total`
  - `success`
  - `failed`
  - `retried`
- `failures`
  - `fileId`
  - `originalName`
  - `targetName`
  - `errorMessage`
  - `attempt`
- `recentLogs`
  - 导出时由 background 动态读取并拼入，不在 content 侧重复缓存

## 架构设计

### 1. `logger.ts`

保留现有 console 输出形式，同时增加可配置的 diagnostic transport：
- `configureLoggerDiagnostics({ source, transport })`

transport 的职责：
- 将 `level/message/context` 归一化为结构化日志
- 尝试从 `[FileSelectorPanel]` 这类前缀提取 `module`
- fire-and-forget 发送到 background
- 任何 transport 异常都不得影响现有执行链路

### 2. `service-worker.ts` + `diagnostic-service.ts`

background 负责两件事：
- 接收 `APPEND_DIAGNOSTIC_LOG`，写入 ring buffer
- 响应 `GET_DIAGNOSTIC_EXPORT`，读取最近失败快照 + 最近日志，组装导出 payload

额外提供 `OPEN_EXTERNAL_URL`，统一处理 GitHub / `mailto:` 打开动作。

### 3. `diagnostic-session.ts`

新增纯函数模块，负责：
- 从 `BatchResults` 构造最近失败快照
- 在 retry 后更新 `retried` 统计
- 构造“复制说明”文本摘要

这一层只做数据变换，不依赖 DOM。

### 4. `FileSelectorPanel`

作为诊断状态源，新增：
- 诊断提示状态
- 最近失败快照引用
- 导出文件名 / 导出错误文案

职责：
- 在执行或 retry 完成后，根据结果更新诊断状态
- 保存最近失败快照
- 处理导出、复制、外链动作
- 将只读状态和事件透传给 `ConfigPanel`

### 5. `ConfigPanel`

仍保持“纯展示 + 抛事件”模式，不直接读写 storage。

职责：
- 在 `renderExecutionView()` 里渲染诊断提示条
- 根据诊断状态切换按钮与文案
- 通过自定义事件把用户动作抛给父组件

## 下载与反馈

下载使用 Blob + `URL.createObjectURL()`，文件名格式：

`cloud-drive-renamer-diagnostic-YYYY-MM-DD-HHmm.json`

导出成功后支持：
- GitHub Issue 新建页
- `mailto:`
- 复制说明

复制说明至少包含：
- 平台
- 扩展版本
- 失败数量
- 导出时间
- 文件名

## 成功标准

- 失败结果页能出现导出入口
- 点击后能下载 JSON 文件
- JSON 至少包含 summary / failures / logs
- 下载后能切到反馈引导状态
- 对应单元测试与集成验证全部通过
