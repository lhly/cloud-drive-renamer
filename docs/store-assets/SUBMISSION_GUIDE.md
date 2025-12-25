# 扩展商店发布指南 / Extension Store Submission Guide

本文档提供Chrome Web Store和Microsoft Edge Add-ons的详细发布流程。

---

## 目录

1. [准备工作](#准备工作)
2. [Chrome Web Store发布流程](#chrome-web-store发布流程)
3. [Microsoft Edge Add-ons发布流程](#microsoft-edge-add-ons发布流程)
4. [发布后维护](#发布后维护)
5. [常见问题](#常见问题)

---

## 准备工作

### 1. 构建生产版本

```bash
# 确保所有测试通过
npm test
npm run typecheck
npm run lint

# 构建生产版本
npm run build

# 验证构建结果
ls -la dist/
```

### 2. 打包扩展

```bash
# 进入dist目录
cd dist

# 创建zip包
zip -r ../cloud-drive-renamer-v0.1.0.zip .

# 返回项目根目录
cd ..
```

### 3. 准备视觉资产

确保以下文件准备就绪：

- [x] 图标: `public/icons/icon128.png` (128x128)
- [x] 截图: `screenshots/store/cdr-01.png` (1280x800 或类似)
- [x] 截图: `screenshots/store/cdr-02.png`
- [x] 截图: `screenshots/store/cdr-03.png`

### 4. 准备文档

- [x] Chrome商店列表: `store-assets/chrome-web-store-listing.md`
- [x] Edge商店列表: `store-assets/edge-addons-listing.md`
- [x] 隐私政策: `store-assets/PRIVACY_POLICY.md`

---

## Chrome Web Store发布流程

### 第一步：创建开发者账号

1. 访问 [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/)
2. 使用Google账号登录
3. 支付一次性注册费用（5美元）
4. 完成开发者账号注册

### 第二步：创建新商品

1. 在开发者控制台，点击 **"New Item"**
2. 上传扩展包 `cloud-drive-renamer-v0.1.0.zip`
3. 等待上传完成

### 第三步：填写商店列表信息

#### 基本信息

1. **Product name（产品名称）**
   ```
   云盘批量重命名工具
   ```

2. **Summary（简短描述）**
   ```
   强大的批量重命名工具，支持夸克网盘、阿里云盘、百度网盘文件批量重命名
   ```

3. **Category（分类）**
   - Primary: `Productivity`
   - Secondary: 可选

4. **Language（语言）**
   - 主要语言: `中文（简体）`
   - 支持的语言: `中文（简体）`、`English`、`中文（繁体）`

#### 详细描述

从 `store-assets/chrome-web-store-listing.md` 复制"详细描述"部分的中文内容。

#### 图形资产

1. **Icon（图标）**
   - 上传: `public/icons/icon128.png`
   - 尺寸: 128x128 pixels

2. **Screenshots（截图）**
   - 上传以下文件（按顺序）:
     1. `screenshots/store/cdr-01.png` - "直观的批量重命名界面"
     2. `screenshots/store/cdr-02.png` - "实时预览功能"
     3. `screenshots/store/cdr-03.png` - "智能执行进度追踪"

3. **Promotional Images（宣传图片，可选）**
   - Small tile: 440x280 (如果有)
   - Large tile: 920x680 (如果有)
   - Marquee: 1400x560 (如果有)

#### 隐私设置

1. **Privacy Policy（隐私政策）**
   - 上传 `store-assets/PRIVACY_POLICY.md` 到GitHub
   - 填写URL: `https://github.com/lhly/cloud-drive-renamer/blob/main/store-assets/PRIVACY_POLICY.md`

2. **Permissions（权限说明）**
   - 填写从 `store-assets/chrome-web-store-listing.md` 复制的"权限用途说明"

3. **Data Usage（数据使用）**
   - 选择: **"This item does not collect user data"**

#### 分发设置

1. **Visibility（可见性）**
   - 选择: **"Public"**（公开）

2. **Regions（地区）**
   - 选择: **"All regions"**（所有地区）

3. **Pricing（定价）**
   - 选择: **"Free"**（免费）

### 第四步：提交审核

1. 检查所有必填项已完成
2. 点击 **"Submit for review"**
3. 确认提交

### 第五步：等待审核

- 审核时间：通常1-3个工作日
- 审核状态可在开发者控制台查看
- 如有问题，会收到邮件通知

---

## Microsoft Edge Add-ons发布流程

### 第一步：创建开发者账号

1. 访问 [Microsoft Partner Center](https://partner.microsoft.com/dashboard)
2. 使用Microsoft账号登录（或创建新账号）
3. 完成开发者账号注册（免费）

### 第二步：进入Edge Add-ons管理

1. 在Partner Center，选择 **"Office and SharePoint Add-ins"**
2. 或直接访问: [Edge Add-ons Manager](https://partner.microsoft.com/dashboard/microsoftedge)

### 第三步：创建新扩展提交

1. 点击 **"Create new extension"**
2. 上传扩展包 `cloud-drive-renamer-v0.1.0.zip`
3. 等待上传和自动验证完成

### 第四步：填写商店列表信息

#### Package（扩展包）

- 已在第三步上传
- 确认包验证通过（无错误或警告）

#### Properties（属性）

1. **Category（分类）**
   - 选择: `Productivity`

2. **Additional categories（附加分类，可选）**
   - 可以不填或选择相关分类

3. **Search terms（搜索词）**
   ```
   文件重命名, 批量重命名, 云盘, Quark Drive, Rename, Batch Operations
   ```

4. **Logo（标志）**
   - 上传: `public/icons/icon128.png`
   - 尺寸: 128x128 pixels

#### Listings（商店列表）

需要为每种支持的语言创建列表：

##### 中文（简体）列表

1. **Language（语言）**: `Chinese (Simplified, China)`

2. **Extension name（扩展名称）**
   ```
   云盘批量重命名工具
   ```

3. **Short description（简短描述）**
   ```
   强大的批量重命名工具，支持夸克网盘、阿里云盘、百度网盘文件批量重命名
   ```

4. **Long description（详细描述）**
   - 从 `store-assets/edge-addons-listing.md` 复制中文版本的"完整描述"

5. **Screenshots（截图）**
   - 上传以下文件并添加说明:
     1. `screenshots/store/cdr-01.png`
        - 说明: "直观的批量重命名界面 - 支持多种规则配置"
     2. `screenshots/store/cdr-02.png`
        - 说明: "实时预览功能 - 所见即所得的重命名效果"
     3. `screenshots/store/cdr-03.png`
        - 说明: "智能执行进度追踪 - 批量操作一目了然"

##### English列表

重复上述步骤，使用英文内容（从 `store-assets/edge-addons-listing.md` 获取）

#### Availability（可用性）

1. **Markets（市场）**
   - 选择: **"All markets"**（所有市场）

2. **Visibility（可见性）**
   - 选择: **"Public"**（公开）

#### Privacy（隐私）

1. **Privacy policy URL（隐私政策URL）**
   ```
   https://github.com/lhly/cloud-drive-renamer/blob/main/store-assets/PRIVACY_POLICY.md
   ```

2. **Website（网站）**
   ```
   https://github.com/lhly/cloud-drive-renamer
   ```

3. **Support contact（支持联系）**
   - Email: `lhlyzh@qq.com`

4. **Permissions justification（权限说明）**
   - 从 `store-assets/edge-addons-listing.md` 复制"数据使用说明"

### 第五步：提交审核

1. 检查所有部分已完成
2. 点击 **"Submit"**
3. 确认提交

### 第六步：等待审核

- 审核时间：通常3-7个工作日
- 审核状态可在Partner Center查看
- 如有问题，会收到邮件通知

---

## 发布后维护

### 监控审核状态

#### Chrome Web Store

- 访问: [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/)
- 查看扩展状态
- 处理审核反馈（如有）

#### Microsoft Edge Add-ons

- 访问: [Partner Center](https://partner.microsoft.com/dashboard/microsoftedge)
- 查看提交状态
- 处理审核反馈（如有）

### 发布成功后

1. **记录商店链接**
   - Chrome: `https://chrome.google.com/webstore/detail/[extension-id]`
   - Edge: `https://microsoftedge.microsoft.com/addons/detail/[extension-id]`

2. **更新README.md**
   - 添加商店徽章
   - 添加安装链接

3. **社交媒体推广**
   - 发布公告
   - 分享商店链接

### 处理审核被拒

如果审核被拒，常见原因和解决方案：

#### 常见拒绝原因

1. **权限过度**
   - 检查manifest.json中的权限
   - 确保每个权限都有明确的说明

2. **功能不工作**
   - 在Chrome/Edge中重新测试
   - 确保所有功能正常

3. **描述不清晰**
   - 改进商店列表描述
   - 添加更多截图说明

4. **隐私政策问题**
   - 确保隐私政策URL可访问
   - 检查隐私政策内容完整性

5. **违反内容政策**
   - 检查是否符合商店政策
   - 移除可能违规的内容

#### 修复和重新提交

1. 根据反馈修改相应内容
2. 重新构建扩展包（如果修改了代码）
3. 更新商店列表信息（如果修改了描述）
4. 重新提交审核

### 版本更新流程

当发布新版本时：

1. **更新版本号**
   ```bash
   # 更新package.json和manifest.json中的版本号
   npm version patch  # 或 minor, major
   npm run sync:version
   ```

2. **构建和打包**
   ```bash
   npm run build
   cd dist
   zip -r ../cloud-drive-renamer-v[新版本号].zip .
   cd ..
   ```

3. **上传新版本**
   - Chrome: 在开发者控制台上传新包
   - Edge: 在Partner Center上传新包

4. **更新商店列表（如有变化）**
   - 更新描述
   - 添加新截图
   - 更新功能列表

5. **提供更新日志**
   ```markdown
   ## 版本 0.2.0 更新内容
   - 新增阿里云盘支持
   - 优化重命名速度
   - 修复若干已知问题
   ```

---

## 常见问题

### Q: 审核需要多长时间？

**A:**
- Chrome Web Store: 通常1-3个工作日
- Microsoft Edge Add-ons: 通常3-7个工作日
- 首次提交可能需要更长时间

### Q: 如何加快审核速度？

**A:**
- 确保所有信息准确完整
- 提供清晰的截图和描述
- 隐私政策详细且易于访问
- 扩展功能完全正常工作
- 遵守所有商店政策

### Q: 可以同时发布到两个商店吗？

**A:** 是的，可以同时提交到Chrome和Edge商店。两者审核独立进行。

### Q: 发布后可以修改商店列表吗？

**A:** 可以。修改描述、截图等无需重新审核。但修改扩展代码需要提交新版本并重新审核。

### Q: 如何处理用户反馈？

**A:**
- 及时回复商店评论
- 在GitHub Issues处理技术问题
- 通过邮件回复用户询问
- 定期发布更新解决问题

### Q: 需要支付费用吗？

**A:**
- Chrome Web Store: 一次性5美元注册费
- Microsoft Edge Add-ons: 免费

### Q: 扩展被下架怎么办？

**A:**
1. 查看下架原因通知邮件
2. 修复违规内容
3. 联系商店支持团队
4. 申请重新审核

---

## 联系支持

### Chrome Web Store

- 支持中心: https://support.google.com/chrome_webstore/
- 开发者论坛: https://groups.google.com/a/chromium.org/g/chromium-extensions

### Microsoft Edge Add-ons

- 支持中心: https://docs.microsoft.com/microsoft-edge/extensions-chromium/
- 开发者论坛: https://techcommunity.microsoft.com/

### 项目支持

- GitHub Issues: https://github.com/lhly/cloud-drive-renamer/issues
- 邮箱: lhlyzh@qq.com

---

## 检查清单

### 发布前检查

- [ ] 代码通过所有测试
- [ ] TypeScript编译无错误
- [ ] ESLint检查通过
- [ ] 版本号已更新
- [ ] 构建生产版本成功
- [ ] 扩展包已创建
- [ ] 在Chrome中测试安装和功能
- [ ] 在Edge中测试安装和功能
- [ ] 所有截图准备就绪
- [ ] 图标符合要求
- [ ] 商店列表文本已准备
- [ ] 隐私政策已上传到可访问的URL
- [ ] 开发者账号已注册

### Chrome提交检查

- [ ] 扩展包已上传
- [ ] 产品名称已填写
- [ ] 简短描述已填写
- [ ] 详细描述已填写
- [ ] 分类已选择
- [ ] 图标已上传
- [ ] 至少1张截图已上传
- [ ] 隐私政策URL已填写
- [ ] 权限说明已填写
- [ ] 可见性设置为Public
- [ ] 地区设置为All regions
- [ ] 定价设置为Free

### Edge提交检查

- [ ] 扩展包已上传并验证通过
- [ ] 分类已选择
- [ ] Logo已上传
- [ ] 中文列表已完成
- [ ] 英文列表已完成
- [ ] 截图及说明已上传
- [ ] 隐私政策URL已填写
- [ ] 支持联系信息已填写
- [ ] 权限说明已填写
- [ ] 市场设置为All markets
- [ ] 可见性设置为Public

---

**祝发布顺利！** 🚀
