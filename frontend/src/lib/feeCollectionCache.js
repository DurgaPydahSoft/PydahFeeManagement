/**
 * In-memory cache for Fee Collection initial payload.
 * Survives React Router remounts within the same SPA session.
 * Cleared on full page reload (by design).
 */

const TTL_MS = 15 * 60 * 1000; // 15 minutes

let cache = {
  key: null,
  students: null,
  paymentConfigs: null,
  receiptSettings: null,
  feeHeads: null,
  fetchedAt: 0
};

/** In-flight fetch promise so React Strict Mode double-mount doesn't hit SQL twice */
let inflight = {
  key: null,
  promise: null
};

export const getFeeCollectionCache = (key) => {
  if (!cache.key || cache.key !== key) return null;
  if (!cache.students || !Array.isArray(cache.students)) return null;
  if (Date.now() - cache.fetchedAt > TTL_MS) return null;
  return {
    students: cache.students,
    paymentConfigs: cache.paymentConfigs,
    receiptSettings: cache.receiptSettings,
    feeHeads: cache.feeHeads,
    fetchedAt: cache.fetchedAt
  };
};

export const setFeeCollectionCache = (key, data) => {
  cache = {
    key,
    students: data.students || [],
    paymentConfigs: data.paymentConfigs || [],
    receiptSettings: data.receiptSettings || null,
    feeHeads: data.feeHeads || [],
    fetchedAt: Date.now()
  };
};

export const getOrCreateFeeCollectionFetch = (key, fetcher) => {
  if (inflight.key === key && inflight.promise) return inflight.promise;
  const promise = Promise.resolve()
    .then(fetcher)
    .then((data) => {
      setFeeCollectionCache(key, data);
      return data;
    })
    .finally(() => {
      if (inflight.promise === promise) {
        inflight = { key: null, promise: null };
      }
    });
  inflight = { key, promise };
  return promise;
};

export const clearFeeCollectionCache = () => {
  cache = {
    key: null,
    students: null,
    paymentConfigs: null,
    receiptSettings: null,
    feeHeads: null,
    fetchedAt: 0
  };
  inflight = { key: null, promise: null };
};
