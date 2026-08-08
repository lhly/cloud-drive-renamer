import { describe, expect, it } from 'vitest';
import { ConfigPanel } from '../../src/content/components/config-panel';
import { FileListPanel } from '../../src/content/components/file-list-panel';
import { FileSelectorPanel } from '../../src/content/components/file-selector-panel';
import { PreviewPanel } from '../../src/content/components/preview-panel';
import { SearchBox } from '../../src/content/components/search-box';
import { Toolbar } from '../../src/content/components/toolbar';

function cssRule(cssText: string, selector: string, nextSelector: string): string {
  const start = cssText.indexOf(selector);
  const end = cssText.indexOf(nextSelector, start + selector.length);
  return cssText.slice(start, end);
}

describe('panel layout density', () => {
  it('uses compact modal and column headers', () => {
    const selectorCss = FileSelectorPanel.styles.cssText;
    const configCss = ConfigPanel.styles.cssText;
    const fileListCss = FileListPanel.styles.cssText;
    const previewCss = PreviewPanel.styles.cssText;

    expect(cssRule(selectorCss, '.panel-header {', '.panel-title')).toContain('padding: 12px 20px;');
    expect(cssRule(selectorCss, '.panel-header {', '.panel-title')).not.toContain('padding: 20px 24px;');

    expect(cssRule(configCss, '.panel-header {', '.panel-title')).toContain('padding: 12px 16px;');
    expect(cssRule(fileListCss, '.panel-header {', '.panel-title')).toContain('padding: 12px 16px;');
    expect(cssRule(previewCss, '.panel-header {', '.panel-title')).toContain('padding: 12px 16px;');
    expect(cssRule(previewCss, '.panel-title {', '.conflict-warning')).toContain('margin: 0;');
  });

  it('tightens the top controls and config body spacing', () => {
    const configCss = ConfigPanel.styles.cssText;
    const fileListCss = FileListPanel.styles.cssText;
    const previewCss = PreviewPanel.styles.cssText;
    const searchCss = SearchBox.styles.cssText;
    const toolbarCss = Toolbar.styles.cssText;

    expect(cssRule(configCss, '.panel-body {', '.panel-footer')).toContain('padding: 12px 14px 32px;');
    expect(cssRule(configCss, '.rule-panels {', '.rule-panel-list')).toContain('margin-bottom: 10px;');
    expect(cssRule(configCss, '.preset-toolbar {', '.preset-tablist')).toContain('margin: -12px -14px 8px;');
    expect(cssRule(configCss, '.form-group {', '.form-label')).toContain('margin-bottom: 12px;');

    expect(cssRule(fileListCss, '.search-container {', '.list-container')).toContain('padding: 8px 16px;');
    expect(cssRule(toolbarCss, '.toolbar {', '.toolbar-left')).toContain('padding: 8px 16px;');
    expect(cssRule(searchCss, '.search-box {', '.search-box:focus-within')).toContain('padding: 6px 10px;');
    expect(cssRule(previewCss, '.panel-stats {', '.stat-item')).toContain('padding: 8px 16px;');
    expect(cssRule(previewCss, '.failure-nav {', '.failure-nav-summary')).toContain('height: 48px;');
    expect(cssRule(previewCss, '.failure-nav {', '.failure-nav-summary')).toContain('box-sizing: border-box;');
  });

  it('keeps the second control row equal-height across all columns', () => {
    const configCss = ConfigPanel.styles.cssText;
    const fileListCss = FileListPanel.styles.cssText;
    const previewCss = PreviewPanel.styles.cssText;

    const configToolbarRule = cssRule(configCss, '.preset-toolbar {', '.preset-tablist');
    const searchContainerRule = cssRule(fileListCss, '.search-container {', '.list-container');
    const previewStatsRule = cssRule(previewCss, '.panel-stats {', '.stat-item');

    for (const rule of [configToolbarRule, searchContainerRule, previewStatsRule]) {
      expect(rule).toContain('height: 48px;');
      expect(rule).toContain('box-sizing: border-box;');
      expect(rule).toContain('border-bottom: 1px solid var(--cdr-border');
    }

    expect(configToolbarRule).toContain('border-top: 1px solid var(--cdr-border');
    expect(configToolbarRule).toContain('border-right: 1px solid var(--cdr-border');
    expect(configToolbarRule).toContain('border-left: 1px solid var(--cdr-border');
  });

});
