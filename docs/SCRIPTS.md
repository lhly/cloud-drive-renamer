# 📋 NPM Scripts 使用指南

> 精简后的命令集：从 30 个减少到 16 个核心命令（减少 47%）

## 🚀 核心开发命令

### `pnpm run dev`
**启动开发服务器**
- 自动同步版本号
- 启动 Vite 热更新开发服务器
- 实时预览扩展功能

```bash
pnpm run dev
```

### `pnpm run build`
**完整质量检查 + 生产构建** ✨
- ✅ 自动同步版本号
- ✅ ESLint 代码检查
- ✅ TypeScript 类型检查
- ✅ 单元测试 + 覆盖率
- ✅ 编译构建
- 🎯 **质量门控设计**：确保所有质量检查通过才能构建成功

```bash
pnpm run build
```

**为什么 build 包含这么多步骤？**
这是有意的质量门控（Quality Gate）设计，防止遗漏检查导致问题上线。如果需要快速测试构建，可以使用 `pnpm run validate` 预检查。

### `pnpm run preview`
**预览生产构建**
- 本地预览构建产物
- 验证生产环境行为

```bash
pnpm run build
pnpm run preview
```

---

## 🔍 代码质量命令

### `pnpm run lint`
**运行 ESLint 检查**
- 检查代码规范问题
- 不自动修复

```bash
pnpm run lint
```

### `pnpm run lint:fix`
**自动修复 ESLint 问题**
- 自动修复可修复的问题
- 替代了原 `format` 命令

```bash
pnpm run lint:fix
```

💡 **提示**：建议在 IDE 中配置保存时自动运行 `lint:fix`

### `pnpm run typecheck`
**TypeScript 类型检查**
- 不生成编译产物
- 仅检查类型错误

```bash
pnpm run typecheck
```

---

## 🧪 测试命令

### `npm test`
**交互式单元测试（开发模式）**
- Vitest 监听模式
- 文件变化自动重跑
- 适合开发时使用

```bash
npm test
```

### `pnpm run test:coverage`
**单元测试 + 覆盖率报告**
- 运行所有单元测试
- 生成覆盖率报告
- 与 `test:ci` 功能相同

```bash
pnpm run test:coverage
```

### `pnpm run test:ci`
**CI 环境测试（等同于 test:coverage）**
- 用于 CI/CD 流程
- 生成覆盖率报告

```bash
pnpm run test:ci
```

### `pnpm run test:e2e`
**端到端测试（Playwright）**
- 运行 E2E 测试套件
- 无头模式运行

```bash
pnpm run test:e2e
```

### `pnpm run test:e2e:ui`
**可视化 E2E 测试**
- Playwright UI 模式
- 可视化调试测试

```bash
pnpm run test:e2e:ui
```

💡 **按需使用的测试命令**：
```bash
# 测试 UI 界面（按需安装）
npx vitest --ui

# E2E 调试模式（按需使用）
npx playwright test --debug

# 性能测试（暂未配置）
npx vitest run tests/performance
```

---

## ✅ 验证和 CI 命令

### `pnpm run validate`
**完整质量验证**
- Lint + TypeCheck + Test
- 用于提交前验证
- 比 `build` 更快（不实际编译）

```bash
pnpm run validate
```

### `pnpm run ci`
**CI/CD 完整流程**
- 运行 `validate`
- 运行 `build`
- 用于自动化部署

```bash
pnpm run ci
```

---

## 🖼️ 图片处理命令

### `pnpm run resize`
**参数化图片调整工具**

替代了原来的 6 个独立命令，现在统一使用参数化调用：

```bash
# 商店截图 (1280x800)
pnpm run resize screenshot

# Logo (300x300)
pnpm run resize logo

# 小促销磁贴 (440x280)
pnpm run resize small-promo

# 大型促销磁贴 (1400x560)
pnpm run resize large-promo

# 小尺寸截图 (640x400)
pnpm run resize screenshot-small

# 查看所有可用预设
pnpm run resize
```

**高级用法**：
```bash
# 自定义输入目录
pnpm run resize screenshot ./my-images

# 自定义输出目录
pnpm run resize logo ./icons ./output

# 自定义背景颜色
pnpm run resize screenshot -- --background=white

# 自定义图片位置
pnpm run resize logo -- --position=top
```

---

## 🔧 工具命令

### `pnpm run sync:version`
**同步版本号**
- 自动同步 package.json 和 manifest.json 版本号
- `dev` 和 `build` 会自动调用

```bash
pnpm run sync:version
```

### `pnpm run verify:release`
**验证发布包**
- 检查构建产物完整性
- 发布前验证

```bash
pnpm run verify:release
```

---

## 📊 命令精简对比

| 类别 | 原有 | 精简后 | 说明 |
|------|------|--------|------|
| 开发构建 | 5 | 3 | 移除 prebuild/predev hooks |
| 代码质量 | 3 | 2 | 移除独立 format 命令 |
| 测试 | 8 | 5 | 移除重复和 YAGNI 命令 |
| 验证 | 2 | 2 | 保持不变 |
| 图片处理 | 6 | 1 | 参数化替代 |
| 其他 | 6 | 3 | 移除重复命令 |
| **总计** | **30** | **16** | **-47%** |

---

## ❌ 已移除的命令及替代方案

| 已移除 | 替代方案 | 原因 |
|--------|----------|------|
| `prebuild` | `build` 中自动调用 | 移除 npm hooks，简化流程 |
| `predev` | `dev` 中自动调用 | 移除 npm hooks，简化流程 |
| `build:only` | `build` | 避免绕过质量检查 |
| `format` | `lint:fix` | ESLint 可以处理格式化 |
| `test:ui` | `npx vitest --ui` | 按需使用，无需固定命令 |
| `test:full` | `test:coverage` | 功能重复 |
| `test:performance` | `npx vitest run tests/performance` | YAGNI - 暂不需要 |
| `test:e2e:debug` | `npx playwright test --debug` | 按需使用 |
| `validate:quick` | `validate` | 功能重叠 |
| `release:check` | `verify:release` | 完全重复 |
| `resize:screenshots` | `pnpm run resize screenshot` | 参数化替代 |
| `resize:screenshots-small` | `pnpm run resize screenshot-small` | 参数化替代 |
| `resize:logo` | `pnpm run resize logo` | 参数化替代 |
| `resize:promo-small` | `pnpm run resize small-promo` | 参数化替代 |
| `resize:promo-large` | `pnpm run resize large-promo` | 参数化替代 |
| `resize:all` | 手动运行多次 `resize` | 简化命令集 |

---

## 💡 最佳实践

### 开发工作流
```bash
# 1. 启动开发服务器
pnpm run dev

# 2. 开发过程中运行测试
npm test

# 3. 提交前验证
pnpm run validate

# 4. 构建前最终检查
pnpm run build
```

### CI/CD 工作流
```bash
# 完整 CI 流程
pnpm run ci
```

### 发布工作流
```bash
# 1. 完整构建和测试
pnpm run build

# 2. 运行 E2E 测试
pnpm run test:e2e

# 3. 验证发布包
pnpm run verify:release

# 4. 发布到商店...
```

---

## 🎯 设计原则

1. **质量门控优先** - `build` 命令整合所有质量检查
2. **参数化优先** - 用参数替代多个相似命令
3. **YAGNI 原则** - 移除未来可能需要的命令
4. **按需使用** - 低频命令使用 `npx` 按需调用
5. **简化认知** - 减少命令数量，降低学习成本

---

## 📝 更新日志

**2025-12-16**
- ✅ 从 30 个命令精简到 16 个核心命令
- ✅ 保留 `build` 命令的质量门控设计
- ✅ 图片处理命令参数化
- ✅ 移除 npm hooks（prebuild/predev）
- ✅ 移除重复和 YAGNI 命令
- ✅ 更新开发文档
