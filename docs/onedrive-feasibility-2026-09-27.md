# OneDrive 扩展支持可行性调研

调研日期：2026-09-27。范围：当前仓库源码、微软官方资料、用户已登录的 OneDrive 个人版网页。仅执行页面检查和读取元数据的请求，没有重命名、上传、删除云端文件。

## 结论

**可以扩展，建议先支持 OneDrive 个人版“我的文件”中的普通文件。** 现有平台接口、规则引擎、预览、执行器和撤销框架能够复用。工作量主要集中在 OneDrive 专用适配、目录/文件身份、分页、命名规则和异常处理，属于中等复杂度接入，不是只添加域名。

浏览器实测已确认：当前个人版网页会话能够读取同源 SharePoint 风格 API，且能获取请求摘要。这支持优先验证“沿用网页登录态”的接入路线。**尚未验证重命名写入，因此结论是架构与读取链路可行，不能视为完整适配验收通过。** 企业/学校版没有登录样本，本次不承诺兼容。

## 浏览器实测证据

通过 one-mcp-codex 提供的 Chrome MCP 在现有 `https://onedrive.live.com/my` 标签页操作。输出仅保留字段名、类型、计数、状态码；本文不保存账户标识、真实文件名、Cookie 或请求摘要。

| 验证项 | 结果 | 能说明什么 |
| --- | --- | --- |
| 登录页面 | 可以看到“我的文件”列表 | 有可用于个人版验证的真实会话 |
| 行结构 | `role="row"`、`aria-selected`、`data-selection-index` | 需要 OneDrive 专用选中项解析；索引不能当稳定文件 ID |
| 页面上下文 | 存在 `_spPageContextInfo`，包含站点、列表上下文字段 | 有目录定位的数据来源，仍需验证 SPA 切换后的更新方式 |
| 原生列表资源 | `/personal/{account}/_api/web/GetListUsingPath(DecodedUrl=@a1)/RenderListDataAsStream` | 当前样本使用 SharePoint 风格接口，不能套用旧网页接口假设 |
| 同源 `GET .../GetListUsingPath(...)/items` | HTTP 200，返回 `value`、`odata.nextLink` | 当前会话可直接读取列表元数据，无需先接入独立 Graph OAuth |
| `items` 翻页 | `$top=2`；第一页、nextLink 第二页均 HTTP 200，各 2 项，ID 不重叠 | 基本续页链路验证成功；不代表大目录和所有目录视图已验证 |
| 同源 `POST .../_api/contextinfo` | HTTP 200，存在摘要，返回有效期 1800 秒 | 请求摘要获取可行；1800 是本次响应值，实现时应读取返回值 |
| 携带摘要调用 `RenderListDataAsStream` | HTTP 200，返回 9 行 | 原生列表读取链路可复用，包含文件大小、修改时间、父目录、权限等字段 |
| 重命名、撤销、UI 同步 | 未执行 | 开发阶段需要测试文件验证 |

`items` 已验证字段：`Id` / `ID`、`UniqueId`、`FileLeafRef`、`FileRef`、`FSObjType`。`RenderListDataAsStream` 还返回 `FileDirRef`、`ParentUniqueId`、`Modified`、`File_x0020_Size`、`PermMask` 等。两种响应的字段和类型不同，不能混用，例如列表 ID 在一个响应中是数字，在另一个响应中是字符串。

两个需要保留的验证边界：

- 原生列表请求中的 `RowLimit=2` 没有按预期限制为 2 项；不能把这份请求直接作为生产分页实现。
- 扩充 `items` 字段并添加目录过滤的组合请求返回 HTTP 400，未单独定位到具体字段或过滤条件。恢复已验证字段后分页成功。**当前目录精确过滤和子目录导航仍待验证**；不能把整个文档库列表当作当前目录。

## 项目为什么能够接入

当前源码支持 12 个平台。关键位置如下，历史规划文件中“仅支持 3 个平台”的描述已过时。

| 代码位置 | 接入用途 |
| --- | --- |
| `src/types/platform.ts` | 增加 `onedrive` 平台，复用 `FileItem` / `RenameResult` / `PlatformAdapter` |
| `src/adapters/base/adapter.interface.ts` | 实现获取文件、重命名、目录作用域、冲突检查、文件详情 |
| `src/adapters/shared/page-script.ts` 与 `page-script-injector.ts` | 复用 MAIN world 与 content script 通信方式，但需处理摘要和结构化错误 |
| `src/content/index.ts` | 注册适配器，复用悬浮按钮和文件选择面板 |
| `src/content/components/file-selector-panel.ts` | 目前直接通过 `getAllFiles()` 加载文件，首版可继续使用扩展内勾选 |
| `src/core/executor.ts`、`last-rename-operation.ts` | 复用执行进度、暂停/取消、退避与撤销记录 |
| `manifest.json`、`vite.config.ts` | 增加页面匹配、必要权限、page-script 构建入口及资源匹配 |
| `src/utils/platform-detector.ts`、`src/background/service-worker.ts` | 平台检测及后台消息广播支持 |
| `src/core/diagnostic-session.ts`、`src/locales/*.json` | 平台显示名与诊断文案 |

不建议直接照搬 `SharedCloudDriveAdapter` 的默认 DOM 读取。其复选框、文件 ID 和名称选择器与本次 OneDrive 样本不匹配；默认 `getFileInfo` 也依赖可见 DOM，不适合分页、滚动后撤销等场景。

## 两条接入路线

| 路线 | 优势 | 代价与限制 | 建议 |
| --- | --- | --- | --- |
| 网页会话 + 同源 API | 符合项目现有体验；读取和摘要已有实测依据；无需新增独立授权入口 | 个人版网站内部契约可能变化；还需验证写入接口、目录定位与页面同步 | 先用个人版完成小规模验证，再实现 MVP |
| Microsoft Graph + 独立 OAuth | 官方文件 API；个人与工作/学校账户有明确权限模型 | 需要应用注册、授权回调、令牌生命周期和账户匹配；组织策略可能影响同意；网页选中项仍需适配 | 适合后续长期维护和企业版扩展 |

Graph 提供以下官方能力：

```http
GET /v1.0/drives/{drive-id}/items/{folder-id}/children
GET /v1.0/drives/{drive-id}/items/{item-id}
PATCH /v1.0/drives/{drive-id}/items/{item-id}
Content-Type: application/json

{ "name": "new-name.ext" }
```

重命名所需的最低委托权限为 `Files.ReadWrite`，个人及工作/学校账户均支持；`If-Match` 可检测并发修改。读取子项必须跟随 `@odata.nextLink`。[更新文件文档](https://learn.microsoft.com/en-us/graph/api/driveitem-update?view=graph-rest-1.0)、[列举子项文档](https://learn.microsoft.com/en-us/graph/api/driveitem-list-children?view=graph-rest-1.0)。

Graph 路线需要自己的授权流程；网页登录状态和请求摘要并不等于 Graph Bearer token。可采用授权码 + PKCE，扩展内不能放客户端密钥。[微软授权流程文档](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow)。

网页会话路线的写入接口应以测试文件的原生重命名请求为最终依据。SharePoint 官方文档提供列表项更新以及通过 `FileLeafRef` 修改名称的相关机制，但**不能据此直接认定当前个人版支持完全相同的写入契约**。[列表及列表项 REST](https://learn.microsoft.com/en-us/sharepoint/dev/sp-add-ins/working-with-lists-and-list-items-with-rest)、[文件夹及文件 REST](https://learn.microsoft.com/en-us/sharepoint/dev/sp-add-ins/working-with-folders-and-files-with-rest)。

## 需要解决的具体问题

1. **稳定身份与目录隔离。** 保留站点/列表或 drive 的命名空间；`Id`、`UniqueId`、Graph `item-id` 不应互换。建议适配器内部维护原始元数据映射，`getCurrentDirectoryKey()` 包含账户/站点、列表/drive、目录身份，避免切换账户或目录后错误撤销。
2. **目录和分页。** 精确限定当前目录并遍历续页；排除目录、保管库和不适用的特殊项目。冲突检查仍需考虑同目录文件夹占用的名称。不能仅提取屏幕可见行。
3. **命名与冲突。** 现有验证仅检查非法字符，批内冲突按原始字符串比较。需增加首尾空格、保留名、名称/路径长度等校验，并验证大小写碰撞及仅改变大小写的重命名。微软列出了 `CON`、`NUL`、`desktop.ini` 等限制。[命名限制](https://support.microsoft.com/en-us/onedrive/restrictions-and-limitations-in-onedrive-and-sharepoint)。
4. **摘要和会话过期。** 网页路线按有效期更新摘要，区分未登录、无权限和摘要失效；请求限定为预期站点/路径，不把凭据放进诊断日志。
5. **错误与限流。** 当前共享桥接丢弃响应头和部分错误结构。增加 HTTP 状态、服务错误码、`Retry-After` 的传递；现有自适应间隔不等于遵守服务器指定等待时间。Graph 的批请求最多 20 个子请求，且各子请求仍会被限流，首版无需为了批量重命名引入 `$batch`。[限流](https://learn.microsoft.com/en-us/graph/throttling)、[批请求](https://learn.microsoft.com/en-us/graph/json-batching)。
6. **撤销与页面同步。** 重命名后按稳定 ID 重新读取状态；撤销前确认目标文件仍处于预期位置和名称。优先真实刷新列表数据，不能仅修改 DOM 文本就当作完成同步。

## 建议的首版范围与开发顺序

首版支持个人版“我的文件”普通目录中的文件：读取全部分页、扩展面板勾选、规则预览、执行、失败提示、撤销。共享页面、快捷方式/远程项目、保管库、相册/搜索/最近视图、企业/学校版与世纪互联版暂不列入已支持范围。

1. **补齐技术验证。** 用专用测试文件确认原生重命名接口、改名后稳定 ID、改回原名、子目录和分页；获得这些结果后确定网页会话传输实现。
2. **实现适配器。** 新增 `src/adapters/onedrive/adapter.ts`、`page-script.ts`、`page-script-injector.ts`，完成平台注册、权限及构建接线。首版优先扩展内勾选，网页原生选中项联动再单独验证。
3. **补足平台语义。** 完成名称限制、结构化异常、目录作用域、元数据刷新、撤销；保持其他平台原有行为。
4. **验证。** 覆盖空目录、多页、特殊字符、同名/大小写碰撞、登录/摘要过期、403/409/412/429、部分失败、目录切换和撤销。运行相关单测、typecheck、lint、build，并在实际加载的扩展中验证注入和 MAIN world 请求。

此次没有改动业务源码或运行构建测试；浏览器控制台请求成功不等同于已验证打包后扩展的注入、权限与 CSP 行为。
