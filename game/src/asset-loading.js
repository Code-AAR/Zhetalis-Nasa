// Retry downloads before callers attach models to the scene.
export class AssetLoadError extends Error {
  constructor(url, cause) {
    super(`Could not download ${url}`, { cause });
    this.name = 'AssetLoadError';
    this.asset = url;
  }
}
export async function loadAssetWithRetry(loader, url, { attempts = 3, delay = 800 } = {}) {
  let cause;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try { return await loader.loadAsync(url); }
    catch (error) {
      cause = error;
      if (attempt + 1 < attempts) await new Promise(resolve => setTimeout(resolve, delay * (attempt + 1)));
    }
  }
  throw new AssetLoadError(url, cause);
}
