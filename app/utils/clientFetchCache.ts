type CacheEntry<T> = {
  data: T;
  at: number;
};

const inflight = new Map<string, Promise<unknown>>();
const results = new Map<string, CacheEntry<unknown>>();

/**
 * 合併同 key 的進行中請求，並在 ttl 內回傳快取結果（避免 Strict Mode 與多元件重複打 API）。
 */
export async function fetchCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs = 30_000
): Promise<T> {
  const cached = results.get(key);
  if (cached && Date.now() - cached.at < ttlMs) {
    return cached.data as T;
  }

  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const promise = fetcher()
    .then((data) => {
      results.set(key, { data, at: Date.now() });
      inflight.delete(key);
      return data;
    })
    .catch((error) => {
      inflight.delete(key);
      throw error;
    });

  inflight.set(key, promise);
  return promise;
}

export function invalidateFetchCache(keyOrPrefix: string): void {
  for (const key of [...results.keys(), ...inflight.keys()]) {
    if (key === keyOrPrefix || key.startsWith(`${keyOrPrefix}:`)) {
      results.delete(key);
      inflight.delete(key);
    }
  }
}
