import { describe, expect, it } from 'vitest';
import { markUCPageScriptReady } from '../../../src/adapters/uc/page-script';

describe('UC page script ready flag', () => {
  it('does not throw when document.body is temporarily unavailable', () => {
    const body = document.body;
    document.documentElement.removeChild(body);

    expect(() => markUCPageScriptReady(Date.now())).not.toThrow();

    document.documentElement.appendChild(body);
  });
});
