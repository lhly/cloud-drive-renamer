import { BasePlatformAdapter } from '../base/adapter.interface';
import {
  PlatformName,
  FileItem,
  RenameResult,
  PlatformConfig,
  PageSyncResult,
} from '../../types/platform';
import { parseFileName } from '../../utils/helpers';
import { QuarkAPIError, getErrorMessage, isRetryableError } from './errors';
import { getPageScriptInjector } from './page-script-injector';
import { logger } from '../../utils/logger';

/**
 * 夸克网盘 API 响应格式
 */
interface QuarkAPIResponse<T = any> {
  status: number;
  code: number;
  message: string;
  timestamp: number;
  data: T;
}

/**
 * 夸克文件列表数据
 */
interface QuarkFileData {
  fid: string;
  file_name: string;
  pdir_fid: string;
  category: number;
  file_type: number;
  size: number;
  format_type: string;
  status: number;
  created_at: number;
  updated_at: number;
  dir: boolean;
  file: boolean;
}

/**
 * 夸克网盘平台适配器
 * 基于 2025-12-10 的 API 探索结果实现
 *
 * API 文档参考:
 * - Base URL: https://drive-pc.quark.cn/1/clouddrive
 * - 认证方式: Cookie-based (document.cookie)
 * - 速率限制: 800ms 间隔
 */
export class QuarkAdapter extends BasePlatformAdapter {
  readonly platform: PlatformName = 'quark';

  private static readonly FALLBACK_FILE_ICON_BG =
    'url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM1OTU5NTkiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMTQgMkg2YTIgMiAwIDAgMC0yIDJ2MTZhMiAyIDAgMCAwIDIgMmgxMmEyIDIgMCAwIDAgMi0yVjh6Ii8+PHBvbHlsaW5lIHBvaW50cz0iMTQgMiAxNCA4IDIwIDgiLz48L3N2Zz4=")';

  private baseURL = 'https://drive-pc.quark.cn/1/clouddrive';
  private lastRequestTime = 0;
  private iconBackgroundByExt = new Map<string, string>();

  constructor(config?: Partial<PlatformConfig>) {
    super({
      platform: 'quark',
      requestInterval: 800, // 夸克网盘推荐间隔
      maxRetries: 3,
      timeout: 30000,
      ...config,
    });
  }

  getCurrentDirectoryKey(): string {
    return this.getCurrentFolderId();
  }

  /**
   * 获取当前选中的文件列表
   * 从夸克网盘的 DOM 结构中提取选中文件信息
   */
  async getSelectedFiles(): Promise<FileItem[]> {
    try {
      // 查找所有选中的复选框
      const checkedItems = document.querySelectorAll('.ant-checkbox-checked');

      if (checkedItems.length === 0) {
        return [];
      }

      const files: FileItem[] = [];

      for (const checkbox of Array.from(checkedItems)) {
        // 找到包含文件信息的行
        const row = checkbox.closest('tr');
        if (!row) continue;

        // 提取文件信息
        const fileId = row.getAttribute('data-file-id') || '';
        const fileName = row.querySelector('.file-name')?.textContent?.trim() || '';
        const parentId = this.getCurrentFolderId();
        const sizeAttr = row.getAttribute('data-size');
        const mtimeAttr = row.getAttribute('data-mtime');

        // 过滤掉文件夹（只处理文件）
        const isDir = row.classList.contains('is-directory') ||
                      row.getAttribute('data-is-dir') === 'true';

        if (isDir) {
          continue;
        }

        const { ext } = parseFileName(fileName);

        files.push({
          id: fileId,
          name: fileName,
          ext: ext,
          parentId: parentId,
          size: sizeAttr ? parseInt(sizeAttr, 10) : 0,
          mtime: mtimeAttr ? parseInt(mtimeAttr, 10) : Date.now(),
        });
      }

      return files;
    } catch (error) {
      logger.error('Failed to get selected files:', error instanceof Error ? error : new Error(String(error)));
      throw new Error(`获取选中文件失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get all files in the current directory via API
   * This method bypasses DOM parsing and directly fetches from platform API
   * Used to solve the virtual scrolling file loss issue
   *
   * @param parentId Parent directory ID (optional, defaults to current directory)
   * @returns Complete file list
   */
  async getAllFiles(parentId?: string): Promise<FileItem[]> {
    try {
      logger.info('[QuarkAdapter] Fetching all files from API');

      const targetParentId = parentId || this.getCurrentFolderId();
      const allFiles: FileItem[] = [];
      let page = 1;
      const pageSize = 100;
      let hasMore = true;

      // Paginate through all files
      while (hasMore) {
        await this.rateLimit();

        const url = new URL(`${this.baseURL}/file/sort`);
        url.searchParams.set('pr', 'ucpro');
        url.searchParams.set('fr', 'pc');
        url.searchParams.set('pdir_fid', targetParentId);
        url.searchParams.set('_page', page.toString());
        url.searchParams.set('_size', pageSize.toString());
        url.searchParams.set('_fetch_total', '1');

        const response = await this.fetchWithTimeout(url.toString(), {
          method: 'GET',
          credentials: 'include',
        });

        const result: QuarkAPIResponse<{ list: QuarkFileData[] }> = await response.json();

        if (result.code !== 0 || !result.data?.list) {
          const errorMsg = getErrorMessage(result.code, result.message);
          throw new QuarkAPIError(result.code, errorMsg, result);
        }

        const pageFiles = result.data.list;

        // Include both files and folders (folders have empty extension)
        const files = pageFiles.map((item): FileItem => {
          const ext = item.file ? parseFileName(item.file_name).ext : '';
          return {
            id: item.fid,
            name: item.file_name,
            ext,
            parentId: item.pdir_fid,
            size: item.size,
            mtime: item.updated_at,
          };
        });

        allFiles.push(...files);

        // Check if there are more pages
        hasMore = pageFiles.length === pageSize;
        page++;

        logger.debug(`[QuarkAdapter] Fetched page ${page - 1} with ${files.length} files`);
      }

      logger.info(`[QuarkAdapter] Successfully fetched ${allFiles.length} files`);
      return allFiles;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to get all files:', errorObj);
      throw new Error(`获取文件列表失败: ${errorObj.message}`);
    }
  }

  /**
   * 重命名文件
   * 调用夸克网盘的重命名 API，支持自动重试
   *
   * @param fileId 文件唯一标识符 (fid)
   * @param newName 新文件名
   * @returns 重命名结果
   */
  async renameFile(fileId: string, newName: string): Promise<RenameResult> {
    return this.retryableRequest(async () => {
      // 执行速率限制
      await this.rateLimit();

      // 获取父目录 ID（可能是必需参数）
      const parentId = this.getCurrentFolderId();

      // 使用页面脚本注入器调用API（解决Cookie认证问题）
      const injector = getPageScriptInjector();
      const requestBody: any = {
        fid: fileId,
        file_name: newName,
      };

      // 添加可能需要的额外参数
      if (parentId && parentId !== '0') {
        requestBody.pdir_fid = parentId;
      }

      const result: QuarkAPIResponse = await injector.callAPI(
        'POST',
        `${this.baseURL}/file/rename`,
        requestBody,
        this.config.timeout
      );

      if (result.code === 0 && result.status === 200) {
        return {
          success: true,
          newName: newName,
        };
      } else {
        const errorMsg = getErrorMessage(result.code, result.message);
        throw new QuarkAPIError(result.code, errorMsg, result);
      }
    }, `重命名文件 ${fileId}`);
  }

  /**
   * 同步页面文件列表，避免用户必须刷新才能看到新文件名
   * - 优先尝试触发夸克页面自身的刷新（若可找到刷新按钮）
   * - 兜底：对当前可见列表做 DOM 回写，并短时间监听后续渲染补丁
   */
  async syncAfterRename(
    renames: Array<{ fileId: string; oldName?: string; newName: string }>
  ): Promise<PageSyncResult> {
    const renameInfoById = new Map<string, { oldName?: string; newName: string }>();
    const renameByOldName = new Map<string, string>();

    for (const item of renames) {
      if (!item?.fileId || !item?.newName) continue;
      renameInfoById.set(item.fileId, { oldName: item.oldName, newName: item.newName });
      if (item.oldName) {
        renameByOldName.set(item.oldName, item.newName);
      }
    }

    if (renameInfoById.size === 0) {
      return { success: true, method: 'none' };
    }

    // Always patch visible DOM for immediate feedback
    const patchedById = this.applyRenameMappingToDomById(renameInfoById);
    const patchedByOldName = this.applyRenameMappingToDomByOldName(renameByOldName);
    const patchedCount = patchedById + patchedByOldName;

    this.observeAndPatchRenamedRows(renameInfoById, renameByOldName, 15000);

    // Best effort: trigger Quark's own re-render so it can rebuild native filename DOM (icon/wrap/etc.)
    const rerender = await this.tryTriggerNativeFileListRerender(renameInfoById);

    if (rerender.triggered) {
      return { success: true, method: 'ui-refresh', message: rerender.message };
    }

    if (patchedCount > 0) {
      return { success: true, method: 'dom-patch', message: `patched ${patchedCount} nodes` };
    }

    return {
      success: false,
      method: 'none',
      message: 'failed to locate filename nodes on page',
    };
  }

  private async tryTriggerNativeFileListRerender(
    renameInfoById: Map<string, { oldName?: string; newName: string }>
  ): Promise<{ triggered: boolean; message: string }> {
    try {
      // 1) Try Quark's "refresh" UI first (no sort side effects)
      const refreshStrategy = this.tryTriggerFileListRefresh();
      if (refreshStrategy) {
        const verified = await this.waitForAnyRenamedRowToHaveNativeStructure(renameInfoById, 2500);
        return {
          triggered: true,
          message: `triggered refresh (${refreshStrategy})${verified ? ', native structure detected' : ''}`,
        };
      }

      // 2) Fallback: toggle sort to force list reload (/file/sort)
      const sortToggled = await this.tryTriggerSortToggleRefresh();
      if (sortToggled) {
        const verified = await this.waitForAnyRenamedRowToHaveNativeStructure(renameInfoById, 2500);
        return {
          triggered: true,
          message: `triggered sort toggle${verified ? ', native structure detected' : ''}`,
        };
      }

      // 3) Last resort: nudge router state (best-effort)
      const routeNudged = this.tryTriggerRouteNudgeRefresh();
      if (routeNudged) {
        const verified = await this.waitForAnyRenamedRowToHaveNativeStructure(renameInfoById, 2500);
        return {
          triggered: true,
          message: `triggered route nudge${verified ? ', native structure detected' : ''}`,
        };
      }

      return { triggered: false, message: 'no native rerender trigger matched' };
    } catch (error) {
      logger.debug('[QuarkAdapter] Failed to trigger native rerender:', error instanceof Error ? error : new Error(String(error)));
      return { triggered: false, message: 'native rerender trigger failed' };
    }
  }

  private tryTriggerFileListRefresh(): 'icon' | 'label' | 'text' | null {
    try {
      const root = this.getFileListSearchRoot();

      // 1) Common: refresh/reload icon (Ant Design + custom)
      const icon = root.querySelector(
        '.anticon-reload, .anticon-sync, [data-icon="reload"], [data-icon="sync"], .icon-refresh, .icon-reload'
      ) as HTMLElement | null;
      if (icon) {
        this.dispatchSyntheticClick(icon);
        return 'icon';
      }

      // 2) Title / aria-label on any element (not necessarily a button)
      const byLabel = root.querySelector(
        '[title*="刷新"],[title*="refresh"],[aria-label*="刷新"],[aria-label*="refresh"]'
      ) as HTMLElement | null;
      if (byLabel) {
        this.dispatchSyntheticClick(byLabel);
        return 'label';
      }

      // 3) Text content match (strict to avoid false positives)
      const candidates = Array.from(
        root.querySelectorAll('button,[role="button"],a,span,div')
      ) as HTMLElement[];
      const textMatch = candidates.find((el) => {
        const text = (el.textContent || '').trim();
        if (!text) return false;
        return text === '刷新' || text.toLowerCase() === 'refresh';
      });
      if (textMatch) {
        this.dispatchSyntheticClick(textMatch);
        return 'text';
      }

      return null;
    } catch (error) {
      logger.debug('[QuarkAdapter] Failed to trigger list refresh:', error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }

  private getFileListSearchRoot(): ParentNode {
    const tableWrapper =
      (document.querySelector('.ant-table-wrapper') as HTMLElement | null) ||
      ((document.querySelector('.ant-table') as HTMLElement | null)?.closest('.ant-table-wrapper') as HTMLElement | null);

    // Search near the file list first to avoid picking unrelated "refresh" UI
    if (tableWrapper?.parentElement) {
      return tableWrapper.parentElement;
    }

    return document;
  }

  private dispatchSyntheticClick(el: HTMLElement): void {
    try {
      el.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window,
        })
      );
    } catch {
      // Fallback: best-effort
      el.click();
    }
  }

  private async tryTriggerSortToggleRefresh(): Promise<boolean> {
    try {
      const thead = document.querySelector('.ant-table-thead') as HTMLElement | null;
      if (!thead) return false;

      const ths = Array.from(thead.querySelectorAll('th')) as HTMLElement[];
      if (ths.length === 0) return false;

      // Prefer the currently-sorted column; fallback to any sortable column.
      const best =
        ths.find((th) => th.classList.contains('ant-table-column-sort') || !!th.getAttribute('aria-sort')) ||
        ths.find((th) => !!th.querySelector('.ant-table-column-sorters,.ant-table-column-sorter')) ||
        null;
      if (!best) return false;

      const clickTarget =
        (best.querySelector('.ant-table-column-sorters') as HTMLElement | null) ||
        (best.querySelector('.ant-table-column-sorter') as HTMLElement | null) ||
        best;

      const initial = this.getSortState(best);

      // Click at least once to trigger the list reload (observed as /file/sort XHR).
      this.dispatchSyntheticClick(clickTarget);
      await this.delayMs(250);

      // Restore to initial state (antd cycles: ascend -> descend -> none -> ascend)
      for (let i = 0; i < 3; i++) {
        if (this.getSortState(best) === initial) break;
        this.dispatchSyntheticClick(clickTarget);
        await this.delayMs(250);
      }

      return true;
    } catch (error) {
      logger.debug('[QuarkAdapter] Failed to toggle sort for refresh:', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  private tryTriggerRouteNudgeRefresh(): boolean {
    try {
      const url = new URL(window.location.href);
      const key = '__cdr_sync';
      const previous = url.searchParams.get(key);
      url.searchParams.set(key, String(Date.now()));

      history.replaceState(history.state, '', url.toString());
      window.dispatchEvent(new PopStateEvent('popstate', { state: history.state }));

      window.setTimeout(() => {
        try {
          const next = new URL(window.location.href);
          if (previous === null) {
            next.searchParams.delete(key);
          } else {
            next.searchParams.set(key, previous);
          }
          history.replaceState(history.state, '', next.toString());
          window.dispatchEvent(new PopStateEvent('popstate', { state: history.state }));
        } catch {
          // ignore
        }
      }, 500);

      return true;
    } catch (error) {
      logger.debug('[QuarkAdapter] Failed to nudge route for refresh:', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  private getSortState(th: Element): string {
    const aria = th.getAttribute('aria-sort');
    if (aria) return aria;
    if (th.classList.contains('ant-table-column-sort')) return 'sorted';
    return 'none';
  }

  private async waitForAnyRenamedRowToHaveNativeStructure(
    renameInfoById: Map<string, { oldName?: string; newName: string }>,
    timeoutMs: number
  ): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (this.hasAnyRenamedRowNativeFilenameStructure(renameInfoById)) {
        return true;
      }
      await this.delayMs(200);
    }
    return false;
  }

  private hasAnyRenamedRowNativeFilenameStructure(
    renameInfoById: Map<string, { oldName?: string; newName: string }>
  ): boolean {
    for (const [fileId, info] of renameInfoById.entries()) {
      const row = this.findRowByFileId(fileId);
      if (!row) continue;

      const filenameEl = row.querySelector('.filename') as HTMLElement | null;
      if (!filenameEl) continue;

      if (!filenameEl.querySelector('.file-click-wrap,.filename-text,.file-icon')) continue;

      const text = (filenameEl.textContent || '').trim();
      if (text && text.includes(info.newName)) {
        return true;
      }
    }
    return false;
  }

  private findRowByFileId(fileId: string): Element | null {
    const escaped = this.escapeForAttributeSelector(fileId);
    const selectors = [
      `tr[data-row-key="${escaped}"]`,
      `tr[data-file-id="${escaped}"]`,
      `tr[data-fid="${escaped}"]`,
      `[data-row-key="${escaped}"]`,
      `[data-file-id="${escaped}"]`,
      `[data-fid="${escaped}"]`,
      `[data-id="${escaped}"]`,
      `[data-key="${escaped}"]`,
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) return el.closest('tr,[role="row"],.ant-table-row,.file-item,.list-item') || el;
    }

    return null;
  }

  private delayMs(ms: number): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  private applyRenameMappingToDomById(
    renameInfoById: Map<string, { oldName?: string; newName: string }>
  ): number {
    let patched = 0;

    const idAttrSelectors = [
      '[data-file-id]',
      '[data-fid]',
      '[data-row-key]',
      '[data-key]',
      '[data-id]',
    ].join(',');

    const nodes = Array.from(document.querySelectorAll(idAttrSelectors));

    for (const node of nodes) {
      const fileId =
        node.getAttribute('data-file-id') ||
        node.getAttribute('data-fid') ||
        node.getAttribute('data-row-key') ||
        node.getAttribute('data-key') ||
        node.getAttribute('data-id');

      if (!fileId) continue;

      const info = renameInfoById.get(fileId);
      if (!info) continue;

      const row = node.closest('tr,[role="row"],.ant-table-row,.file-item,.list-item') || node;
      patched += this.patchRowElement(row, info.oldName, info.newName);
    }

    return patched;
  }

  private applyRenameMappingToDomByOldName(renameByOldName: Map<string, string>): number {
    if (renameByOldName.size === 0) return 0;

    let patched = 0;

    // Prefer patching within elements that explicitly reference the old name (keeps native DOM structure)
    for (const [oldName, newName] of renameByOldName.entries()) {
      const escaped = this.escapeForAttributeSelector(oldName);
      const candidates = Array.from(
        document.querySelectorAll(`[title="${escaped}"],[aria-label="${escaped}"]`)
      );

      for (const el of candidates) {
        patched += this.patchStructuredNameWithinElement(el, oldName, newName);
      }
    }

    // Fallback: patch plain text nodes (works if the whole filename is a single text node)
    patched += this.patchExactTextInElement(document.body, renameByOldName);

    // Keep tooltip attributes in sync (do not touch textContent to avoid breaking native structure)
    this.patchAttributesInElement(document.body, renameByOldName, 'title');
    this.patchAttributesInElement(document.body, renameByOldName, 'aria-label');

    return patched;
  }

  private observeAndPatchRenamedRows(
    renameInfoById: Map<string, { oldName?: string; newName: string }>,
    renameByOldName: Map<string, string>,
    timeoutMs: number
  ): void {
    try {
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of Array.from(mutation.addedNodes)) {
            if (!(node instanceof Element)) continue;
            this.patchElementTree(node, renameInfoById, renameByOldName);
          }
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });

      // Also patch current document (in case list is already rendered)
      this.patchElementTree(document.body, renameInfoById, renameByOldName);

      window.setTimeout(() => observer.disconnect(), timeoutMs);
    } catch (error) {
      logger.debug('[QuarkAdapter] Failed to observe DOM for patching:', error instanceof Error ? error : new Error(String(error)));
    }
  }

  private patchElementTree(
    root: Element,
    renameInfoById: Map<string, { oldName?: string; newName: string }>,
    renameByOldName: Map<string, string>
  ): void {
    // 1) Patch by file id attributes if present in this subtree
    const idAttrSelectors = [
      '[data-file-id]',
      '[data-fid]',
      '[data-row-key]',
      '[data-key]',
      '[data-id]',
    ].join(',');

    const nodes: Element[] = [];
    if (root.matches(idAttrSelectors)) {
      nodes.push(root);
    }
    nodes.push(...Array.from(root.querySelectorAll(idAttrSelectors)));

    for (const node of nodes) {
      const fileId =
        node.getAttribute('data-file-id') ||
        node.getAttribute('data-fid') ||
        node.getAttribute('data-row-key') ||
        node.getAttribute('data-key') ||
        node.getAttribute('data-id');
      if (!fileId) continue;

      const info = renameInfoById.get(fileId);
      if (!info) continue;

      const row = node.closest('tr,[role="row"],.ant-table-row,.file-item,.list-item') || node;
      this.patchRowElement(row, info.oldName, info.newName);
    }

    // 2) Patch by old filename text/title within this subtree (virtual scrolling)
    if (renameByOldName.size > 0) {
      for (const [oldName, newName] of renameByOldName.entries()) {
        const escaped = this.escapeForAttributeSelector(oldName);
        const candidates = Array.from(
          root.querySelectorAll(`[title="${escaped}"],[aria-label="${escaped}"]`)
        );
        for (const el of candidates) {
          this.patchStructuredNameWithinElement(el, oldName, newName);
        }
      }

      this.patchExactTextInElement(root, renameByOldName);
      this.patchAttributesInElement(root, renameByOldName, 'title');
      this.patchAttributesInElement(root, renameByOldName, 'aria-label');
    }
  }

  private patchRowElement(row: Element, oldName: string | undefined, newName: string): number {
    let textPatched = 0;

    if (oldName) {
      textPatched += this.patchStructuredNameWithinElement(row, oldName, newName);
      if (textPatched > 0) {
        this.decoratePlainFilenameIfNeeded(row, newName);
        return textPatched;
      }
    }

    const nameEl = row.querySelector(
      '.file-name,.filename,[class*="file-name"],[class*="fileName"],[class*="filename"]'
    ) as HTMLElement | null;

    if (nameEl) {
      // Avoid clobbering native DOM structure (icons, ellipsis wrappers, etc.).
      // Prefer patching text nodes; only set textContent on leaf nodes.
      if (oldName) {
        textPatched += this.patchStructuredNameWithinElement(nameEl, oldName, newName);
      }

      if (textPatched === 0 && nameEl.children.length === 0 && nameEl.textContent?.trim() !== newName) {
        nameEl.textContent = newName;
        textPatched++;
      }

      if (nameEl.getAttribute('title')) {
        nameEl.setAttribute('title', newName);
      }
    }

    this.decoratePlainFilenameIfNeeded(row, newName);
    return textPatched;
  }

  private patchStructuredNameWithinElement(root: Element, oldName: string, newName: string): number {
    const fullMap = new Map([[oldName, newName]]);
    let patched = this.patchExactTextInElement(root, fullMap);

    // If the UI renders base name / extension in separate nodes, patch them separately.
    if (patched === 0) {
      const oldParts = parseFileName(oldName);
      const newParts = parseFileName(newName);

      const partsMap = new Map<string, string>();
      if (oldParts.name && oldParts.name !== newParts.name) {
        partsMap.set(oldParts.name, newParts.name);
      }
      if (oldParts.ext && oldParts.ext !== newParts.ext) {
        partsMap.set(oldParts.ext, newParts.ext);
      }

      if (partsMap.size > 0) {
        patched += this.patchExactTextInElement(root, partsMap);
      }
    }

    // Keep tooltip attributes in sync (safe, no DOM structure changes)
    this.patchAttributesInElement(root, fullMap, 'title');
    this.patchAttributesInElement(root, fullMap, 'aria-label');

    return patched;
  }

  /**
   * Some Quark rows render filename with rich DOM (icon + filename-text).
   * If our patch lands on a plain `.filename` node (no icon wrapper), it looks "gray" and inconsistent.
   * Add a lightweight, scoped style to make plain nodes visually closer to native:
   * - force text color to normal
   * - prepend a native-like icon via CSS variable (best-effort)
   */
  private decoratePlainFilenameIfNeeded(row: Element, fileName: string): void {
    const filenameEl = row.querySelector('.filename') as HTMLElement | null;
    if (!filenameEl) return;

    // Native structure exists -> do nothing.
    if (filenameEl.querySelector('.file-click-wrap,.filename-text,.file-icon')) return;

    // Only decorate simple text-only nodes (avoid interfering with other complex layouts).
    if (filenameEl.children.length !== 0) return;

    this.ensurePlainFilenameStyleInjected();

    filenameEl.classList.add('cdr-quark-filename-patched');
    const { ext } = parseFileName(fileName);
    const iconBg = this.getBestIconBackgroundImageForExt(ext);
    if (iconBg) {
      filenameEl.style.setProperty('--cdr-quark-file-icon', iconBg);
    }
  }

  private ensurePlainFilenameStyleInjected(): void {
    const styleId = 'cloud-drive-renamer-quark-filename-patch-style';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .cdr-quark-filename-patched {
        display: inline-flex !important;
        align-items: center !important;
        gap: 8px !important;
        color: #262626 !important;
        font-weight: 400 !important;
        padding-right: 24px !important;
      }
      .cdr-quark-filename-patched::before {
        content: "" !important;
        width: 16px !important;
        height: 16px !important;
        border-radius: 4px !important;
        flex: 0 0 auto !important;
        background-color: #f5f5f5 !important;
        background-image: var(--cdr-quark-file-icon) !important;
        background-size: cover !important;
        background-position: center !important;
        background-repeat: no-repeat !important;
        pointer-events: none !important;
      }
    `;

    (document.head || document.documentElement).appendChild(style);
  }

  private getBestIconBackgroundImageForExt(ext: string): string | null {
    const normalizedExt = (ext || '').toLowerCase();
    if (!normalizedExt) {
      return this.getAnyIconBackgroundImage();
    }

    const cached = this.iconBackgroundByExt.get(normalizedExt);
    if (cached) return cached;

    const iconForExt = this.findNativeIconBackgroundImageByExtCandidates([normalizedExt]);
    if (iconForExt) {
      this.iconBackgroundByExt.set(normalizedExt, iconForExt);
      return iconForExt;
    }

    // Category fallback (better than random icons: avoid showing music icon on video etc.)
    const categoryCandidates = this.getCategoryFallbackExtensions(normalizedExt);
    if (categoryCandidates.length > 0) {
      const iconForCategory = this.findNativeIconBackgroundImageByExtCandidates(categoryCandidates);
      if (iconForCategory) {
        this.iconBackgroundByExt.set(normalizedExt, iconForCategory);
        return iconForCategory;
      }
    }

    const fallback = this.getAnyIconBackgroundImage();
    this.iconBackgroundByExt.set(normalizedExt, fallback);
    return fallback;
  }

  private findNativeIconBackgroundImageByExtCandidates(extCandidates: string[]): string | null {
    const unique = Array.from(new Set(extCandidates.map((e) => (e || '').toLowerCase()).filter(Boolean)));
    if (unique.length === 0) return null;

    const filenameTextEls = Array.from(document.querySelectorAll('.filename-text')) as HTMLElement[];
    for (const el of filenameTextEls) {
      const name = (el.getAttribute('title') || el.textContent || '').trim();
      if (!name) continue;

      const lower = name.toLowerCase();
      const hit = unique.some((candidate) => lower.endsWith(candidate));
      if (!hit) continue;

      const row = el.closest('tr,[role="row"]');
      const iconDiv = row?.querySelector('.file-icon > div') as HTMLElement | null;
      if (!iconDiv) continue;

      const bg = getComputedStyle(iconDiv).backgroundImage;
      if (!bg || bg === 'none') continue;

      return bg;
    }

    return null;
  }

  private getCategoryFallbackExtensions(ext: string): string[] {
    const video = ['.mp4', '.mkv', '.mov', '.avi', '.wmv', '.flv', '.webm', '.m4v'];
    const audio = ['.mp3', '.wav', '.flac', '.aac', '.m4a', '.ogg', '.wma'];
    const image = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.webp', '.ico'];
    const doc = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.md'];

    const lower = (ext || '').toLowerCase();
    if (video.includes(lower)) return video;
    if (audio.includes(lower)) return audio;
    if (image.includes(lower)) return image;
    if (doc.includes(lower)) return doc;
    return [];
  }

  private getAnyIconBackgroundImage(): string {
    const iconDiv = document.querySelector('.file-icon > div') as HTMLElement | null;
    if (!iconDiv) return QuarkAdapter.FALLBACK_FILE_ICON_BG;
    const bg = getComputedStyle(iconDiv).backgroundImage;
    return bg && bg !== 'none' ? bg : QuarkAdapter.FALLBACK_FILE_ICON_BG;
  }

  private escapeForAttributeSelector(value: string): string {
    return value
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\f/g, '\\f');
  }

  private patchExactTextInElement(root: Node, renameByOldName: Map<string, string>): number {
    if (renameByOldName.size === 0) return 0;

    let patched = 0;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        const text = node.nodeValue?.trim();
        if (!text) return NodeFilter.FILTER_SKIP;
        return renameByOldName.has(text) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      },
    });

    let node: Node | null;
    while ((node = walker.nextNode())) {
      const oldText = node.nodeValue?.trim();
      if (!oldText) continue;
      const next = renameByOldName.get(oldText);
      if (!next) continue;
      if (node.nodeValue !== next) {
        node.nodeValue = next;
        patched++;
      }

      const parent = node.parentElement;
      if (parent) {
        if (parent.getAttribute('title') === oldText) parent.setAttribute('title', next);
        if (parent.getAttribute('aria-label') === oldText) parent.setAttribute('aria-label', next);
      }
    }

    return patched;
  }

  private patchAttributesInElement(
    root: Element,
    renameByOldName: Map<string, string>,
    attributeName: 'title' | 'aria-label'
  ): number {
    if (renameByOldName.size === 0) return 0;

    let patched = 0;
    const nodes = Array.from(root.querySelectorAll(`[${attributeName}]`));
    for (const node of nodes) {
      const value = node.getAttribute(attributeName);
      if (!value) continue;
      const next = renameByOldName.get(value);
      if (!next) continue;

      if (value !== next) {
        node.setAttribute(attributeName, next);
        patched++;
      }
    }
    return patched;
  }

  /**
   * 检查文件名是否存在冲突
   * 通过获取当前目录的文件列表来检查同名文件
   *
   * @param fileName 要检查的文件名
   * @param parentId 父目录 ID
   * @returns 是否存在同名文件
   */
  async checkNameConflict(fileName: string, parentId: string): Promise<boolean> {
    try {
      await this.rateLimit();

      const url = new URL(`${this.baseURL}/file/sort`);
      url.searchParams.set('pr', 'ucpro');
      url.searchParams.set('fr', 'pc');
      url.searchParams.set('pdir_fid', parentId);
      url.searchParams.set('_page', '1');
      url.searchParams.set('_size', '100');
      url.searchParams.set('_fetch_total', '1');

      const response = await this.fetchWithTimeout(url.toString(), {
        method: 'GET',
        credentials: 'include',
      });

      const result: QuarkAPIResponse<{ list: QuarkFileData[] }> = await response.json();

      if (result.code === 0 && result.data?.list) {
        // 检查是否存在同名文件
        return result.data.list.some(file => file.file_name === fileName);
      }

      return false;
    } catch (error) {
      logger.error('Failed to check name conflict:', error instanceof Error ? error : new Error(String(error)));
      // 出错时保守处理，返回可能存在冲突
      return true;
    }
  }

  /**
   * 获取文件详细信息
   * 用于幂等性检查和状态验证
   *
   * @param fileId 文件 ID
   * @returns 文件详细信息
   */
  async getFileInfo(fileId: string): Promise<FileItem> {
    try {
      await this.rateLimit();

      // 注意: 夸克 API 可能没有单独的文件详情接口
      // 这里需要通过文件列表 API 来查找特定文件
      // 或者从 DOM 中提取

      // 尝试从 DOM 中查找文件信息
      const row = document.querySelector(`tr[data-file-id="${fileId}"]`);

      if (!row) {
        throw new Error(`找不到文件 ID: ${fileId}`);
      }

      const fileName = row.querySelector('.file-name')?.textContent?.trim() || '';
      const parentId = this.getCurrentFolderId();
      const sizeAttr = row.getAttribute('data-size');
      const mtimeAttr = row.getAttribute('data-mtime');
      const { ext } = parseFileName(fileName);

      return {
        id: fileId,
        name: fileName,
        ext: ext,
        parentId: parentId,
        size: sizeAttr ? parseInt(sizeAttr, 10) : 0,
        mtime: mtimeAttr ? parseInt(mtimeAttr, 10) : Date.now(),
      };
    } catch (error) {
      logger.error(`Failed to get file info for ${fileId}:`, error instanceof Error ? error : new Error(String(error)));
      throw new Error(`获取文件信息失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 从当前页面 URL 或 DOM 中提取当前文件夹 ID
   * @private
   */
  private getCurrentFolderId(): string {
    // 尝试从 URL 中提取
    const urlParams = new URLSearchParams(window.location.search);
    const dirId = urlParams.get('dir_id') || urlParams.get('pdir_fid');

    if (dirId) {
      return dirId;
    }

    // 夸克网盘使用 hash 路由 (例如: #/list/folder/12345 或 #/list/all/12345-xxxx)
    // 支持嵌套路径: #/list/all/parent-name/child1-name/child2-name
    const hash = window.location.hash || '';
    if (hash) {
      // Remove query string portion in hash (if any)
      const hashPath = hash.split('?')[0];

      // 🔧 FIX: 提取整个路径，取最后一个 segment（当前目录）
      // 移除前缀 #/list/folder/ 或 #/list/all/
      const normalized = hashPath
        .replace(/^#/, '')
        .replace(/^\/list\/(?:all|folder)/, '')
        .replace(/^\/+/, '')
        .replace(/\/+$/, '');

      if (normalized) {
        // 分割路径，取最后一个 segment（当前目录）
        const segments = normalized.split('/').filter(Boolean);
        if (segments.length > 0) {
          const lastSegment = segments[segments.length - 1];
          // 提取 ID（-之前的部分）
          // 例如: "e1446ca1c77f4061b470c07961369e2d-第一章：机器学习与深度学习理论基础"
          //   -> "e1446ca1c77f4061b470c07961369e2d"
          const idMatch = lastSegment.match(/^([a-z0-9]+)/);
          if (idMatch && idMatch[1]) {
            return idMatch[1];
          }
        }
      }
    }

    // 尝试从 DOM 中提取
    const dirElement = document.querySelector('[data-dir-id]');
    if (dirElement) {
      const domDirId = dirElement.getAttribute('data-dir-id');
      if (domDirId) {
        return domDirId;
      }
    }

    // 默认返回根目录标识
    return '0';
  }

  /**
   * 速率限制
   * 确保请求间隔不小于配置的 requestInterval
   * @private
   */
  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.config.requestInterval) {
      const delay = this.config.requestInterval - timeSinceLastRequest;
      await this.sleep(delay);
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * 带重试机制的请求包装器
   * @param requestFn 请求函数
   * @param operation 操作描述（用于日志）
   * @returns 请求结果
   * @private
   */
  private async retryableRequest<T extends RenameResult>(
    requestFn: () => Promise<T>,
    operation: string
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const result = await requestFn();
        return result;
      } catch (error) {
        lastError = error;

        // 判断是否可以重试
        if (!isRetryableError(error)) {
          logger.error(`${operation} 失败（不可重试）:`, error instanceof Error ? error : new Error(String(error)));
          break;
        }

        // 最后一次尝试失败，不再重试
        if (attempt === this.config.maxRetries) {
          logger.error(`${operation} 失败（已达最大重试次数 ${this.config.maxRetries}）:`, error instanceof Error ? error : new Error(String(error)));
          break;
        }

        // 计算指数退避延迟
        const backoffDelay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        logger.warn(
          `${operation} 失败（第 ${attempt}/${this.config.maxRetries} 次尝试），` +
          `${backoffDelay}ms 后重试:`,
          error instanceof Error ? error : new Error(String(error))
        );
        await this.sleep(backoffDelay);
      }
    }

    // 所有重试都失败，返回失败结果
    return {
      success: false,
      error: lastError instanceof Error ? lastError : new Error(String(lastError)),
    } as T;
  }
}
