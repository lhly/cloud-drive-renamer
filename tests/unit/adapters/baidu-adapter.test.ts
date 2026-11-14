import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BaiduAdapter } from '../../../src/adapters/baidu/baidu-adapter';
import { getPageScriptInjector } from '../../../src/adapters/baidu/page-script-injector';
import { configureLoggerDiagnostics } from '../../../src/utils/logger';
import type { DiagnosticLogEntry } from '../../../src/types/diagnostic';
import { ConflictDetector } from '../../../src/core/conflict-detector';

vi.mock('../../../src/adapters/baidu/page-script-injector', () => ({
  getPageScriptInjector: vi.fn(),
}));

const TOKEN = 'private-test-token';
const FILE_ID = 1700000000123456;
const TASK_ID = 1700000000987654;

function listItem(path: string, name = 'a.txt', id = FILE_ID) {
  return {
    path, server_filename: name, fs_id: id, md5: 'x',
    isdir: 0, size: 10, server_mtime: 1700000000,
  };
}

describe('BaiduAdapter', () => {
  let adapter: BaiduAdapter;
  let entries: DiagnosticLogEntry[];
  const fetchList = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>();
  const callAPI = vi.fn<[string, string, Record<string, string>, number], Promise<unknown>>();

  function listResponse(...items: Array<Partial<ReturnType<typeof listItem>>>) {
    fetchList.mockResolvedValueOnce(new Response(JSON.stringify({ errno: 0, list: items })));
  }

  const submittedFiles = () => callAPI.mock.calls
    .filter(([, url]) => new URL(url).pathname === '/api/filemanager')
    .map(([, , body]) => JSON.parse(body.filelist));

  beforeEach(() => {
    fetchList.mockReset();
    callAPI.mockReset();
    vi.stubGlobal('fetch', fetchList);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.mocked(getPageScriptInjector).mockReturnValue({
      getBdstoken: vi.fn().mockResolvedValue(TOKEN),
      callAPI,
    } as unknown as ReturnType<typeof getPageScriptInjector>);
    window.history.replaceState({}, '', '/disk/main');
    document.body.replaceChildren();
    adapter = new BaiduAdapter({ requestInterval: 0 });
    entries = [];
    configureLoggerDiagnostics({ source: 'content', transport: (entry) => { entries.push(entry); } });

    callAPI.mockImplementation(async (_method, url) => new URL(url).pathname === '/api/filemanager'
      ? { errno: 0, taskid: TASK_ID }
      : { errno: 0, taskid: TASK_ID, status: 'success' });
  });

  afterEach(() => {
    configureLoggerDiagnostics(null);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  async function rename(id = FILE_ID, name = 'b.txt') {
    const result = adapter.renameFile(String(id), name);
    await vi.runAllTimersAsync();
    return result;
  }

  it('支持 /api/list 顶层 list，保持 FileItem 的父目录与过滤语义', async () => {
    listResponse(listItem('/test/a.txt'), { ...listItem('/test/folder', 'folder', 2), isdir: 1 });

    await expect(adapter.getAllFiles('/test')).resolves.toEqual([{
      id: String(FILE_ID), name: 'a.txt', ext: '.txt', parentId: '/test',
      size: 10, mtime: 1700000000 * 1000,
    }]);
  });

  it('根目录不拼出双斜杠，也不使用页面中的旧文件名', async () => {
    document.body.innerHTML = `<div data-fs-id="${FILE_ID}"><a title="stale.txt"></a></div>`;
    listResponse(listItem('/a.txt'));
    await adapter.getAllFiles();

    expect(await rename()).toEqual({ success: true, newName: 'b.txt' });
    expect(submittedFiles()).toEqual([[{ id: FILE_ID, path: '/a.txt', newname: 'b.txt' }]]);
  });

  it.each(['?path=', '#/index?path='])('子目录 (%s) 中页面行缺失也使用服务端完整路径', async (route) => {
    const directory = '/第 1 集+100%25';
    window.history.replaceState({}, '', `/disk/main${route}${encodeURIComponent(directory)}`);
    const serverPath = `${directory}/a %2B.txt`;
    listResponse(listItem(serverPath, 'a %2B.txt'));
    await adapter.getAllFiles();

    expect(await rename()).toMatchObject({ success: true });
    expect(new URL(String(fetchList.mock.calls[0][0])).searchParams.get('dir')).toBe(directory);
    expect(submittedFiles()).toEqual([[{ id: FILE_ID, path: serverPath, newname: 'b.txt' }]]);
    expect(fetchList).toHaveBeenCalledTimes(1);
  });

  it('撤销按同一个 ID 获取改名后的路径，全程无需 DOM', async () => {
    const dir = '/第 1 集+100%25';
    window.history.replaceState({}, '', `/disk/main#/index?path=${encodeURIComponent(dir)}`);
    listResponse(listItem(`${dir}/a.txt`));
    await adapter.getAllFiles();
    expect(await rename()).toMatchObject({ success: true });

    // The native refresh round-trip re-serializes the fragment with URLSearchParams.
    const params = new URLSearchParams({ path: dir, __cdr_sync: '1' });
    window.history.replaceState({}, '', `/disk/main#/index?${params}`);
    expect(adapter.getCurrentDirectoryKey()).toBe(dir);
    listResponse(listItem(`${dir}/b.txt`, 'b.txt'));
    expect(await rename(FILE_ID, 'a.txt')).toMatchObject({ success: true });
    expect(submittedFiles()).toEqual([
      [{ id: FILE_ID, path: `${dir}/a.txt`, newname: 'b.txt' }],
      [{ id: FILE_ID, path: `${dir}/b.txt`, newname: 'a.txt' }],
    ]);
    expect(fetchList).toHaveBeenCalledTimes(2);
  });

  it.each([undefined, '', 'a.txt', '/other/a.txt'])('补查后没有可靠路径 (%s) 时不提交', async (path) => {
    listResponse({ ...listItem('/a.txt'), path });
    const result = await rename();

    expect(result).toMatchObject({ success: false });
    expect(result.error?.message).toContain('重新加载');
    expect(fetchList).toHaveBeenCalledTimes(1);
    expect(callAPI).not.toHaveBeenCalled();
  });

  it('换目录后不使用旧目录缓存；找不到同一 ID 时也不使用 DOM', async () => {
    listResponse(listItem('/a.txt'));
    await adapter.getAllFiles();
    window.history.replaceState({}, '', '/disk/main?path=%2Fother');
    document.body.innerHTML = `<div data-id="${FILE_ID}"><a title="wrong.txt"></a></div>`;
    listResponse(listItem('/other/wrong.txt', 'wrong.txt', 2));

    expect(await rename()).toMatchObject({ success: false });
    expect(callAPI).not.toHaveBeenCalled();
  });

  it('补查过程中切换目录时不提交旧目录的写请求', async () => {
    fetchList.mockImplementationOnce(async () => {
      window.history.replaceState({}, '', '/disk/main?path=%2Fother');
      return new Response(JSON.stringify({ errno: 0, list: [listItem('/a.txt')] }));
    });

    expect(await rename()).toMatchObject({ success: false, error: { message: expect.stringContaining('目录已切换') } });
    expect(callAPI).not.toHaveBeenCalled();
  });

  it('并发补查只读取一次当前目录', async () => {
    listResponse(listItem('/a.txt'), listItem('/other.txt', 'other.txt', 2));
    const results = Promise.all([
      adapter.renameFile(String(FILE_ID), 'b.txt'),
      adapter.renameFile('2', 'renamed.txt'),
    ]);
    await vi.runAllTimersAsync();

    expect(await results).toEqual([
      { success: true, newName: 'b.txt' },
      { success: true, newName: 'renamed.txt' },
    ]);
    expect(fetchList).toHaveBeenCalledTimes(1);
  });

  it('恢复检查读取 API 上的文件名，找不到时不返回占位信息', async () => {
    listResponse(listItem('/current.txt', 'current.txt'));
    await expect(adapter.getFileInfo(String(FILE_ID))).resolves.toMatchObject({ name: 'current.txt' });

    listResponse();
    await expect(adapter.getFileInfo(String(FILE_ID))).rejects.toThrow('重新加载');
    expect(callAPI).not.toHaveBeenCalled();
  });

  it('任务终态失败只记脱敏字段，保留条目错误码及关联 ID', async () => {
    listResponse(listItem('/private-source-name.txt', 'private-source-name.txt'));
    await adapter.getAllFiles();
    callAPI.mockResolvedValueOnce({ errno: 0, taskid: TASK_ID })
      .mockResolvedValueOnce({ errno: 0, status: 'pending' })
      .mockResolvedValueOnce({
        errno: 0, status: 'failed', taskid: TASK_ID, path: '/private-source-name.txt',
        error: TOKEN, info: [{ errno: -9, path: '/private-source-name.txt' }, { errno: TOKEN }],
      });

    const result = await rename(FILE_ID, 'private-target-name.txt');
    expect(result).toMatchObject({ success: false, error: { message: '任务执行失败: failed' } });
    expect(submittedFiles()).toHaveLength(1);
    const accepted = entries.find((entry) => entry.message === 'Rename task accepted');
    const failed = entries.find((entry) => entry.message === 'Rename task failed');
    expect(accepted?.context?.args).toEqual([expect.objectContaining({
      operationId: expect.any(String), pathSource: 'api/list',
    })]);
    expect(failed?.context?.args).toEqual([expect.objectContaining({
      operationId: (accepted?.context?.args as Array<{ operationId: string }>)[0].operationId,
      pathSource: 'api/list', status: 'failed', errno: 0, itemErrnos: [-9], pollAttempts: 2,
    })]);
    for (const secret of [TOKEN, String(FILE_ID), String(TASK_ID), 'private-source-name', 'private-target-name']) {
      expect(JSON.stringify(entries)).not.toContain(secret);
    }
  });

  it('提交被拒绝和任务状态未知不会混淆；轮询出错不重发写请求', async () => {
    listResponse(listItem('/a.txt'));
    await adapter.getAllFiles();
    callAPI.mockResolvedValueOnce({ errno: -8, info: [{ errno: -8 }] });
    expect(await rename()).toMatchObject({ success: false });
    expect(entries.find((entry) => entry.message === 'Rename submission rejected')?.context?.args)
      .toEqual([expect.objectContaining({ errno: -8, itemErrnos: [-8] })]);
    expect(callAPI).toHaveBeenCalledTimes(1);

    callAPI.mockClear();
    callAPI.mockImplementation(async (_method, url) => new URL(url).pathname === '/api/filemanager'
      ? { errno: 0, taskid: TASK_ID }
      : { errno: 110 });
    const result = await rename();
    expect(result).toMatchObject({ success: false, error: { message: expect.stringContaining('结果未知') } });
    expect(submittedFiles()).toHaveLength(1);
    expect(entries.find((entry) => entry.message === 'Rename task outcome unknown')?.context?.args)
      .toEqual([expect.objectContaining({ reason: 'query-rejected', errno: 110, pollAttempts: 30 })]);
  });

  it('提交响应丢失时不盲重发，也不导出传输异常中的 URL', async () => {
    listResponse(listItem('/a.txt'));
    await adapter.getAllFiles();
    callAPI.mockRejectedValueOnce(new Error(`timeout: https://pan.baidu.com/api/filemanager?bdstoken=${TOKEN}`));

    expect(await rename()).toMatchObject({ success: false, error: { message: expect.stringContaining('提交结果未知') } });
    expect(submittedFiles()).toHaveLength(1);
    expect(entries.find((entry) => entry.message === 'Rename submission outcome unknown')?.context?.args)
      .toEqual([expect.objectContaining({ reason: 'request-error' })]);
    expect(JSON.stringify(entries)).not.toContain(TOKEN);
  });

  it.each(['提交响应丢失', '缺少任务 ID', '轮询结果未知'])('%s 后重试按同一 fs_id 回读，确认成功但不重发', async (failure) => {
    listResponse(listItem('/a.txt'));
    await adapter.getAllFiles();
    if (failure === '提交响应丢失') {
      callAPI.mockRejectedValueOnce(new Error('lost response'));
    } else if (failure === '缺少任务 ID') {
      callAPI.mockResolvedValueOnce({ errno: 0 });
    } else {
      callAPI.mockImplementation(async (_method, url) => new URL(url).pathname === '/api/filemanager'
        ? { errno: 0, taskid: TASK_ID }
        : { errno: 0, status: 'pending' });
    }

    expect(await rename()).toMatchObject({ success: false });
    listResponse(listItem('/b.txt', 'b.txt'));
    expect(await rename()).toEqual({ success: true, newName: 'b.txt' });
    expect(submittedFiles()).toHaveLength(1);
    expect(fetchList).toHaveBeenCalledTimes(2);

    // A confirmed rename can subsequently be undone normally.
    callAPI.mockResolvedValueOnce({ errno: 0, taskid: TASK_ID })
      .mockResolvedValueOnce({ errno: 0, status: 'success' });
    expect(await rename(FILE_ID, 'a.txt')).toMatchObject({ success: true });
    expect(submittedFiles()[1]).toEqual([{ id: FILE_ID, path: '/b.txt', newname: 'a.txt' }]);
  });

  it('回读仍是原名、同名条目 ID 不同或接口失败时保持未知，允许之后再次回读', async () => {
    listResponse(listItem('/a.txt'));
    await adapter.getAllFiles();
    callAPI.mockRejectedValueOnce(new Error('lost response'));
    expect(await rename()).toMatchObject({ success: false });

    for (const files of [[listItem('/a.txt')], [listItem('/b.txt', 'b.txt', 2)], []]) {
      listResponse(...files);
      expect(await rename()).toMatchObject({ success: false, error: { message: expect.stringContaining('未重新提交') } });
    }
    fetchList.mockRejectedValueOnce(new Error('offline'));
    expect(await rename()).toMatchObject({ success: false, error: { message: expect.stringContaining('未重新提交') } });
    expect(submittedFiles()).toHaveLength(1);

    listResponse(listItem('/b.txt', 'b.txt'));
    expect(await rename()).toMatchObject({ success: true });
    expect(submittedFiles()).toHaveLength(1);
  });

  it('已知被拒绝的改名仍可重试并发送新请求', async () => {
    listResponse(listItem('/a.txt'));
    await adapter.getAllFiles();
    callAPI.mockResolvedValueOnce({ errno: -8 });
    expect(await rename()).toMatchObject({ success: false });
    expect(await rename()).toMatchObject({ success: true });
    expect(submittedFiles()).toHaveLength(2);
  });

  it('切换目录或改用另一个目标名不会绕过未知结果的保护', async () => {
    listResponse(listItem('/a.txt'));
    await adapter.getAllFiles();
    callAPI.mockRejectedValueOnce(new Error('lost response'));
    expect(await rename()).toMatchObject({ success: false });

    expect(await rename(FILE_ID, 'c.txt')).toMatchObject({ success: false });
    window.history.replaceState({}, '', '/disk/main?path=%2Fother');
    expect(await rename()).toMatchObject({ success: false });
    expect(fetchList).toHaveBeenCalledTimes(1);
    expect(submittedFiles()).toHaveLength(1);
  });

  it('不使用首次请求尚未结束时发出的列表来确认改名', async () => {
    listResponse(listItem('/a.txt'));
    await adapter.getAllFiles();
    let loseResponse!: (error: Error) => void;
    callAPI.mockImplementationOnce(() => new Promise((_resolve, reject) => { loseResponse = reject; }));
    const initial = adapter.renameFile(String(FILE_ID), 'b.txt');
    await vi.runAllTimersAsync();

    let completeOldList!: (response: Response) => void;
    fetchList.mockImplementationOnce(() => new Promise(resolve => { completeOldList = resolve; }));
    const oldListing = adapter.getAllFiles();
    await vi.advanceTimersByTimeAsync(0);
    loseResponse(new Error('lost response'));
    expect(await initial).toMatchObject({ success: false });
    listResponse(listItem('/b.txt', 'b.txt'));

    const confirmation = adapter.renameFile(String(FILE_ID), 'b.txt');
    completeOldList(new Response(JSON.stringify({ errno: 0, list: [listItem('/a.txt')] })));
    await oldListing;
    expect(await confirmation).toEqual({ success: true, newName: 'b.txt' });
    expect(fetchList).toHaveBeenCalledTimes(3);
    expect(submittedFiles()).toHaveLength(1);
  });

  const fullPage = () => Array.from({ length: 100 }, (_, i) => listItem(`/file-${i}.txt`, `file-${i}.txt`, i + 1));
  const requestedPages = () => fetchList.mock.calls.map(([url]) => new URL(String(url)).searchParams.get('page'));

  it('同名预检查到第二页的目录，并为同目录并发预检共享分页读取', async () => {
    listResponse(...fullPage());
    fetchList.mockResolvedValueOnce(new Response(JSON.stringify({
      errno: 0, data: { list: [{ ...listItem('/taken', 'taken', 101), isdir: 1 }] },
    })));

    await expect(Promise.all([
      adapter.checkNameConflict('taken', '/'),
      adapter.checkNameConflict('not-taken', '/'),
    ])).resolves.toEqual([true, false]);
    expect(requestedPages()).toEqual(['1', '2']);
  });

  it('同名预检排除当前文件 ID，而不是排除所有同名条目', async () => {
    listResponse(listItem('/a.txt'));
    await expect(adapter.checkNameConflict('a.txt', '/', String(FILE_ID))).resolves.toBe(false);

    listResponse(listItem('/a.txt'), listItem('/a.txt', 'a.txt', 2));
    await expect(adapter.checkNameConflict('a.txt', '/', String(FILE_ID))).resolves.toBe(true);
  });

  it.each([
    { errno: 110 },
    { errno: 0, list: {} },
  ])('后续分页错误 %j 传到批量预检而不是返回无冲突', async (failure) => {
    listResponse(...fullPage());
    fetchList.mockResolvedValueOnce(new Response(JSON.stringify(failure)));
    const detector = new ConflictDetector(adapter);
    const source = { id: String(FILE_ID), name: 'a.txt', ext: '.txt', parentId: '/', size: 10, mtime: 1 };

    await expect(detector.detectConflicts([source], ['b.txt'])).rejects.toThrow();
    expect(requestedPages()).toEqual(['1', '2']);
    expect(callAPI).not.toHaveBeenCalled();
  });

  it('网络异常时明确预检失败且不导出请求凭据', async () => {
    fetchList.mockRejectedValueOnce(new Error(`https://pan.baidu.com/api/list?bdstoken=${TOKEN}`));

    await expect(adapter.checkNameConflict('taken', '/')).rejects.toThrow();
    expect(JSON.stringify(entries)).not.toContain(TOKEN);
  });
});
