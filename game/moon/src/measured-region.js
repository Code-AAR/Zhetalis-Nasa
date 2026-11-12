// Pure, synchronous, immutable-in-use regional DEM. Never fetches or changes at runtime.
import { GRID, DECIMETRES } from '../data/regional-heights.js';
export const TERRAIN_SOURCE = Object.freeze({ ...GRID,
  name: 'NASA LOLA south-pole DEM (Barker et al., 2021)',
  url: 'https://pgda.gsfc.nasa.gov/products/81',
  note: '5 m interpolated LOLA DEM; synthetic training pad, crater field, grain and ice-shadow overlays. Not a surveyed landing site.',
});
export function measuredHeightAt(x, z) {
  if (!Number.isFinite(x) || !Number.isFinite(z) || Math.abs(x)>GRID.halfMetres || Math.abs(z)>GRID.halfMetres) return null;
  const u=(x+GRID.halfMetres)/GRID.stepMetres, v=(z+GRID.halfMetres)/GRID.stepMetres;
  const ix=Math.min(GRID.width-2,Math.floor(u)), iz=Math.min(GRID.width-2,Math.floor(v));
  const fx=u-ix,fz=v-iz,i=iz*GRID.width+ix;
  return (DECIMETRES[i]*(1-fx)*(1-fz)+DECIMETRES[i+1]*fx*(1-fz)+DECIMETRES[i+GRID.width]*(1-fx)*fz+DECIMETRES[i+GRID.width+1]*fx*fz)*0.1;
}
