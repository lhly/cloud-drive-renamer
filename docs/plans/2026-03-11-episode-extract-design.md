# 剧集提取规则设计（P1）

## 背景
当前规则体系缺少“从文件名提取季集号并标准化命名”的能力。用户希望支持模板化命名，并在提取失败时可视化失败项且自动跳过执行。

## 目标
- 新增 `episodeExtract` 规则类型
- 支持模板变量：`{prefix}` `{season}` `{episode}` `{ext}`
- 提取失败文件：预览标红 + 执行跳过

## 非目标
- 不实现复杂表达式/条件模板
- 不做自动 season 猜测
- 不改动执行器核心模型

## 参数设计
- `template: string`
- `prefix: string`
- `season?: number | string`（默认1）
- `offset?: number | string`（默认0）
- `leadingZeroCount?: number`（默认3, 1~10）
- `helperPre?: string`
- `helperPost?: string`

## 提取策略
优先级：
1. helper 锚点提取
2. `SxxExx` / `Season x Episode x`
3. `EPxx`
4. 通用数字兜底

## 生成策略
- `season` 输出两位（01~99）
- `episode` 应用 offset 后按前导零补齐
- 模板渲染后，如果模板未包含 `{ext}`，自动补原扩展名

## 失败策略
- 当某文件无法提取 episode 或 offset 后无效：
  - 保持原名
  - 记录错误信息到 `extractErrorMap`
  - 预览展示红色错误
  - 执行阶段由于“未变化”被自动跳过

## 接入点
- `src/types/rule.ts`
- `src/rules/episode-extract.ts`
- `src/rules/rule-factory.ts`
- `src/content/components/config-panel.ts`
- `src/content/components/file-selector-panel.ts`
- `src/locales/*`

## 风险与缓解
- 风险：规则参数输入不完整导致预览异常
  - 缓解：沿用现有 `Invalid rule configuration` 分支，参数未就绪时不生成预览
- 风险：提取失败导致用户误解“未执行”
  - 缓解：红色错误态 + 明确错误文案

## 验证
- `tests/unit/episode-extract-rule.test.ts`
- `tests/unit/rules.test.ts`
- `npm test -- --run`
- `npm run typecheck`
