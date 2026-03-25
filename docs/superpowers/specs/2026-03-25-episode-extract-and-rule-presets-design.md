# 剧集提取交互增强与规则预设设计

## 背景
当前项目已经具备完善的规则系统、批量执行器、冲突处理、Undo、诊断导出与多语言 UI，但在“剧集提取”规则的人机交互上仍偏参数驱动，缺少从真实文件名反向辅助配置的快捷路径。同时，规则能力虽然丰富，用户却缺少“最近使用”和“命名模板”来沉淀高频配置，导致重复输入成本较高。

本设计聚焦两个 P0 优化项：
1. 剧集提取交互增强（B 档）
2. 最近使用 + 命名模板（B 档）

## 目标
- 让 `episodeExtract` 从“手动填参数”升级为“可从预览文件名反向辅助配置”。
- 为高频规则提供“自动进入最近使用 + 手动保存模板”的闭环。
- 保持现有三栏布局不变，优先复用 `file-selector-panel` 作为统一状态源。
- 控制实现范围，不在本次引入复杂的样本推导算法或大型 UI 重构。

## 非目标
- 不做完整的“样本推导规则生成器”。
- 不做字符级自由框选；片段选择只做到 token / 片段级点击。
- 不做模板导入导出、模板分类、跨平台共享策略。
- 不重做整个三栏面板结构。

## 方案概览
保持当前三栏结构：
- 左栏 `config-panel`：参数输入、提取辅助区、最近使用、命名模板
- 中栏 `file-list-panel`：文件筛选与勾选，不做主要改动
- 右栏 `preview-panel`：预览 + 交互式辅助取值入口

统一状态继续放在 `file-selector-panel`，由它协调：
- 当前规则配置 `ruleConfig`
- 新增 `EpisodeExtractAssistState`
- 新增规则预设状态（最近使用 / 模板）
- `config-panel` 与 `preview-panel` 只负责展示和派发事件

## 一、剧集提取交互增强

### 1. 提取辅助区
只在 `selectedRuleType === 'episodeExtract'` 时展示。

建议放在 `config-panel` 的剧集提取表单下方，包含三块内容：

#### 1.1 样本文件
展示当前样本文件名，并提供按钮：
- 使用随机样本
- 使用首个失败项
- 清空样本

样本文件只用于辅助用户观察与回填，不直接改变 `EpisodeExtractRule` 的算法输入。

#### 1.2 回填目标
使用单选或 segmented control 选择当前回填目标：
- `prefix`
- `helperPre`
- `helperPost`

该目标决定右栏点击行为把内容写入哪个字段。

#### 1.3 辅助模式
提供两种辅助模式：
- 点击整段文件名回填
- 选择文件名片段回填

辅助模式不改变规则类型，仅改变右栏交互方式。

### 2. 右栏预览增强
在 `episodeExtract` 模式下，`preview-panel` 支持辅助输入。

#### 2.1 整段回填模式
用户在左栏选定目标字段后，可在右栏对某个预览项执行“整段回填”。

默认回填规则：
- `prefix`：回填文件名主体（不含扩展名）
- `helperPre` / `helperPost`：回填选中的整段文本

#### 2.2 片段回填模式
右栏文件名支持按片段点击。片段粒度采用“有意义 token / 文本段”，不做字符级自由选区。

目标：
- 降低实现复杂度
- 支持典型命名场景，如 `剧名` / `S01E08` / `1080p` / `字幕组`

片段点击后，将片段文本写入当前 `fillTarget` 对应字段。

### 3. 失败项快捷修正
对于 `episodeExtract` 失败项，在右栏提供快捷动作：
- 设为样本
- 取前半段为 `prefix`
- 进入片段选择

这些动作不直接执行重命名，只帮助用户更快修正配置。

### 4. 更明显的失败提示
在左栏辅助区中，当存在提取失败项时显示状态块，包含：
- 当前失败数量
- 使用首个失败项作为样本
- 切换到片段选择模式
- 仅执行可成功项（说明性提示）

这部分的价值是把“你现在可以怎么修”明确告诉用户。

### 5. 新增状态模型
建议新增轻量状态：

```ts
interface EpisodeExtractAssistState {
  sampleFileId: string | null;
  sampleFileName: string | null;
  fillTarget: 'prefix' | 'helperPre' | 'helperPost';
  fillMode: 'full-name' | 'segment';
  suggestedFailureFileId: string | null;
}
```

状态存放在 `file-selector-panel` 中，由它通过属性传给 `config-panel` / `preview-panel`，并响应相关事件更新 `ruleConfig`。

## 二、规则预设（最近使用 + 命名模板）

### 1. 统一数据模型
建议使用统一记录结构：

```ts
interface RulePresetRecord {
  id: string;
  name?: string;
  config: RuleConfig;
  createdAt: number;
  updatedAt: number;
  source: 'recent' | 'template';
}
```

说明：
- `recent` 自动记录，可无名称
- `template` 必须有名称
- `config` 直接保存完整 `RuleConfig`

### 2. 存储策略
基于现有 `storage` 封装新增两组 key：
- `rulePresets.recent`
- `rulePresets.templates`

#### 2.1 最近使用
- 最多保留 8 条
- 执行成功且存在真实 rename task 时才记录
- 对相同配置做去重，重复使用时只更新时间并移动到最前

#### 2.2 命名模板
- 用户手动保存
- 支持删除
- 同名保存时提示用户确认覆盖
- 本次不做分类、导入导出

### 3. 左栏展示方式
在 `config-panel` 中新增“规则预设”区：

#### 3.1 最近使用
展示最近 5 条（可后续扩展为展开更多），每条显示：
- 规则类型
- 简短摘要
- 应用按钮

#### 3.2 我的模板
展示：
- 模板名
- 规则类型
- 应用
- 删除

并提供按钮：
- 保存当前规则为模板

本次保存交互采用轻量实现（如内嵌输入或简单 prompt 风格），避免引入重型弹窗设计。

### 4. 应用行为
点击应用最近使用或模板后：
1. 更新当前 `selectedRuleType`
2. 更新 `ruleParams`
3. 触发 `config-change`
4. 重建预览

如果应用的是 `episodeExtract` 规则：
- 重置 `fillTarget` 为默认 `prefix`
- 重置 `fillMode` 为默认 `full-name`
- 不保留旧的样本运行态上下文

### 5. 自动沉淀闭环
规则使用闭环如下：
1. 用户通过左栏配置 + 右栏辅助完成配置
2. 执行成功后自动进入“最近使用”
3. 用户可手动“保存为模板”
4. 后续直接从“最近使用”或“模板”重新应用

这是本次设计的核心产品价值之一。

## 三、错误处理

### 1. 模板存储失败
- 不阻塞主面板
- 给出轻提示或日志
- 模板/最近使用加载失败时回退为空列表

### 2. 交互辅助失败
例如：
- 未选择回填目标
- 样本文件失效
- 失败项上下文失效

处理方式：
- 回退到默认状态
- 给出轻提示说明下一步操作

### 3. 模板失效
若模板中的 `RuleConfig` 无法通过当前版本校验：
- 不应用模板
- 提示“模板已失效”
- 提供删除入口

## 四、测试策略

### 1. 工具层测试
新增 `rule-presets` 相关测试，覆盖：
- 最近使用追加
- 去重
- 截断数量
- 模板保存
- 模板删除
- 覆盖逻辑

### 2. `config-panel` 组件测试
覆盖：
- `episodeExtract` 时辅助区可见
- 最近使用 / 模板区可见
- 应用模板触发 `config-change`
- 保存模板、删除模板、切换辅助模式等事件派发正确

### 3. `file-selector-panel` 集成测试
覆盖：
- 应用模板后预览更新
- 辅助回填后 `ruleConfig` 更新
- 执行成功后自动记录最近使用
- 失败项快捷修正动作正确更新辅助状态

## 五、文件影响范围

### 修改文件
- `src/content/components/config-panel.ts`
- `src/content/components/preview-panel.ts`
- `src/content/components/file-selector-panel.ts`
- `src/locales/zh_CN.json`
- `src/locales/zh_TW.json`
- `src/locales/en.json`

### 新增文件
- `src/types/rule-preset.ts`
- `src/utils/rule-presets.ts`
- 对应测试文件

## 六、实施顺序
1. 先实现规则预设存储层与类型
2. 接入 `config-panel` 的最近使用 / 模板 UI
3. 在 `file-selector-panel` 中完成预设加载、应用、记录逻辑
4. 实现 `EpisodeExtractAssistState`
5. 接入 `config-panel` 的提取辅助区
6. 接入 `preview-panel` 的整段回填 / 片段回填 / 失败快捷修正
7. 补充测试并验证

## 七、风险与控制
- 风险：交互状态过多导致 `file-selector-panel` 继续膨胀
  - 控制：把预设逻辑抽到独立工具模块，把辅助状态收敛为单一对象
- 风险：片段选择实现过重
  - 控制：本次仅做 token / 文本段级点击，不做自由选区
- 风险：模板兼容性问题
  - 控制：应用前统一校验，失效即提示并允许删除

## 结论
本次实现将不改动总体架构，而是在现有三栏面板上增加两条高价值能力：
- 让 `episodeExtract` 能借助右栏真实文件名进行更自然的配置修正
- 让成功配置能够沉淀为“最近使用”和“命名模板”，形成复用闭环

这是一次以用户体验为中心、同时保持现有工程边界稳定的增强。