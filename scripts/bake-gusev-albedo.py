"""Bake the Gusev ground-brightness map used to colour the terrain (assets/terrain/gusev-albedo-256.*).

Inputs (public domain, USGS Astrogeology), same 4-degree window as gusev-mola-128:
  Mars_Viking_ClrMosaic_global_925m.tif   https://planetarymaps.usgs.gov/mosaic/Mars_Viking_ClrMosaic_global_925m.tif
  Mars_MGS_TES_Albedo_mosaic_global_7410m.tif  https://planetarymaps.usgs.gov/mosaic/Mars_MGS_TES_Albedo_mosaic_global_7410m.tif
Viking gives the detail (about 0.93 km per pixel), but its colours are stretched for looks. TES measured real albedo,
but only every 7.4 km, and its tiles here show seams and stripes. Both show the same dark patch just north-west of
Spirit's landing site. So Viking sets the pattern and TES sets the scale: Viking's median brightness maps to TES's median
albedo, and Viking's darkest 1 percent maps to TES's darkest 1 percent. The result is stored as albedo. Usage: python3 scripts/bake-gusev-albedo.py VIKING.tif TES.tif
"""
import sys, json, hashlib, numpy as np, tifffile
from PIL import Image
viking_path, tes_path = sys.argv[1], sys.argv[2]
OUT = 'game/assets/terrain/gusev-albedo-256'
meta_mola = json.load(open('game/assets/terrain/gusev-mola-128.json'))
W, E, N, S = meta_mola['west'], meta_mola['east'], meta_mola['north'], meta_mola['south']
SIZE = 256

def crop(arr2d_or_bands, ppd, out, pad=4):
    c0, c1, r0, r1 = (W + 180) * ppd, (E + 180) * ppd, (90 - N) * ppd, (90 - S) * ppd
    i0, j0 = int(r0) - pad, int(c0) - pad
    a = np.asarray(arr2d_or_bands[..., i0:int(np.ceil(r1)) + pad, j0:int(np.ceil(c1)) + pad], dtype=np.float64)
    box = (c0 - j0, r0 - i0, c1 - j0, r1 - i0)
    def resample(band):
        return np.asarray(Image.fromarray(band.astype(np.float32), mode='F').transform((out, out), Image.EXTENT, box, Image.BILINEAR))
    return np.stack([resample(b) for b in a]) if a.ndim == 3 else resample(a)

v = tifffile.memmap(viking_path)                                    # (3, rows, cols) uint8, simple cylindrical
vrgb = crop(v, v.shape[2] / 360, SIZE)
lum = .299 * vrgb[0] + .587 * vrgb[1] + .114 * vrgb[2]
t = tifffile.imread(tes_path).astype(np.float64); t[t < -1e30] = np.nan  # (rows, cols) float albedo
TES_N = 32                                                           # 8 pixels per degree x 4 degrees
tes = crop(t, t.shape[1] / 360, TES_N, pad=2)
lum_coarse = lum.reshape(TES_N, SIZE // TES_N, TES_N, SIZE // TES_N).mean(axis=(1, 3))
ok = np.isfinite(tes)
l_med, l_dark = np.median(lum), np.percentile(lum, 1)
t_med, t_dark = float(np.nanmedian(tes)), float(np.nanpercentile(tes, 1))
b = (t_med - t_dark) / (l_med - l_dark); a = t_med - b * l_med
r = np.corrcoef(lum_coarse[ok], tes[ok])[0, 1]                      # reported: low, because TES is noisy outside the dark patch
albedo = a + b * lum
lo, hi = float(np.percentile(albedo, .5)), float(np.percentile(albedo, 99.5))
q = np.uint8(np.clip((albedo - lo) / (hi - lo), 0, 1) * 255 + .5)
open(OUT + '.bin', 'wb').write(q.tobytes())
meta = {
  'id': 'gusev-albedo-256', 'units': 'Lambert albedo (fitted)', 'n': SIZE, 'encoding': 'uint8 row-major, north row first; albedo = min + value/255*(max-min)',
  'north': N, 'south': S, 'west': W, 'east': E, 'worldSpan': meta_mola['worldSpan'], 'orientation': 'north is negative game Z, east positive X (same as gusev-mola-128)',
  'min': round(lo, 4), 'max': round(hi, 4), 'mean': round(float(albedo.mean()), 4),
  'tesMean': round(float(np.nanmean(tes)), 4), 'tesMin': round(float(np.nanmin(tes)), 4), 'tesMax': round(float(np.nanmax(tes)), 4),
  'fit': {'albedo': f'{a:.5f} + {b:.6f} * vikingLuminance', 'method': 'two-point: Viking median -> TES median, Viking 1st percentile -> TES 1st percentile', 'tesMedian': round(t_med, 4), 'tesDark1pct': round(t_dark, 4), 'correlationAtTesScale': round(float(r), 3), 'tesPixels': int(ok.sum())},
  'sources': [
    {'name': 'Mars Viking Colorized Global Mosaic (MDIM 1, 925 m)', 'url': 'https://planetarymaps.usgs.gov/mosaic/Mars_Viking_ClrMosaic_global_925m.tif', 'page': 'https://astrogeology.usgs.gov/search/map/mars_viking_global_color_mosaic_925m'},
    {'name': 'Mars MGS TES Global Bolometric Albedo Map (7410 m)', 'url': 'https://planetarymaps.usgs.gov/mosaic/Mars_MGS_TES_Albedo_mosaic_global_7410m.tif', 'page': 'https://astrogeology.usgs.gov/search/map/mars_mgs_tes_global_bolometric_albedo_map_7410m'}],
  'sha256': hashlib.sha256(q.tobytes()).hexdigest(),
  'notes': 'Darker means lower albedo: dust swept off by wind and dust devils, showing dark basalt sand. Brighter means more fine red dust. Used to tint the terrain inside the NASA height crop; the invented outer ground ignores it.'}
json.dump(meta, open(OUT + '.json', 'w'), indent=2)
Image.fromarray(q).save('/home/claude/shots/gusev-albedo-baked.png')
print(json.dumps({k: meta[k] for k in ('min', 'max', 'mean', 'tesMin', 'tesMean', 'tesMax', 'fit')}, indent=1))
