# 隐私政策 / Privacy Policy

**最后更新日期 / Last Updated**: 2025年12月16日 / December 16, 2025

**版本 / Version**: 1.0

---

## 中文版本

### 简介

云盘批量重命名工具（以下简称"本扩展"）致力于保护用户隐私。本隐私政策说明了我们如何处理与本扩展相关的信息。

### 核心原则

**我们不收集、不存储、不传输任何用户数据。**

本扩展的所有操作均在您的浏览器本地完成，不会与任何外部服务器通信。

### 信息收集

#### 我们不收集的信息

本扩展**不会收集**以下任何信息：

- ❌ 个人身份信息（姓名、邮箱、电话等）
- ❌ 云盘账号信息
- ❌ 文件名或文件内容
- ❌ 浏览历史或使用习惯
- ❌ IP地址或设备信息
- ❌ 任何其他个人数据

#### 本地存储的数据

为了提供功能，本扩展会在您的浏览器本地存储以下数据：

1. **重命名规则配置**
   - 存储位置：浏览器本地存储（chrome.storage.local）
   - 存储内容：您设置的重命名规则参数
   - 用途：保存您的配置以便下次使用
   - 控制权：您可以随时清除浏览器数据来删除

2. **任务状态信息**
   - 存储位置：浏览器本地存储（chrome.storage.local）
   - 存储内容：批量重命名任务的执行状态
   - 用途：支持崩溃恢复功能
   - 控制权：任务完成后自动清除，或您可以手动清除

**重要说明**：这些数据仅存储在您的浏览器中，永远不会离开您的设备。

### 权限说明

本扩展请求以下权限，并说明其用途：

#### 1. storage（存储权限）

- **用途**：在浏览器本地存储重命名规则配置和任务状态
- **范围**：仅限浏览器本地存储
- **数据流向**：数据不会离开您的设备

#### 2. tabs（标签页权限）

- **用途**：识别当前标签页的URL，判断您是否在支持的云盘网站
- **范围**：仅读取当前标签页的URL
- **限制**：不会访问标签页内容或其他敏感信息

#### 3. 网站访问权限（Host Permissions）

本扩展请求访问以下网站的权限：

- `https://pan.quark.cn/*` - 夸克网盘
- `https://www.aliyundrive.com/*` - 阿里云盘
- `https://pan.baidu.com/*` - 百度网盘

**用途**：
- 在这些网站的页面中注入重命名工具的用户界面
- 调用这些网站的API来执行重命名操作
- 检测文件选择状态

**限制**：
- 不会访问您的文件内容
- 不会读取您的账号信息
- 仅在您主动使用重命名功能时才会调用API

### 数据安全

#### 本地处理

所有重命名操作在您的浏览器本地完成：

1. 您选择要重命名的文件
2. 您配置重命名规则
3. 扩展在本地生成新文件名
4. 扩展调用云盘API执行重命名
5. 所有过程不经过任何第三方服务器

#### 不使用的技术

本扩展**不使用**以下任何技术：

- ❌ Cookies（除云盘网站本身的cookies外）
- ❌ 网络分析工具（如Google Analytics）
- ❌ 用户追踪技术
- ❌ 广告服务
- ❌ 第三方数据收集服务

### 第三方服务

本扩展**不使用任何第三方服务**，不会与任何外部服务器通信。

唯一的网络请求是直接调用云盘网站的官方API，这些请求：

- 仅用于执行重命名操作
- 直接发送到云盘网站服务器
- 不经过任何中间服务器
- 遵循云盘网站的隐私政策

### 开源透明

本扩展是完全开源的项目：

- **源代码**：https://github.com/lhly/cloud-drive-renamer
- **许可协议**：MIT License
- **审计**：任何人都可以审查代码，验证我们的隐私承诺

### 儿童隐私

本扩展不专门面向13岁以下的儿童，也不会有意收集儿童的个人信息。由于我们不收集任何用户数据，因此不存在儿童隐私问题。

### 您的权利

由于我们不收集任何用户数据，您拥有完全的控制权：

- ✅ **查看数据**：您可以在浏览器的开发者工具中查看本地存储的配置
- ✅ **删除数据**：您可以通过清除浏览器数据删除所有本地存储
- ✅ **停止使用**：您可以随时卸载本扩展，所有数据将被清除
- ✅ **数据可携带**：您可以导出您的配置（功能计划中）

### 政策变更

如果我们对隐私政策进行重大更改，我们会：

1. 更新本文档的"最后更新日期"
2. 在GitHub仓库中发布变更说明
3. 在扩展更新时通知用户（如有重大变更）

### 联系我们

如果您对本隐私政策有任何疑问或建议，请通过以下方式联系我们：

- **邮箱**：lhlyzh@qq.com
- **GitHub Issues**：https://github.com/lhly/cloud-drive-renamer/issues
- **项目主页**：https://github.com/lhly/cloud-drive-renamer

---

## English Version

### Introduction

CloudDrive Renamer ("the Extension") is committed to protecting user privacy. This Privacy Policy explains how we handle information related to the Extension.

### Core Principles

**We do not collect, store, or transmit any user data.**

All operations of the Extension are performed locally in your browser and do not communicate with any external servers.

### Information Collection

#### Information We Do Not Collect

The Extension **does not collect** any of the following information:

- ❌ Personal identification information (name, email, phone, etc.)
- ❌ Cloud drive account information
- ❌ File names or file contents
- ❌ Browsing history or usage habits
- ❌ IP addresses or device information
- ❌ Any other personal data

#### Locally Stored Data

To provide functionality, the Extension stores the following data locally in your browser:

1. **Rename Rule Configuration**
   - Storage Location: Browser local storage (chrome.storage.local)
   - Stored Content: Rename rule parameters you set
   - Purpose: Save your configuration for next use
   - Control: You can clear browser data anytime to delete

2. **Task Status Information**
   - Storage Location: Browser local storage (chrome.storage.local)
   - Stored Content: Execution status of batch rename tasks
   - Purpose: Support crash recovery functionality
   - Control: Automatically cleared after task completion, or you can manually clear

**Important Note**: This data is only stored in your browser and never leaves your device.

### Permissions Explanation

The Extension requests the following permissions and explains their purposes:

#### 1. storage (Storage Permission)

- **Purpose**: Store rename rule configuration and task status locally in browser
- **Scope**: Limited to browser local storage only
- **Data Flow**: Data never leaves your device

#### 2. tabs (Tabs Permission)

- **Purpose**: Identify current tab URL to determine if you're on a supported cloud drive website
- **Scope**: Only reads current tab's URL
- **Limitation**: Does not access tab content or other sensitive information

#### 3. Host Permissions

The Extension requests access to the following websites:

- `https://pan.quark.cn/*` - Quark Drive
- `https://www.aliyundrive.com/*` - Aliyun Drive (planned support)
- `https://pan.baidu.com/*` - Baidu Cloud Drive (planned support)

**Purpose**:
- Inject rename tool user interface into these website pages
- Call these websites' APIs to perform rename operations
- Detect file selection status

**Limitations**:
- Does not access your file contents
- Does not read your account information
- Only calls APIs when you actively use the rename functionality

### Data Security

#### Local Processing

All rename operations are completed locally in your browser:

1. You select files to rename
2. You configure rename rules
3. Extension generates new file names locally
4. Extension calls cloud drive API to perform rename
5. Entire process does not go through any third-party servers

#### Technologies Not Used

The Extension **does not use** any of the following technologies:

- ❌ Cookies (except cloud drive websites' own cookies)
- ❌ Web analytics tools (such as Google Analytics)
- ❌ User tracking technologies
- ❌ Advertising services
- ❌ Third-party data collection services

### Third-Party Services

The Extension **does not use any third-party services** and does not communicate with any external servers.

The only network requests are direct calls to cloud drive websites' official APIs. These requests:

- Only used to perform rename operations
- Sent directly to cloud drive website servers
- Do not go through any intermediate servers
- Follow the cloud drive websites' privacy policies

### Open Source Transparency

The Extension is a fully open-source project:

- **Source Code**: https://github.com/lhly/cloud-drive-renamer
- **License**: MIT License
- **Audit**: Anyone can review the code to verify our privacy commitments

### Children's Privacy

The Extension is not specifically directed at children under 13 and does not intentionally collect personal information from children. Since we do not collect any user data, there are no children's privacy concerns.

### Your Rights

Since we do not collect any user data, you have complete control:

- ✅ **View Data**: You can view locally stored configuration in browser developer tools
- ✅ **Delete Data**: You can delete all local storage by clearing browser data
- ✅ **Stop Using**: You can uninstall the Extension anytime, all data will be cleared
- ✅ **Data Portability**: You can export your configuration (feature planned)

### Policy Changes

If we make significant changes to the Privacy Policy, we will:

1. Update the "Last Updated" date in this document
2. Publish change notes in the GitHub repository
3. Notify users during extension updates (if significant changes)

### Contact Us

If you have any questions or suggestions about this Privacy Policy, please contact us through:

- **Email**: lhlyzh@qq.com
- **GitHub Issues**: https://github.com/lhly/cloud-drive-renamer/issues
- **Project Homepage**: https://github.com/lhly/cloud-drive-renamer

---

## 版本历史 / Version History

### v1.0 (2025-12-16)
- 初始版本发布 / Initial version release
