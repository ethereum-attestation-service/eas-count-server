import { LRUCache } from "lru-cache";

export const globalCacheServer = new LRUCache<string, string>({
  max: 1000,
});

export function setGlobalCache(key: string, value: any, time?: number): void {
  globalCacheServer.set(key, JSON.stringify(value), { ttl: time });
}

export function getGlobalCache<T>(key: string): T | null {
  const value = globalCacheServer.get(key);
  if (value) {
    return JSON.parse(value) as T;
  }
  return null;
}
