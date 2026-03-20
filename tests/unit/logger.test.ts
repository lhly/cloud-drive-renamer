import { beforeEach, describe, expect, it, vi } from 'vitest';
import { configureLoggerDiagnostics, logger } from '../../src/utils/logger';

describe('logger diagnostic transport', () => {
  beforeEach(() => {
    configureLoggerDiagnostics(null);
  });

  it('extracts module prefix and forwards structured diagnostic entry', () => {
    const transport = vi.fn();

    configureLoggerDiagnostics({ source: 'content', transport });
    logger.error('[FileSelectorPanel] Retry failed:', new Error('boom'));

    expect(transport).toHaveBeenCalledTimes(1);
    expect(transport).toHaveBeenCalledWith(
      expect.objectContaining({
        module: 'FileSelectorPanel',
        level: 'ERROR',
        message: 'Retry failed:',
      })
    );
  });

  it('swallows transport failures and keeps logger calls safe', () => {
    const transport = vi.fn(() => {
      throw new Error('transport failed');
    });

    configureLoggerDiagnostics({ source: 'content', transport });

    expect(() => {
      logger.error('[FileSelectorPanel] Retry failed:', new Error('boom'));
    }).not.toThrow();
  });
});
