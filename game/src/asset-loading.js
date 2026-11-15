// Bound caller wait time without pretending that Three.js loadAsync is cancellable.
export class AssetLoadError extends Error {
  constructor(url, cause) {
    super(`Could not load ${url}`, { cause });
    this.name = 'AssetLoadError';
    this.asset = url;
  }
}

// A timed-out running load retains its slot until it really settles. Queued loads
// can be removed immediately, so a stalled decoder cannot grow an abandoned queue.
export function createAssetLoadQueue(limit = 2) {
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError('Invalid concurrency');
  let active = 0;
  const pending = [];
  function pump() {
    while (active < limit && pending.length) {
      const job = pending.shift();
      job.signal.removeEventListener('abort', job.cancel);
      active++;
      Promise.resolve().then(job.task).then(job.resolve, job.reject).finally(() => {
        active--; pump();
      });
    }
  }
  return (task, signal) => new Promise((resolve, reject) => {
    if (signal.aborted) { reject(signal.reason); return; }
    const job = { task, signal, resolve, reject, cancel: () => {
      pending.splice(pending.indexOf(job), 1);
      reject(signal.reason);
    } };
    signal.addEventListener('abort', job.cancel, { once: true });
    pending.push(job);
    pump();
  });
}
const queue = createAssetLoadQueue(2);
// Reserved capacity: optional scenery cannot consume gameplay geometry slots.
const criticalQueue = createAssetLoadQueue(2);
const inFlight = new WeakMap();

export function loadAssetWithRetry(loader, url, { attempts = 3, delay = 800, timeout = 120000, critical = false } = {}) {
  if (!Number.isInteger(attempts) || attempts < 1 || !Number.isFinite(delay) || delay < 0 ||
      !Number.isFinite(timeout) || timeout <= 0 || timeout > 2147483647) {
    return Promise.reject(new RangeError('Invalid asset loading limits'));
  }
  let entries = inFlight.get(loader);
  if (!entries) { entries = new Map(); inFlight.set(loader, entries); }
  // First caller owns the policy. Keep even a rejected timeout here until the
  // original load settles: another caller must not start a second parse.
  if (entries.has(url)) return entries.get(url);
  const controller = new AbortController();
  const { signal } = controller;
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const cause = new Error(`Asset loading exceeded ${timeout}ms`);
      cause.name = 'TimeoutError';
      const error = new AssetLoadError(url, cause);
      controller.abort(error);
      reject(error);
    }, timeout);
  });
  const operation = (critical ? criticalQueue : queue)(async () => {
    let cause;
    for (let attempt = 0; attempt < attempts; attempt++) {
      if (signal.aborted) throw signal.reason;
      try { return await loader.loadAsync(url); }
      catch (error) {
        cause = error;
        if (signal.aborted) throw signal.reason;
        if (attempt + 1 < attempts) await new Promise(resolve => {
          const finish = () => { clearTimeout(wait); signal.removeEventListener('abort', finish); resolve(); };
          const wait = setTimeout(finish, Math.min(delay * (attempt + 1), timeout));
          signal.addEventListener('abort', finish, { once: true });
        });
      }
    }
    throw new AssetLoadError(url, cause);
  }, signal);
  const result = Promise.race([operation, deadline]);
  entries.set(url, result);
  const cleanup = () => { clearTimeout(timer); entries.delete(url); };
  operation.then(cleanup, cleanup);
  return result;
}
