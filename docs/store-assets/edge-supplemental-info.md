# Edge Add-ons 补充信息

本文档补充Microsoft Edge Add-ons申请表单中的额外必填字段和最佳实践。

---

## 1. 搜索关键词 (Search Terms)

### 什么是搜索关键词

搜索关键词帮助用户在Edge Add-ons商店中发现您的扩展。这些关键词应该反映用户可能的搜索习惯和扩展的核心功能。

### 推荐关键词列表

#### 英文关键词（5-10个）

**核心推荐**：
```
rename, batch rename, file rename, cloud drive, quark drive, file management, productivity
```

**完整列表**（可选择性使用）：
- `rename` - 核心功能
- `batch rename` - 批量操作
- `file rename` - 文件重命名
- `cloud drive` - 云盘
- `cloud storage` - 云存储
- `quark drive` - 夸克网盘
- `file management` - 文件管理
- `bulk rename` - 批量重命名
- `batch operations` - 批量操作
- `productivity` - 效率工具

#### 中文关键词（供参考）

虽然Edge主要使用英文关键词，但如果支持中文商店，可以考虑：
```
重命名, 批量重命名, 文件重命名, 云盘, 网盘, 夸克网盘, 文件管理, 批量操作, 效率工具
```

### 关键词策略

#### 优先级排序

1. **高优先级（必选）**：
   - `rename` - 直接描述核心功能
   - `batch rename` - 用户最可能搜索的词
   - `file management` - 功能分类

2. **中优先级（推荐）**：
   - `cloud drive` - 目标平台
   - `quark drive` - 具体支持的服务
   - `productivity` - 使用场景

3. **低优先级（可选）**：
   - `bulk operations` - 功能描述
   - `cloud storage` - 同义词
   - `file rename` - 功能变体

#### 关键词组合策略

Edge允许使用**短语关键词**：
```
✅ 好的做法：
"batch rename"         (短语，用户常搜索)
"file management"      (短语，描述准确)
"cloud drive"          (短语，目标明确)

❌ 避免的做法：
"best rename tool"     (主观词汇)
"free software"        (与功能无关)
"windows"              (过于宽泛)
```

### 关键词最佳实践

#### ✅ 应该做的

1. **使用用户语言**
   - 想象用户会如何搜索这个功能
   - 使用常见的行业术语
   - 包含产品的核心价值

2. **保持相关性**
   - 所有关键词都应与功能直接相关
   - 反映扩展的实际能力
   - 匹配目标用户群体的搜索习惯

3. **覆盖不同搜索意图**
   - 功能词：rename, batch
   - 场景词：file management, productivity
   - 平台词：cloud drive, quark

#### ❌ 不应该做的

1. **关键词堆砌**
   ```
   ❌ 错误示例：
   "rename file rename batch rename bulk rename mass rename"
   ```

2. **使用无关热门词**
   ```
   ❌ 错误示例：
   "AI, ChatGPT, popular, trending"
   ```

3. **重复扩展名称**
   ```
   ❌ 如果扩展名称已包含"Renamer"，避免再用"renamer"作为关键词
   ```

4. **使用品牌名称**
   ```
   ❌ 错误示例：
   "Microsoft Edge, Chrome, Windows"
   ```

### 填写方式

在Edge Add-ons Partner Center中：

**位置**：Properties → Search terms

**格式**：用逗号分隔的关键词列表

**推荐填写**：
```
rename, batch rename, file rename, cloud drive, file management, productivity
```

**备选方案**（如果需要更具体）：
```
batch rename, cloud drive, quark drive, file management, bulk operations
```

---

## 2. 分类选择 (Category)

### 主要分类

**推荐选择**：`Productivity`（生产力工具）

**理由**：
- ✅ 扩展帮助用户提高文件管理效率
- ✅ 适合办公和日常文件整理场景
- ✅ 与同类工具归在同一类别，便于用户发现

### 其他可考虑的分类

虽然Productivity是最佳选择，但以下分类也相关：

1. **Developer Tools**（开发者工具）
   - 如果您强调对开发者的价值
   - 例如：批量重命名项目文件

2. **Utilities**（实用工具）
   - 如果商店有这个分类
   - 强调通用工具性质

**不推荐**：
- ❌ Shopping - 与电商无关
- ❌ News & Weather - 内容不匹配
- ❌ Entertainment - 不是娱乐工具

---

## 3. 市场和可用性 (Markets & Availability)

### 推荐设置

**市场选择**：`All markets`（所有市场）

**可见性**：`Public`（公开）

**理由**：
- ✅ 云盘服务全球可用
- ✅ 扩展支持多语言（中文、英文、繁体中文）
- ✅ 功能通用，适合全球用户

### 特定市场考虑

如果需要针对特定市场：

**亚太市场**：
- 中国大陆（如果适用）
- 中国台湾
- 中国香港
- 日本、韩国

**理由**：夸克网盘主要用户群在亚太地区

**注意**：全球发布可以覆盖所有用户，除非有特殊的合规或业务需求。

---

## 4. 详细描述优化建议

### 描述结构最佳实践

#### 开场白（前100字）

这是最重要的部分，因为用户首先看到的就是这里：

**好的开场**：
```
一款强大的云盘文件批量重命名工具，专为提升文件管理效率而设计。

支持夸克网盘、阿里云盘、百度网盘，提供6种智能重命名规则：替换、正则替换、前缀、后缀、编号、清理。所有操作在本地完成，不收集任何数据。
```

**为什么好**：
- ✅ 立即说明核心价值
- ✅ 明确支持的平台
- ✅ 强调隐私保护
- ✅ 简洁有力

#### 功能列表

使用**清晰的层级结构**：

```
✨ 核心特性

🎯 多平台支持
• 夸克网盘 - 完全支持
• 阿里云盘 - 完全支持
• 百度网盘 - 完全支持

🔧 六大重命名规则
1. 替换规则 - 批量替换特定文本
2. 正则替换规则 - 使用正则表达式批量替换文件名
3. 前缀规则 - 添加统一前缀
...
```

#### 使用场景

**包含实际例子**让用户能立即理解价值：

```
📝 典型使用场景

1. 整理照片集
   IMG_001.jpg → Tokyo2025_001.jpg

2. 清理文档命名
   报告@2024#最终版.docx → 报告2024Final.docx
```

### 描述优化清单

- [ ] 开场白在100字内说明核心价值
- [ ] 使用emoji增强可读性（适度）
- [ ] 功能描述具体且可量化
- [ ] 包含实际使用例子
- [ ] 强调隐私和安全
- [ ] 提及开源和透明
- [ ] 包含技术栈（可选，显示专业性）
- [ ] 提供项目主页链接

---

## 5. 截图优化建议

### 截图命名和说明

每张截图都应该有清晰的说明文字：

#### 中文说明

1. **主界面截图**
   ```
   直观的批量重命名界面 - 支持多种规则配置
   ```

2. **预览功能截图**
   ```
   实时预览功能 - 所见即所得的重命名效果
   ```

3. **执行进度截图**
   ```
   智能执行进度追踪 - 批量操作一目了然
   ```

#### 英文说明

1. **Main Interface**
   ```
   Intuitive batch rename interface - Support multiple rule configurations
   ```

2. **Preview Feature**
   ```
   Real-time preview feature - WYSIWYG rename results
   ```

3. **Progress Tracking**
   ```
   Smart execution progress tracking - Batch operations at a glance
   ```

### 截图最佳实践

#### ✅ 好的截图

- 清晰的界面展示
- 突出核心功能
- 包含实际数据（示例文件名）
- 展示前后对比效果
- 分辨率符合要求（1366x768或1280x800）

#### ❌ 避免的问题

- 截图模糊或压缩过度
- 包含个人隐私信息
- 界面元素被截断
- 没有展示实际功能
- 文字太小难以阅读

---

## 6. Edge Add-ons特定注意事项

### 审核差异

Edge的审核与Chrome有以下不同：

#### 更严格的隐私审查

- 必须清楚说明每个权限的用途
- 数据使用必须透明
- 隐私政策必须详细且易于访问

#### 更注重用户体验

- 截图质量要求更高
- 描述必须准确且专业
- 不允许夸大宣传

#### 技术标准

- 必须与最新版Edge完全兼容
- 不能有控制台错误或警告
- 性能必须良好

### 常见拒绝原因（Edge特定）

1. **权限说明不充分**
   - 解决：参考本文档的权限说明模板
   - 每个权限都要有具体用途说明

2. **描述与功能不符**
   - 解决：确保描述准确反映实际功能
   - 不要承诺未实现的功能

3. **隐私政策不完整**
   - 解决：使用提供的PRIVACY_POLICY.md模板
   - 确保URL可访问

4. **截图不清晰**
   - 解决：使用高分辨率截图
   - 确保文字清晰可读

---

## 7. 提交表单快速参考

### Edge Add-ons Properties 部分

#### Category（分类）
```
Productivity
```

#### Search Terms（搜索关键词）
```
rename, batch rename, file rename, cloud drive, file management, productivity
```

#### Logo（图标）
```
上传: public/icons/icon128.png (128x128 PNG)
```

### Listings 部分（中文简体）

#### Extension Name（扩展名称）
```
云盘批量重命名工具
```

#### Short Description（简短描述）
```
强大的批量重命名工具，支持夸克网盘、阿里云盘、百度网盘文件批量重命名
```

#### Long Description（详细描述）
```
从 edge-addons-listing.md 复制"完整描述"的中文版本
```

#### Screenshots（截图）
```
上传3张截图，每张附带说明文字（见上文第5节）
```

### Availability 部分

#### Markets（市场）
```
All markets
```

#### Visibility（可见性）
```
Public
```

### Privacy 部分

#### Privacy Policy URL（隐私政策）
```
https://github.com/lhly/cloud-drive-renamer/blob/main/PRIVACY_POLICY.md
```

#### Website（网站）
```
https://github.com/lhly/cloud-drive-renamer
```

#### Support Email（支持邮箱）
```
lhlyzh@qq.com
```

#### Permissions Justification（权限说明）
```
storage: 在浏览器本地保存用户的重命名规则配置和任务状态
tabs: 识别当前访问的云盘平台，加载对应的功能模块
host_permissions: 在云盘页面注入重命名工具界面并调用云盘API执行重命名操作

所有权限直接支持扩展的核心功能：批量文件重命名。
```

---

## 8. 审核准备清单

### 提交前验证

- [ ] 搜索关键词已填写（5-10个相关词汇）
- [ ] 分类选择正确（Productivity）
- [ ] 扩展名称符合规范（45字符以内）
- [ ] 简短描述吸引人（150字符以内）
- [ ] 详细描述完整且专业
- [ ] 3-5张高质量截图已上传
- [ ] 每张截图都有说明文字
- [ ] 图标为128x128 PNG格式
- [ ] 隐私政策URL可访问
- [ ] 权限说明清晰详细
- [ ] 支持邮箱有效
- [ ] 在Edge浏览器中测试通过

### 提交后追踪

- [ ] 记录提交日期
- [ ] 保存扩展ID
- [ ] 设置邮件提醒
- [ ] 定期检查审核状态
- [ ] 准备好回复审核反馈

---

## 9. 与Chrome Web Store的差异对比

| 项目 | Chrome Web Store | Edge Add-ons |
|------|------------------|--------------|
| 搜索关键词 | 不支持 | 支持，需要填写 |
| 分类选择 | 必需 | 必需 |
| 简短描述字数限制 | 132字符 | 150字符 |
| 单一用途说明 | 必需 | 不需要单独说明 |
| 远程代码声明 | 必需 | 不需要单独声明 |
| 审核时间 | 1-3天 | 3-7天 |
| 注册费用 | $5（一次性） | 免费 |
| 多语言列表 | 自动根据locale | 需要手动创建 |

---

## 10. 完成状态

- [x] 搜索关键词准备完成
- [x] 分类和标签确定
- [x] 描述优化建议
- [x] 截图说明文字
- [x] 权限说明模板
- [x] 提交表单快速参考
- [x] 审核准备清单

**准备完毕！**

使用本文档补充Edge Add-ons申请表单中的搜索关键词等信息，确保提交内容完整专业。
