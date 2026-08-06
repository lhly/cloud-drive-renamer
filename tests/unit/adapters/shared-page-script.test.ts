import { describe, it, expect, vi, afterEach } from 'vitest';
import { markPageScriptReady } from '../../../src/adapters/shared/page-script';

describe('shared cloud drive page script', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('does not throw when marking ready before document.body exists', () => {
    const body = document.body;
    Object.defineProperty(document, 'body', { value: null, configurable: true });

    expect(() => markPageScriptReady({
      requestType: 'TEST_READY_REQUEST',
      responseType: 'TEST_READY_RESPONSE',
      readyFlagName: '__TEST_READY__',
      datasetReadyKey: 'testReady',
      datasetTimestampKey: 'testTimestamp',
      logPrefix: 'TestReady',
    })).not.toThrow();

    Object.defineProperty(document, 'body', { value: body, configurable: true });
  });
});
