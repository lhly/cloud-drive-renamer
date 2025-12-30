/**
 * 存储管理器
 * 封装chrome.storage.local和localStorage
 */
export class StorageManager {
  /**
   * 保存数据到chrome.storage.local
   */
  async set(key: string, value: any): Promise<void> {
    try {
      await chrome.storage.local.set({ [key]: value });
    } catch (error) {
      console.error('[CDR] Failed to save to chrome.storage:', error);
      // 降级到localStorage
      localStorage.setItem(key, JSON.stringify(value));
    }
  }

  /**
   * 从chrome.storage.local读取数据
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const result = await chrome.storage.local.get(key);
      return (result as Record<string, T | undefined>)[key] ?? null;
    } catch (error) {
      console.error('[CDR] Failed to read from chrome.storage:', error);
      // 降级到localStorage
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    }
  }

  /**
   * 删除数据
   */
  async remove(key: string): Promise<void> {
    try {
      await chrome.storage.local.remove(key);
    } catch (error) {
      console.error('[CDR] Failed to remove from chrome.storage:', error);
      localStorage.removeItem(key);
    }
  }

  /**
   * 清空所有数据
   */
  async clear(): Promise<void> {
    try {
      await chrome.storage.local.clear();
    } catch (error) {
      console.error('[CDR] Failed to clear chrome.storage:', error);
      localStorage.clear();
    }
  }

  /**
   * 获取所有存储的键
   */
  async getAllKeys(): Promise<string[]> {
    try {
      const result = await chrome.storage.local.get(null);
      return Object.keys(result);
    } catch (error) {
      console.error('[CDR] Failed to get keys from chrome.storage:', error);
      return Object.keys(localStorage);
    }
  }
}

export const storage = new StorageManager();
