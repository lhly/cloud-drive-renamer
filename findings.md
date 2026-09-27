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
- 2026-03-25：继续完成“剧集提取失败态增强”：`suggestedFailureFileId` 现在真正用于右侧预览的失败项高亮与自动滚动定位，避免“点了首个失败项但用户还要自己找”的断层体验。
- 2026-03-25：为失败项增加内联引导文案 `episode_assist_focus_hint`，明确告诉用户可以直接点整段/片段继续修正，再次预览。
- 2026-03-25：已提交第三批改动 `2559ef1 feat: 增强剧集提取失败项定位与引导`，当前工作区已恢复干净，可继续下一批优化。
- 2026-03-25：已确认下一批范围为右侧预览区顶部失败导航（B1），仅做失败总数、当前序号、上一个/下一个失败项，不扩展到失败筛选或自动跳转。
- 2026-03-25：本批已完成右侧预览区失败导航条：显示失败总数、当前序号、上一个/下一个失败项，并通过 `episode-assist-focus-failure` 事件复用既有失败聚焦逻辑。
- 2026-03-25：额外补了一层 `scrollIntoView` 守卫，避免测试环境或部分宿主环境缺少该方法时抛出异常。
- 2026-03-25：本批验证结果：`npm run typecheck` 通过，`npx vitest run` 通过（36 files / 268 tests），`npm run lint` 通过但仍仅存在仓库历史 warning。
- 2026-03-25：已确认下一批做规则模板重命名：模板项直接提供“重命名”按钮，使用 `prompt` 输入新名称，仅支持 `template`，不支持 `recent`。
- 2026-03-25：本批已完成规则模板重命名：仅对 `template` 模板显示“重命名”按钮，使用 `prompt` 输入新名称，`recent` 不提供该入口。
- 2026-03-25：新增 `renameTemplateRulePreset` 存储层能力；普通改名不视为 replaced，只有真正覆盖其他同名模板时才标记为 replaced。
- 2026-03-25：本批验证结果：`npm run typecheck` 通过，`npx vitest run` 通过（36 files / 271 tests），`npm run lint` 通过但仍仅存在仓库历史 warning。

## OneDrive 调研（2026-09-27）
- 当前源码已有多个平台适配器；历史规划文件中的“仅 3 个平台”已过时，需以当前代码为准。
- Chrome MCP 可通过 one-mcp-codex 的 executor.py 调用，本次仅检查页面、接口和元数据，不修改云端文件。
- 源码确认当前支持 12 个平台；统一接口包含 getSelectedFiles/getAllFiles/renameFile/getCurrentDirectoryKey/checkNameConflict/getFileInfo，可选 syncAfterRename。
- Chrome MCP 已连接现有登录的 OneDrive 个人版 /my 页面。页面有 role=row、aria-selected、data-selection-index，没有现有通用适配器依赖的文件 ID 属性。实际列表请求为同源 /personal/{id}/_api/web/GetListUsingPath(DecodedUrl=@a1)/RenderListDataAsStream，不能假设仍是旧 api.onedrive.com 前端。
- 官方 Microsoft Graph 支持 GET children 与 PATCH driveItem.name，个人和工作/学校账户均可使用委托 Files.ReadWrite。Graph 能力与当前网页会话可否直接调用是两项独立结论。
- 读取不存在的 src/adapters/index.ts、src/utils/constants.ts 失败，已通过 rg 定位真实工厂 src/content/index.ts 与配置 src/config。
- 复用层的缺口：共享 page-script 会丢弃响应头；injector 只抛通用 Error，未保留结构化错误码和 Retry-After。执行器已有 429 自适应间隔，但尚不等于尊重服务器 Retry-After。
- 当前通用名称验证只处理 /\\:*?"<>|；批内冲突按大小写敏感字符串比较，需要针对 OneDrive 的命名约束补足。
- 更正：项目不存在 src/config 目录，注册散布于 content/index.ts、types/platform.ts、utils/platform-detector.ts、background/service-worker.ts、core/diagnostic-session.ts、locales 与 manifest/vite 配置。
- 实测成功：从页面原生列表 URL 派生 GET GetListUsingPath(...)/items，$top=2，HTTP 200；返回 value、odata.nextLink，字段包括 Id/ID、UniqueId、FileLeafRef、FileRef、FSObjType。未输出真实文件 ID 或文件名。
- 实测成功：POST 同源 /_api/contextinfo HTTP 200，有 FormDigestValue，超时值为 1800 秒（未输出摘要内容）。携带摘要调用原生 RenderListDataAsStream HTTP 200，返回 9 行和文件大小、修改时间、父目录、权限等字段。
- 此次 RenderListDataAsStream 请求指定 RowLimit=2 仍返回 9 行且无 NextHref，不能据此宣称分页参数正确；分页优先使用已返回 nextLink 的 items API，或进一步复现网页参数。
- 尚未执行任何重命名、上传或删除请求。当前实测只覆盖个人版单一账户；企业/学校、个人保管库、共享及大目录尚未验证。

- items 最小字段集的分页进一步验证成功：第一页和 nextLink 第二页均 HTTP 200，各 2 项且 ID 不重叠；组合字段/目录过滤请求 400 的原因尚未定位，不视为子目录验证通过。
- 最终建议：个人版普通文件优先沿用网页会话方案进行写入 POC；Graph OAuth 作为长期/企业版路线。详细证据、改动点、边界及验证清单见 docs/onedrive-feasibility-2026-09-27.md。

## OneDrive 实现协议补充
- 同源 v2.0 API 实测可用：`{webAbsoluteUrl}/_api/v2.0/drive/root/children?$top=2` 返回 HTTP 200，标准 DriveItem 结构与 @odata.nextLink；优先采用该接口，避免 SP list items 字段差异。
- `_spPageContextInfo.listUrl` 与原生列表 URL @a1 解码值一致。`GetFolderByServerRelativePath(decodedUrl=@p)/Files` 也返回 200，可作为取证依据，但不再作为首选实现。
- v2.0 GET root、文件单项、普通文件夹 children 均200；DriveItem ID 在当前个人版呈 hex!shex 形状，应始终作不透明字符串。
- 首次专用测试文件创建：v2.0 PUT content 携带有效 RequestDigest 仍403 accessDenied，未创建文件。读取成功不能推导写入鉴权相同，正在验证 SharePoint 写入或原生请求要求。
- 写入契约已实测：v2.0 PATCH `{name}` + RequestDigest + If-Match 返回403 accessDenied。SharePoint创建专用随机测试文件成功；GET GetFileById(guid)/ListItemAllFields（Accept verbose）取得 __metadata.type/etag 后，POST 同一URL + X-HTTP-Method:MERGE + If-Match + X-RequestDigest，body `{__metadata:{type},FileLeafRef:newName}` 返回204。随后按同一UniqueId读取确认新名称；测试文件用SP DELETE清理成功。实现应使用已确认SP写入，不能使用v2 PATCH。
- v2 children 显式选择 sharepointIds 后可得到 listItemUniqueId GUID，用于SP写入映射。
- 子目录原生路由已确认：pathname仍为 /my，query id 为 /personal/{account}/Documents/Apps（URLSearchParams解码后），另有viewid。listUrl仍根目录。v2 root:/Apps 可解析目录身份，200。原生行名是 span[role=button][data-id=heroField]，dblclick进入。
- 完整专用文件往返验证通过：SP创建→v2读取sharepointIds GUID匹配→SP重命名204→原v2 ID读取新名200→SP改回原名204→原v2 ID读取原名200→清理200。确认混合接口身份稳定和撤销基础能力。
- Luna实现的MAIN桥接首次真实代码烟测成功：将当前page-script.ts临时bundle后注入已登录子目录，postMessage directory返回200，folder/driveId与子目录状态正确。测试后导航回/my清除临时listener；不把该烟测等同于整个扩展端到端验收。
- 实际adapter首次完整写入烟测发现：SP ListItemAllFields默认响应不包含FileLeafRef/FileDirRef，因此新增并发校验拒绝执行。已只读验证增加 `$select=FileLeafRef,FileDirRef` 后200且字段、metadata.type/etag齐全，通知Luna修正。更正此前对默认返回字段的推断；该轮专用测试文件已清理200。

## OneDrive 实现验收结论
- 实际adapter与MAIN脚本在已登录个人版页面完成重命名和撤销，按原ID核验新名与恢复名；缓存改为新对象，执行器的原名记录不被污染。
- 实际打包扩展在独立Edge profile和完整模拟OneDrive API上完成分页列表、批量前缀改名及撤销，0页面异常；真实站点完整安装后界面验收未执行。
- 全量构建通过，48个测试文件/389项测试通过。个人版普通目录内文件为首版范围；不重命名目录，不支持企业/学校版或特殊视图。OneDrive原生列表改名后需要刷新，扩展内部结果正常更新。

## OneDrive 键盘隔离修复
- file-selector-panel直接挂载到document.body，使用Lit Shadow DOM，仅阻止click冒泡，未隔离keydown/keypress/keyup。工具栏Escape目前监听document，增加隔离时需调整作用域。
- 浏览器MCP的Runtime环境不提供getEventListeners；改为事件路径探针验证，避免依赖DevTools专属函数。首次浮动按钮查询未深入其嵌套shadow root，未打开面板；下一步按实际DOM定位。
- 真实OneDrive页面事件探针确认：面板内输入的keydown、keypress、keyup全部冒泡至window，网页侧看到target为FILE-SELECTOR-PANEL而非实际input。单次n输入未触发焦点变化，已确认事件泄漏，但未将其称为完整复现用户中断场景。
- 采用面板host冒泡边界拦截三类键盘事件，不调用preventDefault，保留输入默认行为及子组件事件。工具栏Escape改为面板ShadowRoot监听；捕获阶段在面板前触发的第三方监听不是此冒泡边界可拦截的范围。
- 新dist在隔离浏览器的完整扩展界面上通过真实按键回归：逐字输入、退格、修饰键全选、方向键、Tab切换、工具栏Escape；面板内没有按键传到模拟宿主document监听，关闭面板后网页按键正常。批量改名/撤销回归仍通过。
- 真实OneDrive页临时注入同样边界后，键盘探针未再泄漏；MCP chrome_keyboard不产生实际输入文字，chrome_computer key则插入文字但未观测到键盘事件，因此不将这两项工具的结果称为真实页面原生键盘端到端验收。未操作云端文件，临时探针全部清除。

## OneDrive 同步提示误报
- 截图9项重命名成功、0失败，面板内已显示新名称。适配器syncAfterRename没有发送刷新请求，固定返回success:false/method:none和英语手动刷新说明；通用面板将它当真实异常显示红框和无效“重新同步”。这是首版能力限制被错误编码为失败，并非改名请求失败或服务端同步接口报错。
- 计划增加明确manual-refresh结果/refresh-required展示状态，显示本地化中性提示，不提供无效重试；保留真正异常的失败状态，不伪报原生列表自动刷新成功。
- 修复后打包扩展验收确认普通刷新提示可见，红色同步失败和重试按钮均不存在；执行/撤销和键盘隔离仍通过。仅修正提示语义，未新增OneDrive原生列表自动刷新能力。

- 商店文案需要同步13个平台、7类规则、撤销及OneDrive范围。英语extDescription原有枚举较长，改为简短概述；本次更新仓库提交素材，未操作商店发布后台。
- 扩展商店manifest实际使用根目录_locales/*/messages.json，已与src/locales三语extDescription同步；简体56、繁体59、英文109字符。避免只更新UI文案而遗漏安装包简介。

- v2.0.1标签与main均为b9dab3b1bfe6926925f88c1f235343dfa0c577c0，工作区干净。package/manifest/runtime均为2.0.0；Release 397562950已有同名zip。需重新触发Release工作流替换旧包，不能只改标签展示。
