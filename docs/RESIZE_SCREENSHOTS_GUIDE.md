# 截图尺寸调整工具使用指南

## 功能说明

这个工具可以自动将截图调整到指定尺寸，并添加透明背景填充，非常适合准备 Chrome 扩展商店的资源文件。

## 主要特性

- ✅ 支持多种预设尺寸（商店截图、Logo、促销图等）
- ✅ 自动保持图片宽高比
- ✅ 添加透明背景填充
- ✅ 批量处理整个目录
- ✅ 支持自定义背景颜色和图片位置

## 安装依赖

```bash
pnpm add -D sharp
```

## 预设尺寸

| 预设名称 | 尺寸 | 说明 | 输出目录 |
|---------|------|------|----------|
| `screenshot` | 1280x800 | 商店截图（推荐） | `screenshots/store/` |
| `screenshot-small` | 640x400 | 小尺寸截图 | `screenshots/small/` |
| `logo` | 300x300 | 扩展徽标（正方形） | `screenshots/logo/` |
| `small-promo` | 440x280 | 小促销磁贴 | `screenshots/promo-small/` |
| `large-promo` | 1400x560 | 大型促销磁贴 | `screenshots/promo-large/` |

## 使用方法

### 最简单用法（推荐）

```bash
# 1. 将原始截图放到 screenshots/ 目录
mkdir -p screenshots
cp your-screenshots/* screenshots/

# 2. 处理截图（自动输出到 screenshots/store/）
node scripts/resize-screenshots.js screenshot

# 3. 获取处理后的图片
# 在 screenshots/store/ 目录中
```

### 基本语法

```bash
node scripts/resize-screenshots.js <preset> [input-dir] [output-dir] [options]
```

**参数说明**：
- `<preset>`：必需，预设尺寸名称
- `[input-dir]`：可选，输入目录（默认：`./screenshots`）
- `[output-dir]`：可选，输出目录（默认：`./screenshots/<预设子目录>/`）
- `[options]`：可选，额外选项

### 快速开始

**场景 1：处理商店截图**
```bash
# 最简单 - 使用默认目录
node scripts/resize-screenshots.js screenshot
# 输入: screenshots/*.png
# 输出: screenshots/store/*.png
```

**场景 2：处理 Logo**
```bash
node scripts/resize-screenshots.js logo
# 输出: screenshots/logo/*.png
```

**场景 3：处理所有格式**
```bash
# 生成多种尺寸的截图
node scripts/resize-screenshots.js screenshot
node scripts/resize-screenshots.js screenshot-small
node scripts/resize-screenshots.js logo
node scripts/resize-screenshots.js small-promo
node scripts/resize-screenshots.js large-promo

# 结果: screenshots/ 目录下有完整的子目录结构
```

### 高级用法

#### 1. 自定义输入目录

```bash
# 从其他目录读取图片，输出到默认位置
node scripts/resize-screenshots.js screenshot ./my-images
# 输出: screenshots/store/*.png
```

#### 2. 完全自定义目录

```bash
# 自定义输入和输出目录
node scripts/resize-screenshots.js logo ./icons ./output/logo
```

#### 3. 使用白色背景

```bash
node scripts/resize-screenshots.js logo --background=white
```

#### 4. 顶部对齐

```bash
node scripts/resize-screenshots.js screenshot --position=top
```

#### 5. 自定义背景颜色

```bash
node scripts/resize-screenshots.js screenshot --background=#F0F0F0
```

## 可用选项

### `--position=<pos>`

设置图片在目标画布中的位置：

- `center` - 居中（默认）
- `top` - 顶部对齐
- `bottom` - 底部对齐
- `left` - 左对齐
- `right` - 右对齐

### `--background=<color>`

设置背景颜色：

- `transparent` - 透明背景（默认，推荐用于商店截图）
- `white` - 白色背景
- `#RRGGBB` - 自定义十六进制颜色（如 `#F0F0F0`）

## 完整示例

### 示例 1：准备商店截图（推荐工作流）

```bash
# 1. 准备原始截图
mkdir -p screenshots
cp my-app-screenshots/* screenshots/

# 2. 生成商店截图（最简单）
node scripts/resize-screenshots.js screenshot

# 3. 检查结果
ls screenshots/store/
# → 看到处理后的截图

# 4. 上传到商店
# 直接使用 screenshots/store/ 目录中的文件
```

### 示例 2：生成所有尺寸

```bash
# 一次性生成所有预设尺寸
for preset in screenshot screenshot-small logo small-promo large-promo; do
  node scripts/resize-screenshots.js $preset
done

# 查看完整结构
tree screenshots/
```

### 示例 3：批处理不同类型

```bash
# 商店截图 - 透明背景
node scripts/resize-screenshots.js screenshot

# Logo - 白色背景
node scripts/resize-screenshots.js logo --background=white

# 小促销图 - 顶部对齐
node scripts/resize-screenshots.js small-promo --position=top
```

## 输出示例

运行脚本时会看到详细的处理信息：

```
🚀 开始批量处理 - 商店截图
   目标尺寸: 1280x800
   图片位置: center
   背景: transparent
   找到 3 个图片文件

📷 处理图片: screenshots/demo1.png
   原始尺寸: 1920x1080
   目标尺寸: 1280x800
   缩放后: 1280x720
   ✅ 已保存: store-assets/demo1.png
   填充位置: left=0, top=40

📊 处理完成:
   ✅ 成功: 3
```

## 注意事项

1. **图片格式**：支持 PNG、JPG、JPEG、WebP 格式，输出统一为 PNG
2. **透明背景**：推荐使用透明背景上传到商店，看起来更专业
3. **宽高比**：工具会自动保持原图宽高比，不会变形
4. **文件覆盖**：输出目录如果存在同名文件会被覆盖

## 已内置的 npm 命令（推荐）

本项目已在 `package.json` 中内置参数化脚本 `pnpm run resize`，无需再添加多个 `resize:*` 命令：

```bash
# 商店截图 (1280x800)
pnpm run resize screenshot

# 小尺寸截图 (640x400)
pnpm run resize screenshot-small

# Logo (300x300)
pnpm run resize logo

# 小促销图 (440x280)
pnpm run resize small-promo

# 大促销图 (1400x560)
pnpm run resize large-promo

# 查看所有可用预设
pnpm run resize
```

更多参数（输入/输出目录、背景色、位置等）请参考 `docs/SCRIPTS.md`。

## 常见问题

### Q: 为什么要使用透明背景？

A: Chrome 扩展商店的截图如果使用透明背景，会自动适应商店的主题色，看起来更加专业和美观。

### Q: 如何选择合适的预设？

A:
- 商店截图页面：使用 `screenshot` (1280x800)
- 扩展图标：使用 `logo` (300x300)
- 商店促销图：使用 `small-promo` 或 `large-promo`

### Q: 图片太大或太小怎么办？

A: 工具会自动缩放图片以适应目标尺寸，同时保持宽高比，不会变形。

## 技术支持

如有问题，请查看：
- [Sharp 文档](https://sharp.pixelplumbing.com/)
- Chrome 扩展商店图片要求
