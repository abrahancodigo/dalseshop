// Share in-flight reads as well as completed results. Invalidated reads cannot repopulate the cache.
export function createQueryCache({ ttl = 15000, maxEntries = 64, now = Date.now } = {}) {
  const entries = new Map();
  return {
    clear() { entries.clear(); },
    get(key, load) {
      const cached = entries.get(key);
      if (cached?.promise) return cached.promise;
      if (cached && cached.expires > now()) return Promise.resolve(cached.data);
      const entry = {};
      entries.set(key, entry);
      entry.promise = Promise.resolve().then(load).then((data) => {
        if (entries.get(key) === entry) {
          entry.data = data;
          entry.expires = now() + ttl;
          entry.promise = null;
          for (const [oldKey, oldEntry] of entries) {
            if (entries.size <= maxEntries) break;
            if (!oldEntry.promise && oldKey !== key) entries.delete(oldKey);
          }
        }
        return data;
      }, (error) => {
        if (entries.get(key) === entry) entries.delete(key);
        throw error;
      });
      return entry.promise;
    },
  };
}
