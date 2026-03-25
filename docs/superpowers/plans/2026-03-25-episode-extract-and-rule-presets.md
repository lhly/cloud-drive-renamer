# 剧集提取交互增强与规则预设 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 `episodeExtract` 增加样本/整段回填/片段回填/失败快捷修正交互，并新增“最近使用 + 命名模板”规则预设系统。

**Architecture:** 保持现有三栏结构不变，由 `file-selector-panel` 作为统一状态源，协调 `config-panel`、`preview-panel` 与新增加的预设存储工具层。规则预设通过 `storage` 持久化，剧集提取辅助通过新增状态对象和组件事件流串联。

**Tech Stack:** TypeScript、Lit Web Components、Vitest、chrome.storage/localStorage fallback

---

## 文件结构与职责

### 新增文件
- `src/types/rule-preset.ts` — 规则预设与剧集提取辅助状态类型定义
- `src/utils/rule-presets.ts` — 最近使用/模板的读写、去重、摘要、覆盖策略
- `tests/unit/rule-presets.test.ts` — 预设工具层单测

### 修改文件
- `src/content/components/config-panel.ts` — 增加剧集提取辅助区、最近使用区、模板区与事件派发
- `src/content/components/preview-panel.ts` — 增加 episodeExtract 下的整段回填、片段回填、失败快捷修正事件
- `src/content/components/file-selector-panel.ts` — 统一管理辅助状态、预设状态、预设加载/应用/记录逻辑
- `src/types/file-selector.ts` — 如有必要，扩展 `PreviewItem` 或新增事件类型定义
- `src/locales/zh_CN.json` / `src/locales/zh_TW.json` / `src/locales/en.json` — 新增文案
- `tests/unit/config-panel-*.test.ts` / `tests/unit/file-selector-panel-*.test.ts` / 可能新增 `tests/unit/preview-panel-*.test.ts` — 组件与集成测试

---

### Task 1: 定义预设与辅助状态类型

**Files:**
- Create: `src/types/rule-preset.ts`
- Modify: `src/types/file-selector.ts`
- Test: `tests/unit/rule-presets.test.ts`

- [ ] **Step 1: 写失败测试，约束数据结构与默认值预期**

在 `tests/unit/rule-presets.test.ts` 添加最小测试，覆盖：
- 可以接受 `RuleConfig`
- `EpisodeExtractAssistState` 默认目标为 `prefix`
- `fillMode` 默认值为 `full-name`

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/unit/rule-presets.test.ts`
Expected: FAIL，提示模块不存在或导出缺失。

- [ ] **Step 3: 新增类型文件并补充必要导出**

实现：
- `RulePresetRecord`
- `RulePresetSource`
- `EpisodeExtractFillTarget`
- `EpisodeExtractFillMode`
- `EpisodeExtractAssistState`
- 如需要，在 `src/types/file-selector.ts` 增加预览辅助相关事件 detail 类型

- [ ] **Step 4: 重新运行测试确认通过**

Run: `npx vitest run tests/unit/rule-presets.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/types/rule-preset.ts src/types/file-selector.ts tests/unit/rule-presets.test.ts
git commit -m "feat: add rule preset and extract assist types"
```

### Task 2: 实现规则预设工具层

**Files:**
- Create: `src/utils/rule-presets.ts`
- Test: `tests/unit/rule-presets.test.ts`
- Reference: `src/utils/storage.ts`, `src/types/rule.ts`

- [ ] **Step 1: 扩展失败测试，覆盖预设工具行为**

在 `tests/unit/rule-presets.test.ts` 增加测试：
- 保存 recent 时自动去重并置顶
- recent 超过 8 条会截断
- 保存 template 需要名称
- 同名 template 可被覆盖
- 失效配置不会通过应用前校验
- 生成摘要字符串可用

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/unit/rule-presets.test.ts`
Expected: FAIL，提示函数未实现。

- [ ] **Step 3: 实现 `src/utils/rule-presets.ts`**

至少提供这些函数：
- `getRecentRulePresets()`
- `recordRecentRulePreset(config)`
- `getTemplateRulePresets()`
- `saveTemplateRulePreset(name, config, options?)`
- `deleteTemplateRulePreset(id)`
- `buildRulePresetSummary(config)`
- `isRulePresetConfigValid(config)`

实现要求：
- 通过 `storage` 持久化
- recent 去重 + 截断
- template 支持同名查重/覆盖
- 所有读取失败回退为空数组

- [ ] **Step 4: 运行工具层测试确认通过**

Run: `npx vitest run tests/unit/rule-presets.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/utils/rule-presets.ts tests/unit/rule-presets.test.ts
git commit -m "feat: add rule preset storage utilities"
```

### Task 3: 为 `config-panel` 增加规则预设 UI

**Files:**
- Modify: `src/content/components/config-panel.ts`
- Test: `tests/unit/config-panel-rule-presets.test.ts`
- Reference: `tests/unit/config-panel-undo.test.ts`

- [ ] **Step 1: 写失败测试，覆盖模板区与最近使用区渲染/事件**

新增 `tests/unit/config-panel-rule-presets.test.ts`，覆盖：
- 面板接收到 recent/templates 属性时正确渲染列表
- 点击“应用”会派发 `apply-rule-preset` 事件
- 点击“保存当前规则为模板”会派发 `save-rule-template` 事件
- 点击“删除模板”会派发 `delete-rule-template` 事件

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/unit/config-panel-rule-presets.test.ts`
Expected: FAIL，找不到新增 DOM 或事件。

- [ ] **Step 3: 在 `config-panel.ts` 接入预设 UI 和属性**

增加属性：
- `recentRulePresets`
- `templateRulePresets`

增加 UI：
- 最近使用区
- 我的模板区
- 轻量保存模板入口（内嵌输入或 prompt 风格）

新增事件：
- `apply-rule-preset`
- `save-rule-template`
- `delete-rule-template`

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run tests/unit/config-panel-rule-presets.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/content/components/config-panel.ts tests/unit/config-panel-rule-presets.test.ts
git commit -m "feat: add config panel rule preset UI"
```

### Task 4: 为 `config-panel` 增加剧集提取辅助区

**Files:**
- Modify: `src/content/components/config-panel.ts`
- Test: `tests/unit/config-panel-episode-assist.test.ts`

- [ ] **Step 1: 写失败测试，覆盖 episodeExtract 下辅助区行为**

新增 `tests/unit/config-panel-episode-assist.test.ts`，覆盖：
- 仅在 `episodeExtract` 规则下显示辅助区
- 显示样本文件名和失败数量
- 切换 `fillTarget` 派发事件
- 切换 `fillMode` 派发事件
- 点击“随机样本 / 首个失败项 / 清空样本”派发事件

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/unit/config-panel-episode-assist.test.ts`
Expected: FAIL

- [ ] **Step 3: 在 `config-panel.ts` 实现辅助区**

增加属性：
- `episodeExtractAssistState`
- `episodeExtractFailureCount`

增加事件：
- `episode-assist-change-target`
- `episode-assist-change-mode`
- `episode-assist-use-random-sample`
- `episode-assist-use-first-failure`
- `episode-assist-clear-sample`

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run tests/unit/config-panel-episode-assist.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/content/components/config-panel.ts tests/unit/config-panel-episode-assist.test.ts
git commit -m "feat: add episode extract assist controls"
```

### Task 5: 为 `preview-panel` 增加辅助交互入口

**Files:**
- Modify: `src/content/components/preview-panel.ts`
- Test: `tests/unit/preview-panel-episode-assist.test.ts`
- Reference: `src/types/file-selector.ts`

- [ ] **Step 1: 写失败测试，覆盖整段回填、片段回填和失败快捷动作**

新增 `tests/unit/preview-panel-episode-assist.test.ts`，覆盖：
- 仅在 episodeExtract + assist enabled 下显示辅助交互
- 点击整段回填按钮派发事件
- 片段点击派发事件
- 失败项显示“设为样本 / 取前半段为 prefix / 进入片段选择”动作

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/unit/preview-panel-episode-assist.test.ts`
Expected: FAIL

- [ ] **Step 3: 修改 `preview-panel.ts` 实现辅助 UI**

新增属性建议：
- `episodeExtractAssistEnabled`
- `episodeExtractAssistState`

新增事件建议：
- `episode-assist-apply-full-name`
- `episode-assist-apply-segment`
- `episode-assist-use-item-as-sample`
- `episode-assist-use-prefix-from-item`
- `episode-assist-focus-segment-mode`

实现要求：
- 片段级点击，不做字符级选择
- 不影响非 `episodeExtract` 模式

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run tests/unit/preview-panel-episode-assist.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/content/components/preview-panel.ts tests/unit/preview-panel-episode-assist.test.ts
git commit -m "feat: add preview panel episode assist actions"
```

### Task 6: 在 `file-selector-panel` 中接线预设与辅助状态

**Files:**
- Modify: `src/content/components/file-selector-panel.ts`
- Test: `tests/unit/file-selector-panel-rule-presets.test.ts`
- Test: `tests/unit/file-selector-panel-episode-assist.test.ts`
- Reference: `tests/unit/file-selector-panel-conflict.test.ts`, `tests/unit/file-selector-panel-undo.test.ts`

- [ ] **Step 1: 写失败测试，覆盖接线与状态更新**

新增测试覆盖：
- 打开面板时加载 recent/templates
- 应用模板会更新 `ruleConfig` 并刷新预览
- 保存模板/删除模板会同步更新列表
- `episodeExtract` 辅助事件会更新 `ruleConfig.params`
- 使用随机样本/首个失败项会更新辅助状态
- 执行成功后 recent 自动记录

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/unit/file-selector-panel-rule-presets.test.ts tests/unit/file-selector-panel-episode-assist.test.ts`
Expected: FAIL

- [ ] **Step 3: 在 `file-selector-panel.ts` 增加统一状态与事件处理**

实现内容：
- 管理 `EpisodeExtractAssistState`
- 加载 / 应用 / 保存 / 删除规则预设
- 根据辅助事件更新 `ruleConfig.params`
- 将 recent/templates 和 assist state 传给 `config-panel` / `preview-panel`
- 在执行成功后调用 `recordRecentRulePreset`

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run tests/unit/file-selector-panel-rule-presets.test.ts tests/unit/file-selector-panel-episode-assist.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/content/components/file-selector-panel.ts tests/unit/file-selector-panel-rule-presets.test.ts tests/unit/file-selector-panel-episode-assist.test.ts
git commit -m "feat: connect episode assist and rule presets"
```

### Task 7: 补齐 i18n 文案与回归验证

**Files:**
- Modify: `src/locales/zh_CN.json`
- Modify: `src/locales/zh_TW.json`
- Modify: `src/locales/en.json`
- Test: 复用上述组件测试

- [ ] **Step 1: 增加失败测试或更新现有测试的文案断言**

若已有测试依赖 `I18nService.t(...)` 输出，补充必要断言；否则至少确保新增 key 被组件引用后测试不抛错。

- [ ] **Step 2: 更新三份 locale 文案**

新增：
- 辅助区标题与按钮
- 最近使用 / 我的模板 / 保存模板 / 删除模板 / 覆盖提示
- 失败项快捷修正文案

- [ ] **Step 3: 运行定向测试**

Run: `npx vitest run tests/unit/rule-presets.test.ts tests/unit/config-panel-rule-presets.test.ts tests/unit/config-panel-episode-assist.test.ts tests/unit/preview-panel-episode-assist.test.ts tests/unit/file-selector-panel-rule-presets.test.ts tests/unit/file-selector-panel-episode-assist.test.ts`
Expected: PASS

- [ ] **Step 4: 运行全量验证**

Run:
```bash
npx vitest run
npm run lint
npm run typecheck
```
Expected:
- Vitest 全绿
- lint 无新增 error（warning 可单独评估）
- typecheck 通过

- [ ] **Step 5: 提交**

```bash
git add src/locales/zh_CN.json src/locales/zh_TW.json src/locales/en.json
git add .
git commit -m "feat: add episode extract assist and rule presets"
```

---

## 风险提示
- `config-panel.ts` 和 `file-selector-panel.ts` 已较大，若新增逻辑明显膨胀，优先提取纯函数/工具模块，避免继续把状态判断堆进组件。
- 片段选择请保持“片段级点击”，不要演变成复杂的字符级框选。
- recent 自动记录必须放在“成功执行后”，不要在输入阶段记录。
- 模板应用前必须经过规则有效性校验，避免旧模板拖垮当前面板。
