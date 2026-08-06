# 商店资料目录 / Store Assets Directory

本目录包含发布到Chrome Web Store和Microsoft Edge Add-ons所需的所有资料和文档。

---

## 📁 目录结构

```
docs/store-assets/
├── README.md                        # 本文件
├── chrome-web-store-listing.md      # Chrome商店列表信息
├── edge-addons-listing.md           # Edge商店列表信息
├── edge-supplemental-info.md        # Edge补充信息（搜索关键词等）
├── PRIVACY_POLICY.md                # 隐私政策（中英文）
├── SUBMISSION_GUIDE.md              # 详细提交指南
└── CHECKLIST.md                     # 快速检查清单
```

---

## 📄 文件说明

### 1. chrome-web-store-listing.md

**用途**: Chrome Web Store商店列表的完整内容

**包含内容**:
- 扩展名称（中英文）
- 简短描述（132字符以内）
- 详细描述（中英文完整版本）
- 分类信息
- 视觉资产要求说明
- 权限说明文本
- 隐私政策要点
- 支持信息
- 提交检查清单

**如何使用**:
1. 打开Chrome Web Store开发者控制台
2. 从此文件复制相应内容到商店列表表单
3. 根据需要调整格式

### 2. edge-addons-listing.md

**用途**: Microsoft Edge Add-ons商店列表的完整内容

**包含内容**:
- 扩展名称（中英文）
- 简短描述（150字符以内）
- 完整描述（中英文版本）
- 分类和标签
- **搜索关键词**（新增）
- 截图说明文字
- 权限和数据使用说明
- 隐私政策信息
- 支持资源
- 提交检查清单

**如何使用**:
1. 打开Microsoft Partner Center
2. 从此文件复制相应内容到商店列表表单
3. 特别注意填写搜索关键词（Properties部分）
4. 为每种语言创建单独的列表

### 2.1 edge-supplemental-info.md

**用途**: Edge Add-ons特定字段的详细说明和最佳实践

**包含内容**:
- 搜索关键词详细说明和策略
- 分类选择建议
- 市场和可用性设置
- 描述优化建议
- 截图优化指南
- Edge特定注意事项
- 与Chrome的差异对比
- 提交表单快速参考

**如何使用**:
- 填写搜索关键词时参考第1节
- 优化描述和截图时参考相应章节
- 作为Edge提交的完整指南

### 3. PRIVACY_POLICY.md

**用途**: 扩展的隐私政策文档（商店要求必需）

**包含内容**:
- 中文版本隐私政策
- 英文版本隐私政策
- 数据收集说明（不收集任何数据）
- 权限使用说明
- 本地存储说明
- 开源透明声明
- 联系信息

**如何使用**:
1. 将此文件复制到项目根目录或上传到GitHub
2. 获取可公开访问的URL
3. 在商店提交表单中填写隐私政策URL

**推荐URL格式**:
```
https://github.com/lhly/cloud-drive-renamer/blob/main/docs/store-assets/PRIVACY_POLICY.md
```
或者复制到项目根目录:
```
https://github.com/lhly/cloud-drive-renamer/blob/main/PRIVACY_POLICY.md
```

### 4. SUBMISSION_GUIDE.md

**用途**: 详细的分步提交指南

**包含内容**:
- Chrome Web Store完整提交流程
- Microsoft Edge Add-ons完整提交流程
- 账号注册说明
- 表单填写详解
- 审核流程说明
- 发布后维护指南
- 版本更新流程
- 常见问题解答

**如何使用**:
- 首次提交时逐步跟随指南操作
- 作为参考文档随时查阅
- 更新版本时参考相关章节

### 5. CHECKLIST.md

**用途**: 快速检查清单，确保所有准备工作就绪

**包含内容**:
- 必需文件检查
- 视觉资产验证
- 文本内容检查
- 技术验证步骤
- 提交前最终检查
- 审核追踪表格

**如何使用**:
1. 打印或在屏幕上打开此文件
2. 逐项检查并勾选完成项
3. 确保所有必需项都已完成
4. 记录重要信息（日期、ID等）

---

## 🎨 所需视觉资产

### 图标

| 文件 | 尺寸 | 用途 | 位置 |
|------|------|------|------|
| icon16.png | 16x16 | 浏览器工具栏 | `/public/icons/` |
| icon48.png | 48x48 | 扩展管理页面 | `/public/icons/` |
| icon128.png | 128x128 | 商店列表 | `/public/icons/` |

### 截图

| 文件 | 尺寸 | 说明 | 位置 |
|------|------|------|------|
| cdr-01.png | 1280x800 | 主界面 | `/screenshots/store/` |
| cdr-02.png | 1280x800 | 预览功能 | `/screenshots/store/` |
| cdr-03.png | 1280x800 | 执行进度 | `/screenshots/store/` |

**截图说明文字**:

中文:
1. "直观的批量重命名界面 - 支持多种规则配置"
2. "实时预览功能 - 所见即所得的重命名效果"
3. "智能执行进度追踪 - 批量操作一目了然"

English:
1. "Intuitive batch rename interface - Support multiple rule configurations"
2. "Real-time preview feature - WYSIWYG rename results"
3. "Smart execution progress tracking - Batch operations at a glance"

---

## 🚀 快速开始

### 准备扩展包

```bash
# 1. 确保所有测试通过
pnpm run typecheck
pnpm run lint
npm test

# 2. 构建生产版本
pnpm run build

# 3. 创建扩展包
VERSION=$(node -p "JSON.parse(require('fs').readFileSync('package.json','utf8')).version")
cd dist
zip -r ../cloud-drive-renamer-v${VERSION}.zip .
cd ..
```

### 发布隐私政策

```bash
# 隐私政策已在docs/store-assets/目录下
# 直接提交到Git
git add docs/store-assets/PRIVACY_POLICY.md
git commit -m "docs: add privacy policy for store submission"
git push origin main

# 或者如果需要在项目根目录也放一份
cp docs/store-assets/PRIVACY_POLICY.md ./PRIVACY_POLICY.md
git add PRIVACY_POLICY.md
git commit -m "docs: add privacy policy to project root"
git push origin main
```

### 提交到商店

1. **Chrome Web Store**:
   - 打开 [开发者控制台](https://chrome.google.com/webstore/devconsole/)
   - 参考 `chrome-web-store-listing.md` 获取完整内容
   - 参考 `SUBMISSION_GUIDE.md` 中的Chrome章节了解流程
   - 使用 `CHECKLIST.md` 确保所有项完成

2. **Microsoft Edge Add-ons**:
   - 打开 [Partner Center](https://partner.microsoft.com/dashboard)
   - 参考 `edge-addons-listing.md` 获取完整内容
   - **重要**: 参考 `edge-supplemental-info.md` 填写搜索关键词
   - 参考 `SUBMISSION_GUIDE.md` 中的Edge章节了解流程
   - 使用 `CHECKLIST.md` 确保所有项完成

---

## 📋 提交前检查清单（简化版）

### 必需文件
- [ ] 扩展包 `cloud-drive-renamer-v{version}.zip`
- [ ] 图标 `icon128.png`
- [ ] 至少3张截图
- [ ] 隐私政策已发布到可访问的URL

### 必需信息
- [ ] 扩展名称（中英文）
- [ ] 简短描述（符合字符限制）
- [ ] 详细描述（中英文完整版）
- [ ] 分类选择
- [ ] 权限说明
- [ ] 支持邮箱

### 技术验证
- [ ] 在Chrome中测试安装成功
- [ ] 在Edge中测试安装成功
- [ ] 所有功能正常工作
- [ ] 无控制台错误

---

## 🔗 重要链接

### 商店链接

- **Chrome Web Store开发者控制台**: https://chrome.google.com/webstore/devconsole/
- **Microsoft Edge Add-ons管理**: https://partner.microsoft.com/dashboard/microsoftedge
- **Microsoft Partner Center**: https://partner.microsoft.com/dashboard

### 文档和支持

- **Chrome扩展文档**: https://developer.chrome.com/docs/extensions/
- **Edge扩展文档**: https://docs.microsoft.com/microsoft-edge/extensions-chromium/
- **Chrome商店政策**: https://developer.chrome.com/docs/webstore/program-policies/
- **Edge商店政策**: https://docs.microsoft.com/microsoft-edge/extensions-chromium/store-policies/

### 项目相关

- **项目主页**: https://github.com/lhly/cloud-drive-renamer
- **问题反馈**: https://github.com/lhly/cloud-drive-renamer/issues
- **隐私政策URL**: https://github.com/lhly/cloud-drive-renamer/blob/main/docs/store-assets/PRIVACY_POLICY.md

---

## ⚠️ 注意事项

### 版本号同步

确保以下位置的版本号一致:
- `package.json` 中的 `version` 字段
- `manifest.json` 中的 `version` 字段
- 扩展包文件名中的版本号

可以使用以下命令同步版本号:
```bash
pnpm run sync:version
```

### 隐私政策要求

- Chrome和Edge都**强制要求**提供隐私政策
- 隐私政策必须是可公开访问的URL
- 不能是PDF文件，必须是网页
- 推荐使用GitHub托管（稳定可靠）

### 截图要求

- Chrome: 1280x800 或 640x400
- Edge: 1366x768 或 1280x800（推荐）
- 格式: PNG或JPEG
- 文件大小: 每张不超过5MB
- 数量: 至少1张，建议3-5张

### 审核时间

- Chrome Web Store: 通常1-3个工作日
- Microsoft Edge Add-ons: 通常3-7个工作日
- 首次提交可能需要更长时间
- 节假日期间可能延迟

### 常见被拒原因

1. 隐私政策URL无效或不可访问
2. 权限说明不清晰或不完整
3. 扩展功能无法正常工作
4. 截图不清晰或不符合要求
5. 描述不准确或含有误导信息

---

## 📞 获取帮助

如有任何疑问或需要帮助，请通过以下方式联系:

- **项目Issues**: https://github.com/lhly/cloud-drive-renamer/issues
- **邮箱**: lhlyzh@qq.com

---

## 📝 更新记录

- **2025-12-16**:
  - 初始版本创建，包含所有必需的商店资料
  - 添加Edge搜索关键词说明
  - 创建edge-supplemental-info.md补充文档
  - 更新文档路径为docs/store-assets/

---

**祝您发布顺利！** 🚀

如果成功发布，欢迎更新项目README添加商店徽章:

```markdown
[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/[extension-id].svg)](https://chrome.google.com/webstore/detail/[extension-id])
[![Edge Add-ons](https://img.shields.io/badge/dynamic/json?label=edge%20add-on&query=%24.version&url=https%3A%2F%2Fmicrosoftedge.microsoft.com%2Faddons%2Fgetproductdetailsbycrxid%2F[extension-id])](https://microsoftedge.microsoft.com/addons/detail/[extension-id])
```
