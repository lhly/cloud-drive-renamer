# Task Plan

## Goal
参考 `docs/renamer.js`（油猴脚本）分析当前项目在功能覆盖、交互体验、平台扩展与工程实现上的优化空间，并输出按优先级排序的建议。

## Phases
| Phase | Status | Notes |
| --- | --- | --- |
| 1. 读取规划/参考资料并校准任务目标 | complete | 已读取 `planning-with-files` 技能、现有 planning files、`README.md`、`docs/renamer.js`。 |
| 2. 梳理当前项目的核心能力与架构 | complete | 已确认当前项目支持 3 个平台、7 类规则（三大基础规则 + regex + numbering + sanitize + episodeExtract），并具备执行器、Undo、冲突处理、诊断导出、虚拟列表等工程化能力。 |
| 3. 对照油猴脚本识别能力差距/可优化点 | complete | 已完成差距分析，并与用户确认本次实现范围：剧集提取交互增强（B 档）+ 最近使用/命名模板（B 档）。 |
| 4. 汇总优化建议并按优先级输出 | complete | 已输出 P0/P1/P2 分层建议，并聚焦到本次要实现的两项优化。 |
| 5. 产出设计文档并等待用户确认书面 spec | complete | 设计 spec 与 implementation plan 已落盘，且用户已批准进入实现。 |

## Errors Encountered
| Error | Attempt | Resolution |
| --- | --- | --- |
| Serena `find_symbol` 指向旧项目路径 `/Users/lhly/WebstormProjects/panku` | 1 | 改用 `read_file` / `read_multiple_files` / `get_symbols_overview` 获取当前仓库证据，避免继续依赖错误路径。 |

## Implementation Follow-up
| Step | Status | Notes |
| --- | --- | --- |
| P0-2：剧集提取交互增强（B） | complete | 已实现样本回填、片段点选、失败项快捷修正、预览项回填接线。 |
| P0-3：规则模板 / 最近使用（B） | complete | 已实现 recent 自动记录、模板保存/删除、同名覆盖确认。 |
| 验证与回归 | complete | `typecheck` / `vitest` / `lint` 已跑通；lint 仅剩仓库历史 warning。 |
