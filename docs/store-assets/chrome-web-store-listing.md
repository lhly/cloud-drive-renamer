# Chrome Web Store 商店资料

## 基本信息

### 扩展名称
- **中文**: 云盘批量重命名工具
- **英文**: CloudDrive Renamer

### 简短描述 (132字符以内)
- **中文**: 强大的批量重命名工具，支持夸克网盘、阿里云盘、百度网盘，并支持正则替换规则
- **英文**: Powerful batch renaming tool for Quark Drive, Aliyun Drive, and Baidu Cloud Drive with regex replace support

### 详细描述

#### 中文版本
```
一款强大的云盘文件批量重命名工具，专为提升文件管理效率而设计。

✨ 核心特性

🎯 多平台支持
• 夸克网盘 - 完全支持，可立即使用
• 阿里云盘 - 完全支持，可立即使用
• 百度网盘 - 完全支持，可立即使用

🔧 六大重命名规则
1. 替换规则 - 批量替换文件名中的特定文本
2. 正则替换规则 - 使用正则表达式批量替换文件名
3. 前缀规则 - 为所有文件添加统一前缀
4. 后缀规则 - 为文件名添加后缀标记
5. 编号规则 - 自动添加序号，支持自定义格式
6. 清理规则 - 清除非法字符或特定字符集

🚀 智能功能
• 实时预览 - 应用规则前预览所有变更
• 批量处理 - 智能速率控制，防止API限流
• 冲突检测 - 自动检测重名冲突
• 崩溃恢复 - 异常中断后可继续未完成的任务

🔒 隐私保护
• 100% 本地处理 - 所有操作在浏览器本地完成
• 无数据上传 - 不收集、不传输任何用户数据
• 完全开源 - 代码完全可审计

📝 使用场景
• 整理照片集 - 为旅行照片添加统一前缀和编号
• 清理文档命名 - 移除特殊字符并统一格式
• 版本管理 - 为项目文件添加版本后缀
• 批量规范化 - 统一修改文件命名规范

🛠️ 技术栈
• TypeScript 5.3+ - 类型安全开发
• Lit 3.1+ - 轻量级Web Components
• Vite 5.0+ - 快速构建工具

📖 开源项目
本项目基于MIT协议开源，欢迎贡献代码和提出建议。
```

#### 英文版本
```
A powerful batch renaming tool for cloud drives, designed to enhance file management efficiency.

✨ Core Features

🎯 Multi-Platform Support
• Quark Drive - Fully supported, ready to use
• Aliyun Drive - Fully supported, ready to use
• Baidu Cloud Drive - Fully supported, ready to use

🔧 Six Renaming Rules
1. Replace - Batch replace specific text in file names
2. Regex Replace - Use regular expressions to batch replace filenames
3. Prefix - Add uniform prefix to all files
4. Suffix - Add suffix markers to file names
5. Numbering - Auto-add sequence numbers with custom format
6. Sanitize - Remove illegal or specific characters

🚀 Smart Features
• Real-time Preview - Preview all changes before applying
• Batch Processing - Intelligent rate control to prevent API throttling
• Conflict Detection - Auto-detect naming conflicts
• Crash Recovery - Resume unfinished tasks after interruption

🔒 Privacy Protection
• 100% Local Processing - All operations completed locally in browser
• No Data Upload - No collection or transmission of user data
• Fully Open Source - Completely auditable code

📝 Use Cases
• Organize Photo Collections - Add uniform prefix and numbering to travel photos
• Clean Document Naming - Remove special characters and standardize format
• Version Management - Add version suffixes to project files
• Batch Standardization - Uniformly modify file naming conventions

🛠️ Tech Stack
• TypeScript 5.3+ - Type-safe development
• Lit 3.1+ - Lightweight Web Components
• Vite 5.0+ - Fast build tool

📖 Open Source Project
This project is open-sourced under MIT License. Contributions and suggestions are welcome.
```

## 分类信息

### 主要分类
- **Category**: Productivity (生产力工具)

### 次要分类
- **Secondary Categories**:
  - Tools (工具)
  - File Management (文件管理)

## 视觉资产

### 图标要求
- ✅ 已有: icons/icon128.png (128x128)
- 位置: `/public/icons/icon128.png`

### 截图要求
- **数量**: 最少1张，最多5张
- **尺寸**: 1280x800 或 640x400
- **格式**: PNG 或 JPEG
- ✅ 已有截图: `/screenshots/store/` 目录下的图片

### 宣传图片 (可选但推荐)
- **小型宣传图**: 440x280 (PNG/JPEG)
- **大型宣传图**: 920x680 (PNG/JPEG)
- **宣传图块**: 1400x560 (PNG/JPEG)

## 权限说明

### 需要的权限
1. **storage** - 保存用户的规则配置和崩溃恢复数据
2. **tabs** - 检测当前标签页URL以确定使用的云盘平台
3. **host_permissions** - 访问以下网站：
   - https://pan.quark.cn/* - 夸克网盘
   - https://www.aliyundrive.com/* - 阿里云盘
   - https://pan.baidu.com/* - 百度网盘

### 权限用途说明
```
本扩展需要以下权限以提供完整功能：

1. 存储权限 (storage):
   用于在浏览器本地保存您的重命名规则配置和任务状态，实现崩溃恢复功能。
   所有数据仅存储在您的浏览器中，不会上传到任何服务器。

2. 标签页权限 (tabs):
   用于识别您当前访问的云盘平台（夸克/阿里/百度），以加载对应的功能模块。
   不会读取或记录您访问的其他网站。

3. 网站访问权限:
   仅限于支持的云盘网站，用于注入重命名工具界面和调用云盘API。
   不会访问您的其他网站数据。
```

## 隐私政策

### 隐私政策要点
- 不收集任何个人信息
- 不追踪用户行为
- 不使用 cookies 或分析工具
- 所有数据本地存储和处理
- 不与第三方共享数据

详细隐私政策请参见: `docs/store-assets/PRIVACY_POLICY.md`

## 支持信息

### 支持邮箱
lhlyzh@qq.com

### 项目主页
https://github.com/lhly/cloud-drive-renamer

### 问题反馈
https://github.com/lhly/cloud-drive-renamer/issues

## 定价和分发

- **定价**: 免费
- **分发区域**: 全球
- **语言支持**: 中文简体、英文、中文繁体

## 提交检查清单

- [ ] 扩展名称符合规范（不超过45个字符）
- [ ] 简短描述清晰明了（不超过132个字符）
- [ ] 详细描述完整且吸引人
- [ ] 至少上传1张截图，最多5张
- [ ] 上传128x128的图标
- [ ] 选择正确的分类
- [ ] 提供隐私政策文档
- [ ] 权限说明清晰合理
- [ ] 测试扩展包可以正常安装和运行
- [ ] 邮箱地址有效且可接收邮件
