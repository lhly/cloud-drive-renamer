import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface ManifestContentScript {
  matches?: string[];
}

interface ManifestWebAccessibleResource {
  matches?: string[];
}

interface ExtensionManifest {
  host_permissions?: string[];
  content_scripts?: ManifestContentScript[];
  web_accessible_resources?: ManifestWebAccessibleResource[];
}

function loadManifest(): ExtensionManifest {
  return JSON.parse(readFileSync(resolve(process.cwd(), 'manifest.json'), 'utf-8')) as ExtensionManifest;
}

describe('manifest platform matches', () => {
  it('injects 123Pan UI only on yun.123pan.cn', () => {
    const manifest = loadManifest();
    const contentScriptMatches = manifest.content_scripts?.flatMap((script) => script.matches ?? []) ?? [];
    const webAccessibleMatches = manifest.web_accessible_resources?.flatMap((resource) => resource.matches ?? []) ?? [];

    expect(manifest.host_permissions).toContain('https://yun.123pan.cn/*');
    expect(manifest.host_permissions).not.toContain('https://www.123pan.com/*');
    expect(contentScriptMatches).toContain('https://yun.123pan.cn/*');
    expect(contentScriptMatches).not.toContain('https://www.123pan.com/*');
    expect(webAccessibleMatches).toContain('https://yun.123pan.cn/*');
    expect(webAccessibleMatches).not.toContain('https://www.123pan.com/*');
  });

  it('injects Xunlei UI on pan.xunlei.com and allows its API host', () => {
    const manifest = loadManifest();
    const contentScriptMatches = manifest.content_scripts?.flatMap((script) => script.matches ?? []) ?? [];
    const webAccessibleMatches = manifest.web_accessible_resources?.flatMap((resource) => resource.matches ?? []) ?? [];

    expect(manifest.host_permissions).toContain('https://pan.xunlei.com/*');
    expect(manifest.host_permissions).toContain('https://api-pan.xunlei.com/*');
    expect(contentScriptMatches).toContain('https://pan.xunlei.com/*');
    expect(webAccessibleMatches).toContain('https://pan.xunlei.com/*');
  });

  it('injects Woozooo UI on pc.woozooo.com and allows its same-origin API', () => {
    const manifest = loadManifest();
    const contentScriptMatches = manifest.content_scripts?.flatMap((script) => script.matches ?? []) ?? [];
    const webAccessibleMatches = manifest.web_accessible_resources?.flatMap((resource) => resource.matches ?? []) ?? [];

    expect(manifest.host_permissions).toContain('https://pc.woozooo.com/*');
    expect(contentScriptMatches).toContain('https://pc.woozooo.com/*');
    expect(webAccessibleMatches).toContain('https://pc.woozooo.com/*');
  });

  it('injects CMCC UI on yun.139.com and allows its API host', () => {
    const manifest = loadManifest();
    const contentScriptMatches = manifest.content_scripts?.flatMap((script) => script.matches ?? []) ?? [];
    const webAccessibleMatches = manifest.web_accessible_resources?.flatMap((resource) => resource.matches ?? []) ?? [];

    expect(manifest.host_permissions).toContain('https://yun.139.com/*');
    expect(manifest.host_permissions).toContain('https://personal-kd-njs.yun.139.com/*');
    expect(contentScriptMatches).toContain('https://yun.139.com/*');
    expect(webAccessibleMatches).toContain('https://yun.139.com/*');
  });

  it('injects GuangyaPan UI on www.guangyapan.com and allows its API host', () => {
    const manifest = loadManifest();
    const contentScriptMatches = manifest.content_scripts?.flatMap((script) => script.matches ?? []) ?? [];
    const webAccessibleMatches = manifest.web_accessible_resources?.flatMap((resource) => resource.matches ?? []) ?? [];

    expect(manifest.host_permissions).toContain('https://www.guangyapan.com/*');
    expect(manifest.host_permissions).toContain('https://api.guangyapan.com/*');
    expect(contentScriptMatches).toContain('https://www.guangyapan.com/*');
    expect(webAccessibleMatches).toContain('https://www.guangyapan.com/*');
  });

  it('injects WKBrowser UI on pan.wkbrowser.com and allows its API host', () => {
    const manifest = loadManifest();
    const contentScriptMatches = manifest.content_scripts?.flatMap((script) => script.matches ?? []) ?? [];
    const webAccessibleMatches = manifest.web_accessible_resources?.flatMap((resource) => resource.matches ?? []) ?? [];

    expect(manifest.host_permissions).toContain('https://pan.wkbrowser.com/*');
    expect(manifest.host_permissions).toContain('https://api.wkbrowser.com/*');
    expect(contentScriptMatches).toContain('https://pan.wkbrowser.com/*');
    expect(contentScriptMatches).not.toContain('https://api.wkbrowser.com/*');
    expect(webAccessibleMatches).toContain('https://pan.wkbrowser.com/*');
  });
});
