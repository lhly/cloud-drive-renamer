# 隐私政策 / Privacy Policy

**生效日期 / Effective Date**: 2025-01-15
**最后更新 / Last Updated**: 2025-01-15

---

## 中文版本

### 概述

CloudDrive Renamer（以下简称"本扩展"）尊重并保护用户的隐私。本隐私政策旨在说明本扩展如何收集、使用、存储和保护您的信息。

**重要声明**：本扩展是一款完全本地化的工具，**不会收集、上传或共享任何用户数据**。所有操作均在您的浏览器本地完成。

### 1. 信息收集

#### 1.1 我们不收集的信息

本扩展**不会收集**以下任何信息：
- ❌ 个人身份信息（姓名、邮箱、电话等）
- ❌ 云盘账号信息（用户名、密码、Token）
- ❌ 文件内容或文件名
- ❌ 浏览历史或访问记录
- ❌ IP 地址或设备信息
- ❌ 使用统计或分析数据
- ❌ 任何其他用户数据

#### 1.2 本地存储的数据

本扩展仅在您的浏览器本地存储以下配置数据，这些数据**永不离开您的设备**：

| 数据类型 | 存储位置 | 用途 | 是否上传 |
|---------|---------|------|---------|
| 重命名规则配置 | 浏览器本地存储 (chrome.storage.local) | 保存用户自定义的重命名规则偏好 | ❌ 否 |
| 崩溃恢复状态 | 浏览器本地存储 (chrome.storage.local) | 在任务中断后恢复执行进度 | ❌ 否 |

**存储位置说明**：
- 所有数据存储在浏览器的 `chrome.storage.local` API 中
- 数据完全位于您的设备上，不会同步到云端
- 您可以随时通过浏览器的扩展管理页面清除所有数据

### 2. 权限说明

本扩展需要以下权限，所有权限均用于本地功能实现，不涉及数据上传：

#### 2.1 storage（存储权限）
- **用途**：保存用户的重命名规则配置和崩溃恢复数据
- **范围**：仅限浏览器本地存储
- **数据去向**：数据永不离开您的设备

#### 2.2 tabs（标签页权限）
- **用途**：检测当前活动标签页是否为支持的云盘平台
- **范围**：仅读取当前标签页的 URL
- **数据去向**：不收集或存储任何标签页信息

#### 2.3 host_permissions（主机权限）
需要访问以下网站以注入功能界面：
- `https://pan.quark.cn/*` - 夸克网盘
- `https://www.aliyundrive.com/*` - 阿里云盘
- `https://pan.baidu.com/*` - 百度网盘

**权限限制**：
- 仅在上述网站激活扩展功能
- 不会访问其他任何网站
- 不会读取或上传网页内容

### 3. 数据使用

#### 3.1 文件重命名操作

当您使用本扩展重命名文件时：
1. ✅ 扩展在浏览器本地读取您选中的文件列表
2. ✅ 在本地应用您配置的重命名规则
3. ✅ 直接调用云盘平台的公开 API 执行重命名
4. ❌ **整个过程不会向任何第三方服务器发送数据**

#### 3.2 与云盘平台的交互

本扩展与云盘平台的交互方式：
- 使用浏览器中已有的登录凭证（Cookie）
- 直接调用云盘的官方 API
- 所有请求在您的浏览器和云盘服务器之间直接进行
- 扩展本身不截获、存储或转发任何请求

### 4. 数据安全

#### 4.1 本地安全措施
- 所有配置数据使用浏览器的安全存储机制
- 遵循 Chrome 扩展的沙箱隔离原则
- 使用 Manifest V3 的安全标准

#### 4.2 网络安全
- 本扩展不建立任何外部网络连接
- 不包含任何数据采集或分析代码
- 所有代码开源，完全可审计

### 5. 第三方服务

本扩展**不使用**任何第三方服务，包括但不限于：
- ❌ 不使用分析服务（如 Google Analytics）
- ❌ 不使用崩溃报告服务
- ❌ 不使用广告服务
- ❌ 不使用云存储服务
- ❌ 不包含任何第三方跟踪代码

### 6. 儿童隐私

本扩展不会主动收集任何用户的个人信息，因此也不会收集 13 岁以下儿童的信息。本扩展适合所有年龄段的用户使用。

### 7. 数据删除

#### 7.1 删除本地数据

如需删除本扩展存储的所有本地数据：
1. 打开 Chrome 浏览器
2. 访问 `chrome://extensions/`
3. 找到 CloudDrive Renamer 扩展
4. 点击"删除"或"移除"按钮
5. 所有本地数据将被永久删除

#### 7.2 清除特定数据

如需仅清除配置数据而保留扩展：
1. 在扩展的设置页面中
2. 使用"重置配置"功能
3. 或直接在浏览器的"清除浏览数据"中选择"扩展数据"

### 8. 隐私政策变更

如果本隐私政策发生变更：
- 我们会在扩展更新说明中明确告知
- 更新后的政策将在本页面公布
- 我们会更新"最后更新"日期
- 对于重大变更，会通过扩展界面进行通知

### 9. 开源与透明

本扩展完全开源，您可以：
- 查看完整源代码：[GitHub 仓库地址](https://github.com/lhly/cloud-drive-renamer)
- 审计所有功能实现
- 验证本隐私政策的准确性
- 提交问题或建议

### 10. 联系我们

如果您对本隐私政策有任何疑问或建议，请通过以下方式联系我们：

- **GitHub Issues**: [项目 Issues 页面](https://github.com/lhly/cloud-drive-renamer/issues)
- **电子邮件**: lhlyzh@qq.com

### 11. 数据权利声明

根据 GDPR（欧盟通用数据保护条例）和其他隐私法规，我们明确声明：

由于本扩展**不收集任何用户数据**，因此：
- ✅ 您的数据始终保留在您的设备上
- ✅ 您可以随时删除本地存储的配置数据
- ✅ 不存在数据泄露的风险
- ✅ 不涉及数据跨境传输
- ✅ 不需要数据处理协议

### 12. 合规声明

本扩展遵守以下法规和标准：
- ✅ Chrome Web Store 开发者政策
- ✅ Microsoft Edge 扩展商店政策
- ✅ GDPR（欧盟通用数据保护条例）
- ✅ CCPA（加州消费者隐私法案）
- ✅ 中国《个人信息保护法》

---

## English Version

### Overview

CloudDrive Renamer (hereinafter referred to as "the Extension") respects and protects user privacy. This Privacy Policy explains how the Extension collects, uses, stores, and protects your information.

**Important Statement**: This Extension is a completely local tool that **does NOT collect, upload, or share any user data**. All operations are performed locally in your browser.

### 1. Information Collection

#### 1.1 Information We DO NOT Collect

The Extension **DOES NOT collect** any of the following information:
- ❌ Personal identification information (name, email, phone, etc.)
- ❌ Cloud drive account credentials (username, password, tokens)
- ❌ File contents or file names
- ❌ Browsing history or access records
- ❌ IP addresses or device information
- ❌ Usage statistics or analytics data
- ❌ Any other user data

#### 1.2 Locally Stored Data

The Extension only stores the following configuration data locally in your browser. This data **NEVER leaves your device**:

| Data Type | Storage Location | Purpose | Uploaded? |
|-----------|-----------------|---------|-----------|
| Rename rule configurations | Browser local storage (chrome.storage.local) | Save user-defined rename rule preferences | ❌ No |
| Crash recovery state | Browser local storage (chrome.storage.local) | Resume execution progress after interruption | ❌ No |

**Storage Location Details**:
- All data is stored in the browser's `chrome.storage.local` API
- Data remains entirely on your device and is not synced to the cloud
- You can clear all data at any time through the browser's extension management page

### 2. Permissions Explanation

The Extension requires the following permissions. All permissions are used for local functionality only and do not involve data uploads:

#### 2.1 storage Permission
- **Purpose**: Save user's rename rule configurations and crash recovery data
- **Scope**: Browser local storage only
- **Data Destination**: Data never leaves your device

#### 2.2 tabs Permission
- **Purpose**: Detect if the current active tab is a supported cloud drive platform
- **Scope**: Only reads the current tab's URL
- **Data Destination**: Does not collect or store any tab information

#### 2.3 host_permissions
Access to the following websites to inject functional interface:
- `https://pan.quark.cn/*` - Quark Drive
- `https://www.aliyundrive.com/*` - Aliyun Drive
- `https://pan.baidu.com/*` - Baidu Drive

**Permission Restrictions**:
- Extension functions are only activated on the above websites
- Does not access any other websites
- Does not read or upload webpage content

### 3. Data Usage

#### 3.1 File Rename Operations

When you use the Extension to rename files:
1. ✅ The Extension reads your selected file list locally in the browser
2. ✅ Applies your configured rename rules locally
3. ✅ Directly calls the cloud drive platform's public API to execute renaming
4. ❌ **The entire process does NOT send data to any third-party servers**

#### 3.2 Interaction with Cloud Drive Platforms

The Extension interacts with cloud drive platforms by:
- Using existing login credentials (Cookies) in your browser
- Directly calling the official cloud drive APIs
- All requests occur directly between your browser and cloud drive servers
- The Extension does not intercept, store, or forward any requests

### 4. Data Security

#### 4.1 Local Security Measures
- All configuration data uses the browser's secure storage mechanism
- Follows Chrome Extension sandbox isolation principles
- Uses Manifest V3 security standards

#### 4.2 Network Security
- The Extension does not establish any external network connections
- Contains no data collection or analytics code
- All code is open source and fully auditable

### 5. Third-Party Services

The Extension **DOES NOT use** any third-party services, including but not limited to:
- ❌ No analytics services (e.g., Google Analytics)
- ❌ No crash reporting services
- ❌ No advertising services
- ❌ No cloud storage services
- ❌ No third-party tracking code

### 6. Children's Privacy

The Extension does not actively collect any user's personal information and therefore does not collect information from children under 13. The Extension is suitable for users of all ages.

### 7. Data Deletion

#### 7.1 Delete Local Data

To delete all local data stored by the Extension:
1. Open Chrome browser
2. Visit `chrome://extensions/`
3. Find CloudDrive Renamer extension
4. Click "Remove" or "Delete" button
5. All local data will be permanently deleted

#### 7.2 Clear Specific Data

To clear only configuration data while keeping the Extension:
1. In the Extension's settings page
2. Use the "Reset Configuration" feature
3. Or use browser's "Clear Browsing Data" and select "Extension Data"

### 8. Privacy Policy Changes

If this Privacy Policy changes:
- We will clearly notify in the Extension update notes
- Updated policy will be published on this page
- We will update the "Last Updated" date
- For significant changes, notifications will be made through the Extension interface

### 9. Open Source and Transparency

The Extension is fully open source. You can:
- View complete source code: [GitHub Repository URL](https://github.com/lhly/cloud-drive-renamer)
- Audit all functionality implementations
- Verify the accuracy of this Privacy Policy
- Submit issues or suggestions

### 10. Contact Us

If you have any questions or suggestions about this Privacy Policy, please contact us through:

- **GitHub Issues**: [Project Issues Page](https://github.com/lhly/cloud-drive-renamer/issues)
- **Email**: lhlyzh@qq.com

### 11. Data Rights Declaration

Under GDPR (General Data Protection Regulation) and other privacy regulations, we explicitly state:

Since the Extension **DOES NOT collect any user data**:
- ✅ Your data always remains on your device
- ✅ You can delete locally stored configuration data at any time
- ✅ No risk of data breaches
- ✅ No cross-border data transfers
- ✅ No data processing agreements required

### 12. Compliance Statement

The Extension complies with the following regulations and standards:
- ✅ Chrome Web Store Developer Policies
- ✅ Microsoft Edge Add-ons Store Policies
- ✅ GDPR (General Data Protection Regulation)
- ✅ CCPA (California Consumer Privacy Act)
- ✅ China's Personal Information Protection Law

---

## 版本历史 / Version History

| 版本 Version | 日期 Date | 变更说明 Changes |
|-------------|-----------|-----------------|
| 1.0 | 2025-01-15 | 初始版本发布 / Initial release |

---

**声明 / Declaration**:
本隐私政策适用于 CloudDrive Renamer 的所有版本和分发渠道（Chrome Web Store、Microsoft Edge Add-ons 等）。

This Privacy Policy applies to all versions and distribution channels of CloudDrive Renamer (Chrome Web Store, Microsoft Edge Add-ons, etc.).
