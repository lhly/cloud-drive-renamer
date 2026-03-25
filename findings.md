# Findings

- 2026-03-25：本次任务目标改为对照 `docs/renamer.js`（油猴脚本）评估当前扩展项目的优化空间，而不是继续 Task 5 验证。
- 2026-03-25：`docs/renamer.js` 支持的平台明显更多，至少覆盖 123 云盘、阿里/Alipan、百度、移动云盘、天翼云盘、夸克；当前项目 `manifest.json` 仅覆盖夸克、阿里/Alipan、百度，平台扩展仍有明显空间。
- 2026-03-25：当前项目并非“弱化版”，其工程化能力已经明显强于油猴脚本：`BatchExecutor` 支持并发/全局节流/自适应退避/暂停恢复取消；`file-selector-panel` 具备冲突对话框、诊断导出、失败重试、Undo、崩溃恢复、页面同步；UI 还有虚拟列表与多语言/外观模式。
- 2026-03-25：当前项目规则体系已覆盖 `replace`、`regex`、`prefix`、`suffix`、`numbering`、`sanitize`、`episodeExtract`，比油猴脚本更通用；但在“剧集提取”的易用性上，油猴脚本仍有若干可借鉴点，例如随机填充剧名、手动点选文件名片段辅助填充、提取失败时更强的交互式修正路径。
- 2026-03-25：油猴脚本存在在线版本检测（GreasyFork meta.js），当前扩展 README / popup 更偏设置与统计，缺少“发现新版本 / 快速跳转更新日志”的产品化反馈链路。
- 2026-03-25：油猴脚本通过 `FETCH_MODE`、URL 监听、定时探测容器等方式适配不同站点页面结构；当前扩展对三大平台做了更深的专用适配，但对“页面结构变化后的降级策略/注入策略抽象”还可以继续加强。
- 2026-03-25：已完成 P0-2 / P0-3 的 B 档实现接线：新增 `rule-preset` 类型与 `rule-presets` 存储工具，支持“最近使用自动记录 / 手动保存模板 / 删除模板 / 同名覆盖确认”。
- 2026-03-25：`config-panel` 已加入“规则模板与最近使用”区，以及“剧集提取辅助”区；`preview-panel` / `virtual-preview-list` 已支持从预览项整段回填、片段点选、失败项快捷修正动作。
- 2026-03-25：修复了模板工具层的一个潜在逻辑缺陷：同名模板在未显式开启覆盖时现在会抛出错误，避免 silent override；覆盖时只保留一个同名记录，顺序按 `updatedAt` 稳定排序。
- 2026-03-25：`config-panel` 将 `activeRuleConfig` 的同步逻辑从 `updated()` 调整到 `willUpdate()`，避免 Lit 在测试与运行时发出“update completed 后又触发 update”的低效更新警告。
- 2026-03-25：多语言文案已补齐到 `zh_CN` / `zh_TW` / `en`，并确认占位符必须使用 Chrome i18n 兼容的 `$1` 形式，不能写成 `{0}`。
- 2026-03-25：完整验证结果：`npm run typecheck` 通过，`npx vitest run` 通过（36 files / 263 tests）；`npm run lint` 通过但仓库内仍存在大量历史 warning，本次未扩散为新的 lint error。
