# Microsoft Edge Add-ons 商店资料

## 基本信息

### 扩展名称
- **中文**: 云盘批量重命名工具
- **英文**: CloudDrive Renamer

### 简短描述 (不超过150字符)
- **中文**: 支持 OneDrive 个人版、百度、阿里、夸克等 13 个网盘平台，批量重命名文件，支持预览、冲突检查和撤销。
- **英文**: Batch rename files on 13 cloud drives, including OneDrive Personal, with previews, conflict checks, and undo.

### 完整描述

#### 中文版本
```
一款强大的云盘文件批量重命名工具，专为提升文件管理效率而设计。

✨ 核心特性

🎯 多平台支持
• OneDrive 个人版 - 支持“我的文件”普通目录中的文件批量重命名
• 115 网盘 - 支持文件批量重命名
• 123 云盘 - 支持文件批量重命名
• 阿里云盘 - 支持文件批量重命名
• 百度网盘 - 支持文件批量重命名
• 光鸭云盘 - 支持文件批量重命名
• 蓝奏云 - 支持文件批量重命名
• 移动云盘 - 支持文件批量重命名
• 天翼云盘 - 支持文件批量重命名
• 迅雷云盘 - 支持文件批量重命名
• 悟空网盘 - 支持文件批量重命名
• 夸克网盘 - 支持文件批量重命名
• UC 网盘 - 支持文件批量重命名

🔧 七类重命名规则
1. 替换规则 - 批量替换文件名中的特定文本，支持大小写敏感和全局替换
2. 正则替换规则 - 使用正则表达式批量替换文件名
3. 前缀规则 - 为所有文件添加统一前缀，可自定义分隔符
4. 后缀规则 - 为文件名（扩展名之前）添加后缀标记
5. 编号规则 - 自动为文件添加序号，支持自定义格式和起始编号
6. 清理规则 - 清除文件名中的非法字符或特定字符集
7. 剧集提取规则 - 提取剧集编号并统一命名，支持样本辅助配置

🚀 智能执行引擎
• 批量处理系统 - 按平台控制请求间隔，应对接口限流
• 重试机制 - 指数退避算法，自动重试失败操作
• 崩溃恢复 - 异常中断后可继续未完成的任务
• 撤销操作 - 撤销上一次批量重命名
• 命名模板 - 保存常用规则，快速复用最近使用的配置
• 幂等性保证 - 避免重复执行相同操作

📋 实用功能
• 实时预览 - 应用规则前预览所有变更，清晰对比原名称与新名称
• 冲突检测 - 自动检测重名冲突，智能提示潜在问题
• 规则组合 - 多个规则可以叠加应用，灵活满足各种需求
• 所见即所得 - 即时调整规则参数，立即查看效果

🔒 隐私保护承诺
• 本地生成预览 - 命名规则在浏览器中处理，确认执行后向对应网盘发送重命名请求
• 无开发者数据收集 - 不向开发者服务器上传文件名或文件内容
• 透明操作 - 开源代码，完全可审计
• 安全可靠 - 不会访问您的文件内容，仅修改文件名

📌 OneDrive 支持范围
仅支持个人版“我的文件”普通目录中的文件，不支持文件夹改名、企业/学校账户及共享、搜索、最近、照片、个人保管库、远程快捷方式等特殊视图。重命名后扩展内列表会更新，OneDrive 原网页列表需手动刷新。

📝 典型使用场景

1. 整理照片集
   为旅行照片添加统一前缀和编号
   IMG_001.jpg → Tokyo2025_001.jpg

2. 清理文档命名
   移除特殊字符并统一格式
   报告@2024#最终版.docx → 报告2024Final.docx

3. 版本管理
   为项目文件添加版本后缀
   design.psd → design_v2.psd

4. 批量规范化
   统一修改文件命名规范
   file-v1.txt → file-v2.txt

📖 开源项目
本项目基于MIT协议开源，源代码托管在GitHub。
欢迎贡献代码、提出建议或报告问题。

项目主页: https://github.com/lhly/cloud-drive-renamer
```

#### 英文版本
```
A powerful batch renaming tool for cloud drives, designed to enhance file management efficiency.

✨ Core Features

🎯 Multi-Platform Support
• OneDrive Personal - Batch rename files in regular folders under My files
• 115 Drive - Batch rename support
• 123Pan - Batch rename support
• Aliyun Drive - Batch rename support
• Baidu Cloud Drive - Batch rename support
• GuangyaPan - Batch rename support
• Lanzou Cloud - Batch rename support
• CMCC Drive - Batch rename support
• Esurfing Cloud - Batch rename support
• Xunlei Drive - Batch rename support
• WKBrowser Cloud - Batch rename support
• Quark Drive - Batch rename support
• UC Drive - Batch rename support

🔧 Seven Renaming Rules
1. Replace - Batch replace specific text with case-sensitive and global options
2. Regex Replace - Use regular expressions to batch replace filenames
3. Prefix - Add uniform prefix to all files with customizable separator
4. Suffix - Add suffix markers before file extension
5. Numbering - Auto-add sequence numbers with custom format and start number
6. Sanitize - Remove illegal or specific character sets from filenames
7. Episode Extraction - Extract episode numbers and standardize names with sample-assisted configuration

🚀 Smart Execution Engine
• Batch Processing - Platform-specific request pacing to handle API rate limits
• Retry Mechanism - Exponential backoff algorithm for failed operations
• Crash Recovery - Resume unfinished tasks after interruption
• Undo - Undo the last batch rename
• Rule Templates - Save reusable rules and access recently used configurations
• Idempotency - Prevent duplicate operations

📋 Practical Features
• Real-time Preview - Preview all changes before applying, clear comparison
• Conflict Detection - Auto-detect naming conflicts with smart alerts
• Rule Combination - Stack multiple rules for flexible requirements
• WYSIWYG - Instant parameter adjustment with immediate preview

🔒 Privacy Protection Promise
• Local Previews - Rules run in your browser; confirmed renames are sent to the corresponding cloud drive
• No Developer Data Collection - File names and contents are not uploaded to developer servers
• Transparent Operation - Open-source code, fully auditable
• Safe and Reliable - Never access file content, only modify names

📌 OneDrive Scope
Supports files in regular My files folders on personal accounts. Folder renaming, work/school accounts, shared/search/recent/photo views, Personal Vault, and remote shortcuts are not supported. Names update in the extension after renaming; refresh the OneDrive webpage to update its own file list.

📝 Typical Use Cases

1. Organize Photo Collections
   Add uniform prefix and numbering to travel photos
   IMG_001.jpg → Tokyo2025_001.jpg

2. Clean Document Naming
   Remove special characters and standardize format
   Report@2024#Final.docx → Report2024Final.docx

3. Version Management
   Add version suffixes to project files
   design.psd → design_v2.psd

4. Batch Standardization
   Uniformly modify file naming conventions
   file-v1.txt → file-v2.txt

📖 Open Source Project
This project is open-sourced under MIT License, hosted on GitHub.
Contributions, suggestions, and issue reports are welcome.

Project Homepage: https://github.com/lhly/cloud-drive-renamer
```

## 分类信息

### 主要分类
- **Category**: Productivity (生产力工具)

### 搜索关键词 (Search Terms)

Edge Add-ons允许添加搜索关键词以提高扩展的可发现性。

**推荐关键词（英文）**：
```
rename, batch rename, onedrive, cloud drive, file management, productivity, rename rules, local preview
```

**推荐关键词（中文）**：
```
重命名, 批量重命名, OneDrive, 云盘, 网盘, 文件管理, 批量操作, 重命名规则, 本地预览, 效率工具
```

**关键词策略说明**：
- 核心功能词：rename, batch rename, file rename（重命名、批量重命名）
- 平台相关：onedrive, cloud drive, 115 drive, 123pan, aliyun drive, baidu cloud, guangyapan, quark drive（云盘及主流网盘平台）
- 使用场景：file management, productivity（文件管理、效率）
- 操作类型：batch operations, bulk operations（批量操作）

**注意事项**：
- Edge限制关键词数量，建议选择5-10个最相关的
- 避免使用与功能无关的热门词汇
- 不要重复扩展名称中已有的词
- 关键词应该反映用户可能的搜索习惯

### 补充标签
- File Management
- Cloud Storage
- Batch Operations
- Productivity Tools

## 视觉资产要求

### 图标
- **尺寸**: 128x128 pixels (必需), 也推荐提供 256x256
- **格式**: PNG (透明背景推荐)
- ✅ 已有: `/public/icons/icon128.png`

### 截图
- **数量**: 至少1张，建议3-5张
- **尺寸**: 1366x768, 1280x800 或 640x400
- **格式**: PNG 或 JPEG
- **说明**: 每张截图应附带简短说明文字
- ✅ 已有: `/screenshots/store/` 目录下的图片

### 建议的截图说明文字

#### 中文
1. **cdr-01.png**: "直观的批量重命名界面 - 支持多种规则配置"
2. **cdr-02.png**: "实时预览功能 - 所见即所得的重命名效果"
3. **cdr-03.png**: "智能执行进度追踪 - 批量操作一目了然"

#### 英文
1. **cdr-01.png**: "Intuitive batch rename interface - Support multiple rule configurations"
2. **cdr-02.png**: "Real-time preview feature - WYSIWYG rename results"
3. **cdr-03.png**: "Smart execution progress tracking - Batch operations at a glance"

### 宣传视频 (可选)
- **时长**: 30秒 - 2分钟
- **格式**: YouTube 链接
- **内容**: 展示主要功能和使用流程

## 权限说明

### 需要的权限及说明

| 权限 | 用途 | 详细说明 |
|------|------|---------|
| storage | 存储配置 | 在浏览器本地保存用户的重命名规则配置和任务状态，不会上传到任何服务器 |
| tabs | 平台识别 | 识别当前访问的云盘平台，加载对应的功能模块，不读取其他网站数据 |
| https://onedrive.live.com/* | OneDrive 个人版 | 在“我的文件”页面注入界面，读取文件列表并调用同源 API 执行重命名 |
| https://115.com/* | 115 网盘 | 在 115 网盘页面注入重命名工具界面 |
| https://webapi.115.com/* | 115 网盘 API | 调用 115 网盘 API 执行文件列表读取和重命名 |
| https://yun.123pan.cn/* | 123 云盘 | 在 123 云盘页面注入界面并调用 API |
| https://www.aliyundrive.com/* | 阿里云盘 | 在阿里云盘页面注入重命名工具界面 |
| https://www.alipan.com/* | 阿里云盘 | 支持新版阿里云盘页面域名 |
| https://api.aliyundrive.com/* | 阿里云盘 API | 调用阿里云盘 API 执行重命名 |
| https://pan.baidu.com/* | 百度网盘 | 在百度网盘页面注入界面并调用 API |
| https://www.guangyapan.com/* | 光鸭云盘 | 在光鸭云盘页面注入重命名工具界面 |
| https://api.guangyapan.com/* | 光鸭云盘 API | 调用光鸭云盘 API 执行文件列表读取和重命名 |
| https://yun.139.com/* | 移动云盘 | 在移动云盘页面注入重命名工具界面 |
| https://personal-kd-njs.yun.139.com/* | 移动云盘 API | 调用移动云盘 API 执行文件列表读取和重命名 |
| https://cloud.189.cn/* | 天翼云盘 | 在天翼云盘页面注入界面并调用 API |
| https://pan.xunlei.com/* | 迅雷云盘 | 在迅雷云盘页面注入重命名工具界面 |
| https://api-pan.xunlei.com/* | 迅雷云盘 API | 调用迅雷云盘 API 执行文件列表读取和重命名 |
| https://pc.woozooo.com/* | 蓝奏云 | 在蓝奏云页面注入界面并调用 API |
| https://pan.wkbrowser.com/* | 悟空网盘 | 在悟空网盘页面注入重命名工具界面 |
| https://api.wkbrowser.com/* | 悟空网盘 API | 调用悟空网盘 API 执行文件列表读取和重命名 |
| https://pan.quark.cn/* | 夸克网盘 | 在夸克网盘页面注入界面并调用 API |
| https://drive.uc.cn/* | UC 网盘 | 在 UC 网盘页面注入重命名工具界面 |
| https://pan.uc.cn/* | UC 网盘 | 支持 UC 网盘备用页面域名 |
| https://pc-api.uc.cn/* | UC 网盘 API | 调用 UC 网盘 API 执行重命名 |

### 数据使用说明
```
本扩展完全尊重用户隐私：

✅ 我们会做的：
• 在您的浏览器本地存储您的规则配置
• 在支持的云盘页面提供重命名功能
• 调用云盘API执行重命名操作

❌ 我们不会做的：
• 收集您的个人信息
• 追踪您的浏览行为
• 上传您的文件名或任何数据到我们的服务器
• 访问您的其他网站数据
• 使用第三方分析服务

规则配置和预览在浏览器本地处理；执行重命名时，与您正在使用的网盘通信。
```

## 隐私政策

详细隐私政策请参见: `docs/store-assets/PRIVACY_POLICY.md`

隐私政策URL (发布后需要更新):
- https://github.com/lhly/cloud-drive-renamer/blob/main/PRIVACY_POLICY.md

## 支持信息

### 开发者信息
- **开发者**: CloudDrive Renamer Team
- **联系邮箱**: lhlyzh@qq.com

### 支持资源
- **项目主页**: https://github.com/lhly/cloud-drive-renamer
- **使用文档**: https://github.com/lhly/cloud-drive-renamer/blob/main/README.md
- **问题反馈**: https://github.com/lhly/cloud-drive-renamer/issues
- **功能建议**: https://github.com/lhly/cloud-drive-renamer/discussions

### 版本历史
- **待发布版本**: 2.0.1（以打包时 package.json 为准）
- **更新日期**: 2026年

## 定价和分发

- **定价模式**: 完全免费
- **许可协议**: MIT License
- **分发区域**: 全球所有市场
- **语言支持**:
  - 中文（简体）- zh_CN
  - English - en
  - 中文（繁體）- zh_TW

## 年龄分级

- **年龄限制**: 无限制（适合所有年龄）
- **内容评级**: E (Everyone)

## Edge Add-ons 特定要求

### Microsoft Partner Center账号
发布前需要注册Microsoft Partner Center账号：
https://partner.microsoft.com/dashboard

### 提交流程
1. 登录Partner Center
2. 选择"Office and SharePoint Add-ins"或直接访问Edge Add-ons
3. 点击"Create a new extension"
4. 上传扩展包(.zip文件)
5. 填写商店列表信息
6. 提交审核

### 审核时间
- 通常需要3-7个工作日
- 首次提交可能需要更长时间

## 提交检查清单

### 必需项目
- [ ] 扩展名称（不超过45个字符）
- [ ] 简短描述（不超过150个字符）
- [ ] 完整描述（详细且吸引人）
- [ ] 至少1张截图（建议3-5张）
- [ ] 128x128图标（PNG格式）
- [ ] 分类选择
- [ ] 隐私政策文档和URL
- [ ] 权限说明清晰
- [ ] 有效的支持邮箱

### 推荐项目
- [ ] 提供256x256高清图标
- [ ] 5张展示不同功能的截图
- [ ] 每张截图配有说明文字
- [ ] 宣传视频（可选）
- [ ] 详细的版本更新说明
- [ ] 完善的支持文档链接

### 技术检查
- [ ] 扩展可以正常安装到Edge浏览器
- [ ] 所有功能正常工作
- [ ] 没有控制台错误
- [ ] 兼容最新版本的Edge
- [ ] 扩展包文件结构正确
- [ ] manifest.json配置无误

## 注意事项

1. **Edge兼容性**:
   - Edge使用与Chrome相同的扩展架构
   - Manifest V3扩展可以直接兼容
   - 建议在Edge浏览器中测试所有功能

2. **品牌要求**:
   - 不要在名称中使用"Edge"或"Microsoft"
   - 图标设计要有辨识度
   - 避免使用可能引起混淆的名称

3. **审核标准**:
   - Edge审核相对Chrome更严格
   - 注重隐私和安全
   - 确保所有权限都有合理说明

4. **更新发布**:
   - 更新需要重新审核
   - 建议同步Chrome和Edge的版本号
   - 提供清晰的更新日志
