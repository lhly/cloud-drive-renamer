# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Cloud Drive Renamer (云盘批量重命名工具) - A Chrome/Edge extension for batch renaming files on cloud storage platforms. Currently supports Quark Drive (夸克网盘) with architecture ready for Aliyun Drive and Baidu Drive expansion.

**Tech Stack:**
- TypeScript 5.9+ with strict mode
- Vite 5.4+ for building (with @crxjs/vite-plugin for Chrome extension support)
- Lit 3.3+ for Web Components UI
- Vitest for unit/integration tests, Playwright for E2E tests
- Chrome Extension Manifest V3

## Common Development Commands

### Development Workflow
```bash
# Start development server with hot reload
npm run dev

# Run tests in watch mode during development
npm test

# Before committing: full validation (lint + typecheck + tests)
npm run validate

# Production build with complete quality gates
npm run build
```

### Testing
```bash
# Unit tests with coverage
npm run test:coverage

# E2E tests
npm run test:e2e

# E2E tests with UI
npm run test:e2e:ui

# Run single test file
npx vitest run tests/unit/executor.test.ts

# Run test with specific pattern
npx vitest run -t "should handle batch execution"
```

### Code Quality
```bash
# Lint check
npm run lint

# Auto-fix lint issues
npm run lint:fix

# TypeScript type checking (no emit)
npm run typecheck
```

### CI/CD
```bash
# Full CI pipeline (used in GitHub Actions)
npm run ci

# Verify release package integrity
npm run verify:release
```

### Utilities
```bash
# Sync version between package.json and manifest.json
npm run sync:version

# Resize images for store assets (parameterized)
npm run resize screenshot     # Store screenshots (1280x800)
npm run resize logo          # Logo (300x300)
npm run resize small-promo   # Small promo tile (440x280)
npm run resize large-promo   # Large promo tile (1400x560)
```

## Architecture Overview

### Core Design Patterns

**Adapter Pattern for Platform Support:**
- `src/adapters/base/adapter.interface.ts` - Base adapter interface
- `src/adapters/quark/` - Quark Drive implementation
- `src/adapters/aliyun/` - Aliyun Drive implementation
- `src/adapters/baidu/` - Baidu Pan implementation

**Strategy Pattern for Rename Rules:**
- `src/rules/base-rule.ts` - Base rule class
- `src/rules/rule-factory.ts` - Rule factory for creating rule instances
- 5 concrete rule implementations: replace, prefix, suffix, numbering, sanitize

**Executor Pattern for Batch Processing:**
- `src/core/executor.ts` - BatchExecutor with rate limiting (800ms interval)
- `src/core/retry.ts` - Exponential backoff retry mechanism
- `src/core/crash-recovery.ts` - Crash recovery with idempotency
- `src/core/conflict-detector.ts` - Duplicate name detection

### Key Architectural Components

**Content Script Architecture:**
```
Content Script (ISOLATED world)
├── FloatingButton (Shadow DOM)
│   └── src/content/components/floating-button.ts
├── Main Panel (Lit Web Components)
│   ├── file-selector-panel.ts  - 3-column container (config / list / preview)
│   ├── config-panel.ts         - Rule config + execution/progress
│   ├── file-list-panel.ts      - Search/filter/select + virtual list
│   └── preview-panel.ts        - Preview + conflict/status + virtual list
└── Platform Adapter Integration

Page Script (MAIN world) - For API interception
└── src/adapters/{quark,aliyun,baidu}/page-script.ts (dynamically injected)

Dialog Page (extension iframe, optional/legacy UI)
└── src/dialog/ (hosts rename-dialog/rename-preview, if used)
```

**Message Communication:**
- Content Script ↔ Background Service Worker via `chrome.runtime.sendMessage`
- Content Script ↔ Page Script via `window.postMessage` (cross-world communication)
- See `src/types/message.ts` for message protocol definitions

**Batch Execution Flow:**
1. Get selected files via platform adapter
2. Apply rename rules via RuleFactory
3. Preview changes with conflict detection
4. Execute batch rename with:
   - 800ms request interval (rate limiting)
   - Concurrent execution with staggered delays
   - Progress tracking via event system
   - Automatic retry with exponential backoff
   - Crash recovery support

## Critical Implementation Details

### Chrome Extension Specifics

**Manifest V3 Requirements:**
- Service Worker background script (not persistent)
- Content script runs in ISOLATED world; platform page-scripts are injected into MAIN world via `<script>` (see `injectPageScriptToMainWorld()` in `src/content/index.ts`)
- Web-accessible resources are used for MAIN-world page-scripts and optional dialog pages
- Host permissions for target cloud platforms

**Build Configuration:**
- Vite with @crxjs/vite-plugin automatically handles:
  - Content script injection
  - Icon copying
  - Manifest processing
- Web Components polyfill loaded via `src/content/polyfills.ts`

**Testing Chrome Extension Features:**
- Vitest config excludes `quark-adapter.test.ts` (requires Chrome extension mock environment)
- Playwright config uses special launch options:
  ```javascript
  launchOptions: {
    args: [
      '--disable-extensions-except=./dist',
      '--load-extension=./dist'
    ]
  }
  ```

### Platform Adapter Implementation

When adding a new platform adapter:

1. **Implement `PlatformAdapter` interface:**
   - `getSelectedFiles()` - Extract selected files from DOM (optional for some flows)
   - `getAllFiles(parentId?)` - Fetch full file list via API (used by file selector panel)
   - `renameFile(fileId, newName)` - Call platform API (returns `RenameResult`)
   - `checkNameConflict(fileName, parentId)` - Validate uniqueness
   - `getFileInfo(fileId)` - Fetch file metadata

2. **Add content script entry in manifest.json:**
   ```json
   {
     "matches": ["https://newplatform.com/*"],
     "js": ["src/content/index.ts"],
     "run_at": "document_idle"
   }
   ```

3. **Add host permissions:**
   ```json
   "host_permissions": ["https://newplatform.com/*"]
   ```

### Rename Rule Implementation

When adding a new rename rule:

1. **Extend `BaseRule` class:**
   ```typescript
   export class NewRule extends BaseRule {
     execute(fileName: string, index: number, total: number): string {
       // Implementation
     }
     validate(config: any): boolean {
       // Validation
     }
   }
   ```

2. **Add to `RuleFactory.create()` switch statement**

3. **Update `RuleType` union in `src/types/rule.ts`**

4. **Create params interface** (e.g., `NewRuleParams`)

## Testing Strategy

### Test Structure
- `tests/unit/` - Unit tests for individual modules
- `tests/integration/` - Integration tests for workflows
- `tests/performance/` - Performance benchmarks (not run in CI)
- `tests/e2e/` - Playwright E2E tests

### Testing Best Practices
- Mock Chrome APIs using `vi.mock('chrome', ...)`
- Use `vi.stubGlobal()` for global DOM APIs
- Integration tests focus on BatchExecutor workflows
- E2E tests validate actual extension behavior in browser

### Coverage Requirements
- All new features must include unit tests
- Critical paths (executor, rules, adapters) require integration tests
- Coverage reports generated in `coverage/` directory

## Build and Release Process

### Version Management
- Version is single source of truth in `package.json`
- `npm run sync:version` syncs to `manifest.json` and `src/shared/version.ts`
- Automatically run before `dev` and `build` commands

### Quality Gates in Build
The `npm run build` command enforces quality gates in this order:
1. ✅ Sync version
2. ✅ ESLint check
3. ✅ TypeScript type check
4. ✅ Unit tests with coverage
5. ✅ TypeScript compilation
6. ✅ Vite build

**Important:** Do NOT skip quality checks. If build fails, fix the root cause.

### CI/CD Workflows

**`.github/workflows/ci.yml`:**
- Triggered on: PR to main, push to main
- Runs: `npm run ci` (validate + build)
- Verifies: dist artifacts exist and are valid

**`.github/workflows/release.yml`:**
- Triggered on: Tag push (v*.*.*)
- Steps: build → test → package → GitHub Release
- Outputs: `cloud-drive-renamer-{version}.zip`

**`.github/workflows/complete-tests.yml`:**
- Manual trigger workflow for comprehensive testing
- Includes E2E tests and performance benchmarks

### Release Process
```bash
# 1. Update version in package.json
npm version patch|minor|major

# 2. Build and verify
npm run build
npm run verify:release

# 3. Create and push tag
git push origin main --tags
```

## Code Style and Conventions

### Naming Conventions
- Classes: PascalCase (e.g., `RuleFactory`, `BatchExecutor`)
- Methods/functions: camelCase (e.g., `getSelectedFiles`)
- Constants: UPPER_SNAKE_CASE (e.g., `MAX_RETRY_COUNT`)
- Files: kebab-case (e.g., `rule-factory.ts`)

### TypeScript Guidelines
- Strict mode enabled - all code must pass strict type checking
- Prefer `interface` over `type` for object shapes
- All public APIs must have explicit type annotations
- Use `Record<string, any>` sparingly, prefer specific types
- Enable unused variables check (exception: prefix with `_`)

### Import Aliases
- `@/` alias maps to `src/`
- Example: `import { RuleFactory } from '@/rules/rule-factory'`

### ESLint Rules
- No `console.log` (use `console.warn` or `console.error` for production)
- No `any` type without explicit warning suppression
- Prefer `const` over `let`, never use `var`
- Unused parameters must be prefixed with `_`

## Critical Error Patterns to Avoid

### Chrome Extension Pitfalls
- **DO NOT** use synchronous storage APIs (use `chrome.storage.local.get/set`)
- **DO NOT** assume background script is persistent (Manifest V3)
- **DO NOT** use `eval()` or inline scripts (CSP restrictions)
- **DO NOT** forget to declare permissions in manifest.json

### TypeScript/Build Issues
- **DO NOT** bypass quality checks with `build:only` (command removed intentionally)
- **DO NOT** use relative paths for type imports across distant directories
- **DO NOT** import test files in production code
- **DO NOT** forget to run `npm run sync:version` before manual version changes

### Testing Issues
- **DO NOT** use real Chrome APIs in unit tests (always mock)
- **DO NOT** run E2E tests in parallel (set workers: 1)
- **DO NOT** skip type checking in test files

## Special Files and Scripts

### Utility Scripts (scripts/)
- `sync-version.js` - Version synchronization logic
- `verify-release.js` - Release package validation
- `resize-screenshots.js` - Image processing with Sharp
- `optimize-icon.js` - Icon optimization

### Configuration Files
- `tsconfig.json` - Strict TypeScript configuration
- `.eslintrc.cjs` - ESLint rules for webextensions
- `vite.config.ts` - Vite build with @crxjs plugin
- `vitest.config.ts` - Test configuration with jsdom
- `playwright.config.ts` - E2E test configuration

### Important Exclusions
- `tests/performance/` - Not run in standard CI
- `tests/e2e/` - Handled by Playwright, not Vitest
- `**/quark-adapter.test.ts` - Excluded until Chrome mock environment ready

## Debugging Tips

### Development Mode
1. Run `npm run dev`
2. Load unpacked extension from `dist/` directory
3. Check console in:
   - Extension popup (DevTools on popup.html)
   - Content script (DevTools on cloud platform page)
   - Background service worker (chrome://extensions/ → "service worker")

### Common Debug Scenarios
- **Content script not loading:** Check matches pattern in manifest.json
- **API calls failing:** Verify host_permissions includes platform domain
- **Rules not applying:** Check RuleFactory registration and type definitions
- **Build artifacts missing:** Run `npm run verify:release` to diagnose

### Logging Strategy
- Use `console.warn()` for expected issues (user-facing)
- Use `console.error()` for unexpected errors
- Prefix logs with `[CloudDrive Renamer]` for filtering
- See `src/utils/logger.ts` for structured logging

## Store Assets and Documentation

The `docs/store-assets/` directory contains materials for Chrome Web Store and Edge Add-ons submission:
- Listing descriptions in markdown format
- Privacy policy (required for store submission)
- Submission checklist and guides
- Screenshot specifications

Screenshots are processed using the `npm run resize` command with predefined presets matching store requirements.

## Performance Considerations

- **Rate Limiting:** 800ms interval between rename requests (configurable via `requestInterval`)
- **Concurrent Execution:** Uses `Promise.allSettled()` with staggered delays, not sequential
- **Virtual Scrolling:** Large file lists use `@lit-labs/virtualizer` in preview
- **Bundle Size:** Lit is chosen for its small footprint (~20KB) vs React/Vue
- **Memory:** Crash recovery stores minimal state in chrome.storage.local

## Version History and Roadmap

### Current Version: v1.0.0 (Stable Release)

**Major improvements from v0.4.1:**

1. **Complete Platform Support:**
   - Quark Drive: Full support with folder renaming and page sync
   - Aliyun Drive: Full support with auto page list sync
   - Baidu Drive: Full support with optimized API calls

2. **Enhanced UI/UX:**
   - File selector panel with 3-column layout (config/list/preview)
   - Draggable floating button with position memory
   - Virtual scrolling for large file lists (thousands of files)
   - Advanced search and filtering capabilities

3. **Execution Engine Improvements:**
   - Auto page sync after rename completion (Aliyun/Baidu)
   - Manual retry for failed items
   - Real-time progress visualization
   - Platform usage statistics

4. **Internationalization:**
   - Multi-language support (zh_CN / zh_TW / en)
   - Auto language detection
   - Optimized script injection for i18n

5. **Stability & Error Handling:**
   - Unified platform detection logic
   - Enhanced error messages and fallback handling
   - Improved filename extraction (noise filtering)

### Future Expansion Points

**Platform Adapters:**
- Additional cloud storage platforms (based on API availability and compatibility)

**Rule Engine Enhancements:**
- More flexible renaming rule types
- Rule template save/share functionality

**Advanced Features:**
- History and undo functionality
- Batch task optimization

**Testing Gaps:**
- `quark-adapter.test.ts` requires Chrome extension mock environment
- Performance benchmarks not yet integrated in CI
- E2E tests expansion to all platforms (currently Quark only)
