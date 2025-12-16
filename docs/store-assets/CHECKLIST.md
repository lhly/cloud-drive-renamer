# 商店资料快速检查清单

## 📦 必需文件检查

### 扩展包
- [ ] `cloud-drive-renamer-v0.1.0.zip` - 生产构建的扩展包
  - 位置: 项目根目录
  - 创建方法: `npm run build && cd dist && zip -r ../cloud-drive-renamer-v0.1.0.zip . && cd ..`

### 图标
- [x] `public/icons/icon128.png` - 128x128 主图标
- [x] `public/icons/icon48.png` - 48x48 图标
- [x] `public/icons/icon16.png` - 16x16 图标

### 截图
- [x] `screenshots/store/cdr-01.png` - 主界面截图
- [x] `screenshots/store/cdr-02.png` - 预览功能截图
- [x] `screenshots/store/cdr-03.png` - 执行进度截图

### 文档
- [x] `store-assets/chrome-web-store-listing.md` - Chrome商店列表
- [x] `store-assets/edge-addons-listing.md` - Edge商店列表
- [x] `store-assets/PRIVACY_POLICY.md` - 隐私政策
- [x] `store-assets/SUBMISSION_GUIDE.md` - 提交指南

---

## 🎨 视觉资产验证

### 图标要求

#### Chrome Web Store
- [x] 尺寸: 128x128 pixels
- [x] 格式: PNG
- [ ] 透明背景（推荐但非必需）
- [ ] 在浅色和深色背景下都清晰可见

#### Edge Add-ons
- [x] 尺寸: 128x128 pixels（必需）
- [ ] 256x256 pixels（推荐）
- [x] 格式: PNG
- [ ] 透明背景（推荐）

### 截图要求

#### Chrome Web Store
- [x] 数量: 至少1张，最多5张（当前有3张）
- [x] 尺寸: 1280x800 或 640x400
- [x] 格式: PNG 或 JPEG
- [ ] 文件大小: 每张不超过5MB

#### Edge Add-ons
- [x] 数量: 至少1张（当前有3张）
- [x] 推荐尺寸: 1366x768 或 1280x800
- [x] 格式: PNG 或 JPEG
- [ ] 每张截图需要说明文字

**当前截图尺寸验证**:
```bash
# 运行此命令检查截图尺寸
file screenshots/store/*.png
# 或
identify screenshots/store/*.png
```

---

## 📝 文本内容检查

### Chrome Web Store

#### 基本信息
- [x] 扩展名称: "云盘批量重命名工具" (45字符以内)
- [x] 简短描述: 132字符以内
- [x] 详细描述: 已准备（中文和英文版本）
- [x] 分类: Productivity
- [x] 语言: zh_CN, en, zh_TW

#### 隐私和权限
- [x] 隐私政策URL准备
- [x] 权限说明文本
- [x] 数据使用说明

### Microsoft Edge Add-ons

#### 基本信息
- [x] 扩展名称: "云盘批量重命名工具" (45字符以内)
- [x] 简短描述: 150字符以内
- [x] 完整描述: 已准备（中文和英文版本）
- [x] 分类: Productivity
- [x] 搜索关键词

#### 多语言列表
- [x] 中文（简体）列表
- [x] English列表
- [ ] 中文（繁体）列表（可选）

#### 隐私和支持
- [x] 隐私政策URL
- [x] 项目主页URL
- [x] 支持邮箱
- [x] 权限说明

---

## 🔧 技术验证

### 扩展包验证

```bash
# 1. 确保项目无错误
npm run typecheck
npm run lint
npm test

# 2. 构建生产版本
npm run build

# 3. 检查dist目录内容
ls -la dist/
# 应该包含:
# - manifest.json
# - icons/
# - src/
# - assets/
# - _locales/

# 4. 验证manifest.json
cat dist/manifest.json | jq .
# 检查:
# - version字段正确
# - name和description使用__MSG__
# - permissions列表正确
# - host_permissions正确

# 5. 创建扩展包
cd dist
zip -r ../cloud-drive-renamer-v0.1.0.zip .
cd ..

# 6. 检查zip包内容
unzip -l cloud-drive-renamer-v0.1.0.zip
```

### Chrome安装测试

```bash
# 1. 在Chrome中打开扩展页面
# chrome://extensions/

# 2. 启用"开发者模式"

# 3. 点击"加载已解压的扩展程序"

# 4. 选择dist目录

# 5. 验证:
# - 扩展图标显示正常
# - 扩展名称和描述正确
# - 访问夸克网盘测试功能
# - 检查控制台无错误
```

### Edge安装测试

```bash
# 1. 在Edge中打开扩展页面
# edge://extensions/

# 2. 启用"开发人员模式"

# 3. 点击"加载解压的扩展"

# 4. 选择dist目录

# 5. 验证:
# - 扩展图标显示正常
# - 扩展名称和描述正确
# - 访问夸克网盘测试功能
# - 检查控制台无错误
```

---

## 🌐 隐私政策发布

### 上传到GitHub

```bash
# 1. 复制隐私政策到项目根目录
cp store-assets/PRIVACY_POLICY.md ./PRIVACY_POLICY.md

# 2. 提交到Git
git add PRIVACY_POLICY.md
git commit -m "docs: add privacy policy for store submission"
git push origin main

# 3. 验证URL可访问
# https://github.com/lhly/cloud-drive-renamer/blob/main/PRIVACY_POLICY.md
```

### 备用方案

如果项目还未推送到GitHub，可以使用以下备用方案：

1. **GitHub Gist**
   - 创建公开Gist
   - 上传PRIVACY_POLICY.md
   - 使用Raw URL

2. **个人网站**
   - 托管在个人网站
   - 确保URL稳定可访问

3. **GitHub Pages**
   - 创建简单的静态页面
   - 托管隐私政策

---

## 💰 开发者账号准备

### Chrome Web Store

- [ ] Google账号已准备
- [ ] 访问 [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/)
- [ ] 支付5美元注册费
- [ ] 完成开发者注册

### Microsoft Edge Add-ons

- [ ] Microsoft账号已准备
- [ ] 访问 [Microsoft Partner Center](https://partner.microsoft.com/dashboard)
- [ ] 完成免费注册
- [ ] 进入Edge Add-ons管理页面

---

## 📋 提交前最终检查

### 通用检查

- [ ] 所有文档已阅读和理解
- [ ] 扩展包已构建和测试
- [ ] 所有视觉资产符合要求
- [ ] 隐私政策已发布到可访问的URL
- [ ] 支持邮箱有效且可接收邮件
- [ ] 项目GitHub仓库已公开（如适用）

### Chrome特定检查

- [ ] 扩展名称不超过45字符
- [ ] 简短描述不超过132字符
- [ ] 至少1张截图，最多5张
- [ ] 图标为128x128 PNG格式
- [ ] 分类已选择（Productivity）
- [ ] 隐私政策URL有效
- [ ] 所有权限都有说明

### Edge特定检查

- [ ] 扩展名称不超过45字符
- [ ] 简短描述不超过150字符
- [ ] 至少1张截图
- [ ] Logo为128x128 PNG格式
- [ ] 每种语言的列表都已准备
- [ ] 每张截图都有说明文字
- [ ] 隐私政策URL有效
- [ ] 支持信息完整
- [ ] 权限说明详细

---

## 🚀 提交步骤

### Chrome Web Store

1. [ ] 登录开发者控制台
2. [ ] 创建新商品
3. [ ] 上传扩展包
4. [ ] 填写所有商店列表信息
5. [ ] 上传图标和截图
6. [ ] 设置隐私和权限
7. [ ] 配置分发设置
8. [ ] 提交审核

### Microsoft Edge Add-ons

1. [ ] 登录Partner Center
2. [ ] 进入Edge Add-ons管理
3. [ ] 创建新扩展提交
4. [ ] 上传扩展包
5. [ ] 填写属性信息
6. [ ] 创建各语言列表
7. [ ] 设置可用性
8. [ ] 填写隐私信息
9. [ ] 提交审核

---

## 📊 审核追踪

### Chrome Web Store

- **提交日期**: ___________
- **审核状态**: ___________
- **预计完成**: 1-3个工作日
- **扩展ID**: ___________
- **商店URL**: ___________

### Microsoft Edge Add-ons

- **提交日期**: ___________
- **审核状态**: ___________
- **预计完成**: 3-7个工作日
- **扩展ID**: ___________
- **商店URL**: ___________

---

## 📞 联系信息记录

### 重要信息

- **开发者邮箱**: lhlyzh@qq.com
- **项目主页**: https://github.com/lhly/cloud-drive-renamer
- **问题反馈**: https://github.com/lhly/cloud-drive-renamer/issues
- **隐私政策URL**: https://github.com/lhly/cloud-drive-renamer/blob/main/PRIVACY_POLICY.md

### 商店账号

- **Chrome开发者账号**: ___________
- **Edge开发者账号**: ___________

---

## ✅ 完成标记

- [ ] Chrome Web Store 已提交
- [ ] Microsoft Edge Add-ons 已提交
- [ ] 审核状态监控中
- [ ] README已更新商店链接
- [ ] 社交媒体已发布公告

---

**最后更新**: 2025年12月16日

**注意**:
- 在每个步骤完成后，在对应的复选框中打勾 ✓
- 记录重要的日期和ID信息
- 保存此文件以备后续参考
