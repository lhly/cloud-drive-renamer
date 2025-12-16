# Microsoft Edge Add-ons 商店资料

## 基本信息

### 扩展名称
- **中文**: 云盘批量重命名工具
- **英文**: CloudDrive Renamer

### 简短描述 (不超过150字符)
- **中文**: 强大的批量重命名工具，支持夸克网盘文件批量重命名（阿里云盘和百度网盘开发中）
- **英文**: Powerful batch renaming tool for Quark Drive (Aliyun Drive and Baidu Cloud Drive support coming soon)

### 完整描述

#### 中文版本
```
一款强大的云盘文件批量重命名工具，专为提升文件管理效率而设计。

✨ 核心特性

🎯 多平台支持
• 夸克网盘 - 完全支持，可立即使用
• 阿里云盘 - 开发中
• 百度网盘 - 开发中

🔧 五大重命名规则
1. 替换规则 - 批量替换文件名中的特定文本，支持大小写敏感和全局替换
2. 前缀规则 - 为所有文件添加统一前缀，可自定义分隔符
3. 后缀规则 - 为文件名（扩展名之前）添加后缀标记
4. 编号规则 - 自动为文件添加序号，支持自定义格式和起始编号
5. 清理规则 - 清除文件名中的非法字符或特定字符集

🚀 智能执行引擎
• 批量处理系统 - 800ms间隔执行，防止API限流
• 重试机制 - 指数退避算法，自动重试失败操作
• 崩溃恢复 - 异常中断后可继续未完成的任务
• 幂等性保证 - 避免重复执行相同操作

📋 实用功能
• 实时预览 - 应用规则前预览所有变更，清晰对比原名称与新名称
• 冲突检测 - 自动检测重名冲突，智能提示潜在问题
• 规则组合 - 多个规则可以叠加应用，灵活满足各种需求
• 所见即所得 - 即时调整规则参数，立即查看效果

🔒 隐私保护承诺
• 100% 本地处理 - 所有重命名操作在浏览器本地完成
• 无数据上传 - 不收集、不传输任何用户数据
• 透明操作 - 开源代码，完全可审计
• 安全可靠 - 不会访问您的文件内容，仅修改文件名

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

🛠️ 技术架构
• TypeScript 5.3+ - 类型安全的开发体验
• Lit 3.1+ - 轻量级Web Components框架
• Vite 5.0+ - 极速构建工具
• 适配器模式 - 易于扩展新平台支持

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
• Quark Drive - Fully supported and ready to use
• Aliyun Drive - Under development
• Baidu Cloud Drive - Under development

🔧 Five Powerful Renaming Rules
1. Replace - Batch replace specific text with case-sensitive and global options
2. Prefix - Add uniform prefix to all files with customizable separator
3. Suffix - Add suffix markers before file extension
4. Numbering - Auto-add sequence numbers with custom format and start number
5. Sanitize - Remove illegal or specific character sets from filenames

🚀 Smart Execution Engine
• Batch Processing - 800ms interval execution to prevent API throttling
• Retry Mechanism - Exponential backoff algorithm for failed operations
• Crash Recovery - Resume unfinished tasks after interruption
• Idempotency - Prevent duplicate operations

📋 Practical Features
• Real-time Preview - Preview all changes before applying, clear comparison
• Conflict Detection - Auto-detect naming conflicts with smart alerts
• Rule Combination - Stack multiple rules for flexible requirements
• WYSIWYG - Instant parameter adjustment with immediate preview

🔒 Privacy Protection Promise
• 100% Local Processing - All operations completed locally in browser
• No Data Upload - No collection or transmission of user data
• Transparent Operation - Open-source code, fully auditable
• Safe and Reliable - Never access file content, only modify names

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

🛠️ Technical Architecture
• TypeScript 5.3+ - Type-safe development experience
• Lit 3.1+ - Lightweight Web Components framework
• Vite 5.0+ - Lightning-fast build tool
• Adapter Pattern - Easy to extend for new platforms

📖 Open Source Project
This project is open-sourced under MIT License, hosted on GitHub.
Contributions, suggestions, and issue reports are welcome.

Project Homepage: https://github.com/lhly/cloud-drive-renamer
```

## 分类信息

### 主要分类
- **Category**: Productivity (生产力工具)

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
| https://pan.quark.cn/* | 夸克网盘 | 在夸克网盘页面注入重命名工具界面和调用API |
| https://www.aliyundrive.com/* | 阿里云盘 | 为未来的阿里云盘支持预留权限 |
| https://pan.baidu.com/* | 百度网盘 | 为未来的百度网盘支持预留权限 |

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

所有操作均在您的浏览器本地完成，数据完全由您掌控。
```

## 隐私政策

详细隐私政策请参见: `store-assets/PRIVACY_POLICY.md`

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
- **当前版本**: 0.1.0
- **更新日期**: 2025年

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
