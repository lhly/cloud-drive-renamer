# 📦 发布流程指南

> CloudDrive Renamer Chrome 扩展自动化发布流程

---

## 🎯 概览

本项目已配置完整的 CI/CD 自动化发布流程，通过 GitHub Actions 实现：

- ✅ **自动构建**：推送标签即触发构建
- ✅ **质量保证**：自动运行测试和代码检查
- ✅ **自动打包**：生成可直接安装的 ZIP 文件
- ✅ **自动发布**：创建 GitHub Release 并附加下载链接
- 📋 **变更日志**：自动生成版本间的变更记录

---

## 🚀 快速发布

### 标准发布流程（3 步）

```bash
# 1. 更新版本号（在 package.json 中）
npm version patch   # 0.1.0 → 0.1.1 (修复 bug)
npm version minor   # 0.1.0 → 0.2.0 (新功能)
npm version major   # 0.1.0 → 1.0.0 (重大更新)

# 2. 推送代码和标签
git push origin main
git push origin --tags

# 3. 等待 GitHub Actions 完成（约 3-5 分钟）
# ✅ 发布完成！访问 GitHub Releases 页面查看
```

### 手动版本号控制

```bash
# 1. 手动编辑 package.json 中的 version 字段
# 例如：从 "0.1.0" 改为 "0.2.0"

# 2. 同步版本号到其他文件
npm run sync:version

# 3. 提交更改
git add .
git commit -m "chore: bump version to 0.2.0"

# 4. 创建并推送标签
git tag v0.2.0
git push origin main
git push origin v0.2.0
```

---

## 📋 发布前检查清单

在创建新版本前，请确认：

### ✅ 代码质量

- [ ] 所有测试通过：`npm run test`
- [ ] 类型检查通过：`npm run typecheck`
- [ ] 代码检查通过：`npm run lint`
- [ ] 本地构建成功：`npm run build`

### ✅ 功能验证

- [ ] 在 Quark 网盘测试重命名功能
- [ ] （可选）在 Aliyun Drive 测试（如已实现）
- [ ] （可选）在 Baidu Pan 测试（如已实现）
- [ ] 测试扩展弹出窗口和选项页面

### ✅ 文档更新

- [ ] 更新 README.md（如有新功能）
- [ ] 更新 CHANGELOG.md（如果手动维护）
- [ ] 更新屏幕截图（如 UI 有变化）

### ✅ 版本管理

- [ ] 确认版本号符合语义化版本规范
- [ ] 确认 package.json 版本号正确
- [ ] 运行 `npm run sync:version` 同步版本号

---

## 🔄 自动化流程详解

### 工作流触发

当你推送符合 `v*.*.*` 格式的标签时，GitHub Actions 会自动启动：

```yaml
触发条件: git push origin v0.1.0
工作流文件: .github/workflows/release.yml
```

### 执行步骤

#### Job 1: Build and Test（构建和测试）

1. **环境准备**
   - 检出代码仓库
   - 设置 Node.js 20 环境
   - 启用 npm 缓存加速

2. **依赖安装**
   - 使用 `npm ci` 安装锁定版本的依赖
   - 确保构建可重现性

3. **质量检查**
   - 运行 Vitest 单元测试
   - 运行 TypeScript 类型检查
   - 运行 ESLint 代码检查

4. **构建扩展**
   - 执行 `npm run build`
   - 自动运行 `sync-version.js` 同步版本号
   - 生成 `dist/` 目录

5. **验证构建**
   - 检查必需文件存在（manifest.json, icons 等）
   - 输出构建统计信息

6. **上传产物**
   - 将 `dist/` 目录作为 artifact 上传
   - 供后续 Job 使用

#### Job 2: Create Release（创建发布）

1. **准备工作**
   - 下载构建产物
   - 提取版本号（去除 v 前缀）

2. **打包扩展**
   - 创建 `cloud-drive-renamer-{version}.zip`
   - 包含完整的扩展文件

3. **生成变更日志**
   - 自动比较当前标签与上一个标签
   - 提取提交信息生成变更列表
   - 包含安装指南和支持的网盘列表

4. **创建 Release**
   - 在 GitHub 上创建正式发布
   - 附加 ZIP 文件供下载
   - 包含详细的发布说明

5. **输出摘要**
   - 显示发布 URL 和下载链接
   - 提示后续操作

---

## 📥 发布产物

每次发布会自动生成以下文件：

### GitHub Release 页面

访问：`https://github.com/YOUR_USERNAME/cloud-drive-renamer/releases`

包含：
- 📦 `cloud-drive-renamer-{version}.zip` - 完整扩展包
- 📝 自动生成的变更日志
- 📋 安装指南

### 安装方式

用户可以通过以下方式安装：

1. **手动安装（开发模式）**
   ```
   1. 下载并解压 cloud-drive-renamer-{version}.zip
   2. 打开 Chrome，访问 chrome://extensions/
   3. 启用"开发者模式"
   4. 点击"加载已解压的扩展程序"
   5. 选择解压后的文件夹
   ```

2. **通过浏览器商店安装（推荐）**
   - Chrome Web Store: https://chromewebstore.google.com/detail/kadpaidccbagkojkdghnkpehkmmbobll
   - Microsoft Edge Add-ons: https://microsoftedge.microsoft.com/addons/detail/kdfapbfjaoigjlbhjdnkhkkpnggnhkjp

---

## 🐛 故障排查

### 构建失败

**问题**：GitHub Actions 工作流失败

**排查步骤**：

1. **查看日志**
   - 访问 GitHub Actions 页面
   - 点击失败的工作流
   - 查看详细错误信息

2. **本地重现**
   ```bash
   # 按照 CI 的步骤本地执行
   npm ci
   npm run test
   npm run typecheck
   npm run lint
   npm run build
   ```

3. **常见原因**
   - 测试失败 → 修复代码后重新提交
   - 类型错误 → 修复 TypeScript 类型
   - 依赖问题 → 更新 `package-lock.json`
   - 构建错误 → 检查 Vite 配置

### 版本号不一致

**问题**：不同文件中的版本号不同步

**解决方案**：

```bash
# 运行版本同步脚本
npm run sync:version

# 验证同步结果
cat package.json | grep version
cat manifest.json | grep version
cat src/shared/version.ts | grep APP_VERSION
```

### 标签推送失败

**问题**：无法推送标签或标签已存在

**解决方案**：

```bash
# 删除本地标签
git tag -d v0.1.0

# 删除远程标签（谨慎操作！）
git push origin --delete v0.1.0

# 重新创建标签
git tag v0.1.0
git push origin v0.1.0
```

---

## 🔐 权限和安全

### GitHub Token

工作流使用 `GITHUB_TOKEN` 自动创建 Release：

- ✅ **自动提供**：GitHub 自动为每个工作流提供 token
- ✅ **权限受限**：仅能访问当前仓库
- ✅ **无需配置**：无需手动设置 Secrets

### 工作流权限

已在 `release.yml` 中配置：

```yaml
permissions:
  contents: write  # 允许创建 Release 和上传文件
```

---

## 🎨 版本号规范

遵循 [语义化版本](https://semver.org/lang/zh-CN/) 规范：

### 格式：`MAJOR.MINOR.PATCH`

- **MAJOR**（主版本号）：不兼容的 API 修改
  - 例如：重大架构调整，移除旧功能
  - `1.0.0` → `2.0.0`

- **MINOR**（次版本号）：向下兼容的功能性新增
  - 例如：新增云盘支持，新增重命名规则
  - `0.1.0` → `0.2.0`

- **PATCH**（修订号）：向下兼容的问题修正
  - 例如：Bug 修复，性能优化
  - `0.1.0` → `0.1.1`

### 预发布版本

用于测试的预发布版本：

```bash
# 创建 Beta 版本
npm version 0.2.0-beta.1

# 推送标签
git push origin v0.2.0-beta.1
```

---

## 🔄 回滚流程

如果发布后发现严重问题，可以快速回滚：

### 方法 1：发布修复版本（推荐）

```bash
# 1. 修复问题
# 2. 创建新的 patch 版本
npm version patch
git push origin main --tags
```

### 方法 2：删除有问题的 Release

```bash
# 1. 在 GitHub 上手动删除 Release
# 2. 删除对应的标签
git tag -d v0.2.0
git push origin --delete v0.2.0

# 3. 修复问题后重新发布
git tag v0.2.0
git push origin v0.2.0
```

---

## 🚀 下一步：Phase 2（可选）

Phase 2 将实现 **Chrome Web Store 自动上传**：

### 前置要求

1. **Chrome Web Store 开发者账号**
   - 注册开发者账号（一次性 $5 费用）
   - 手动发布扩展至少一次

2. **Google Cloud Project**
   - 创建项目并启用 Chrome Web Store API
   - 配置 OAuth 2.0 凭证

3. **获取 API 凭证**
   - Client ID
   - Client Secret
   - Refresh Token

### 实施步骤

详细步骤请参考：
- [Chrome Web Store API 文档](https://developer.chrome.com/docs/webstore/using_webstore_api/)
- [chrome-webstore-upload 文档](https://github.com/fregante/chrome-webstore-upload)

---

## 📞 获取帮助

### 常见问题

- 📖 查看 [GitHub Actions 文档](https://docs.github.com/en/actions)
- 🔧 查看 [项目 Issues](https://github.com/YOUR_USERNAME/cloud-drive-renamer/issues)

### 报告问题

如果遇到发布流程的问题，请创建 Issue 并包含：

- ✅ 错误信息和日志
- ✅ 执行的命令
- ✅ GitHub Actions 工作流链接
- ✅ 本地环境信息（Node.js 版本等）

---

## 📊 发布统计

### 成功指标

- ⏱️ **发布时间**：约 3-5 分钟（从推送标签到发布完成）
- 🎯 **成功率目标**：> 95%
- 🔄 **发布频率**：根据需要（建议每周或双周）

### 监控

定期检查：
- GitHub Actions 工作流成功率
- Release 下载量
- 用户反馈和问题报告

---

## 🎉 总结

现在你的项目已配置完整的自动化发布流程！

**只需 3 步即可发布新版本**：
1. 更新版本号 (`npm version patch/minor/major`)
2. 推送标签 (`git push origin --tags`)
3. 等待自动化流程完成 ✅

**祝发布顺利！** 🚀
