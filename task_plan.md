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
| 6. 清理根本未使用的代码 | complete | 已删除旧 Web Component、历史 cookie/message 模块、旧 batch rename e2e；extension-loading e2e 改为当前 Shadow DOM 浮动按钮入口；验证通过。 |

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
| 后续批次：继续优化剧集提取失败修正体验 | complete | 已完成右侧预览区顶部失败导航（B1）：失败总数 + 当前序号 + 上一个/下一个失败项，并完成验证。 |
| 后续批次：规则模板重命名 | complete | 已完成模板项“重命名”按钮 + prompt 输入，仅支持 template，不支持 recent，并完成验证。 |

## OneDrive 可行性调研（2026-09-27）
目标：检查现有架构与 OneDrive 接口，输出范围、方案、风险和验证结论；本次不实现适配器、不修改云端文件。
| 阶段 | 状态 |
| --- | --- |
| 1. 检查平台适配与执行链路 | complete |
| 2. 官方资料与浏览器只读验证 | complete |
| 3. 输出接入建议与调研文档 | complete |

调研工具错误：规划目录脚本直接运行出现 permission denied，改为 bash 调用成功；根目录既有规划文件已保留并追加本任务。

调研异常记录：旧 DOM ref 失效，改用刷新；网络捕获未取得可用解析记录，改用受控只读请求；若干预期文件路径不存在，使用 rg 定位；扩展字段/目录过滤组合返回 400，恢复成功字段后完成两页验证。详情见 progress.md。
产出：docs/onedrive-feasibility-2026-09-27.md；重命名写入属于后续开发验证，本次未执行。

## OneDrive 实现（2026-09-27，用户已授权 Luna 实现）
| 阶段 | 状态 |
| --- | --- |
| 4. 制定实施方案并派遣 Luna | complete |
| 5. 协议确认与适配器实现 | complete |
| 6. 审查、自动化验证、浏览器验收 | complete |
实施方案：docs/plans/2026-09-27-onedrive-implementation-plan.md。主代理唯一维护规划文件；Luna 修改代码和测试。

## OneDrive 输入被网站快捷键打断修复
| 阶段 | 状态 |
| --- | --- |
| 7. 检查事件传播并复现快捷键干扰 | complete |
| 8. 实现界面内键盘隔离并补充回归验证 | complete |
| 9. 构建与浏览器验收 | complete |

## OneDrive 同步提示误报修复
| 阶段 | 状态 |
| --- | --- |
| 10. 核对同步返回值及界面状态 | complete |
| 11. 区分手动刷新与同步异常并验证 | complete |

## 扩展商店文案更新
- [x] 定位Chrome/Edge商店文案与扩展简介
- [x] 更新OneDrive范围及现有功能描述
- [x] 校验文案、语言文件及构建产物

## v2.0.1 版本修正与重新发布
- [x] 核对远程main、标签和已发布资产（均来自b9dab3b，源码仍2.0.0）
- [x] 同步版本并构建验证，加入标签版本一致性检查
- [x] 重写最新提交并以精确lease推送main和v2.0.1
- [x] 确认远程代码及新发布包版本
