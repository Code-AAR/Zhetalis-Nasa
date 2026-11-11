// game/src/nasa-data.js
// Loads and parses NASA MOLA elevation and albedo data from CSV files.
// Provides a fast lookup function for terrain height at any (x, z) coordinate.

import { loadBinary } from './utils-binary.js'; // Adjust path if needed

/**
 * Load NASA MOLA topography data from CSV file.
 * @param {string} filePath - Path to the CSV file (e.g., 'mola-128.csv')
 * @returns {Object} - Parsed elevation data with grid bounds and values
 */
export async function loadMOLAData(filePath) {
  const rawText = await loadBinary(filePath); // Assumes CSV is text or can be read as text
  const lines = rawText.trim().split('\n');
  
  if (lines.length < 2) {
    console.warn('NASA MOLA file too small or empty:', filePath);
    return null;
  }

  // Assume first line has header with x, y columns; adjust if needed
  const header = lines[0].split(',').map(h => h.trim().toLowerCase());
  const xIndex = header.findIndex(h => h.includes('x') || h.includes('long'));
  const yIndex = header.findIndex(h => h.includes('y') || h.includes('lat'));
  const zIndex = header.findIndex(h => h.includes('z') || h.includes('elev') || h.includes('hgt'));

  if (xIndex === -1 || yIndex === -1 || zIndex === -1) {
    throw new Error(`Invalid MOLA CSV format in ${filePath}. Expected columns: x, y, z`);
  }

  const gridSize = lines.length; // Assuming square grid
  const elevations = [];
  const bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };

  for (let i = 0; i < lines.length; i++) {
    const parts = lines[i].split(',').map(v => parseFloat(v.trim()));
    if (!parts[xIndex] || !parts[yIndex]) continue; // Skip malformed rows

    const x = parts[xIndex];
    const y = parts[yIndex];
    const z = parts[zIndex];

    elevations.push({ x, y, z });
    bounds.minX = Math.min(bounds.minX, x);
    bounds.maxX = Math.max(bounds.maxX, x);
    bounds.minY = Math.min(bounds.minY, y);
    bounds.maxY = Math.max(bounds.maxY, y);
  }

  return {
    elevations,
    bounds,
    gridSize,
    xIndex,
    yIndex,
    zIndex,
    originalFile: filePath
  };
}

/**
 * Load NASA albedo (color) data from CSV file.
 * @param {string} filePath - Path to the albedo CSV file
 * @returns {Object} - Parsed albedo data
 */
export async function loadAlbedoData(filePath) {
  const rawText = await loadBinary(filePath);
  const lines = rawText.trim().split('\n');

  if (lines.length < 2) return null;

  const header = lines[0].split(',').map(h => h.trim().toLowerCase());
  const xIndex = header.findIndex(h => h.includes('x') || h.includes('long'));
  const yIndex = header.findIndex(h => h.includes('y') || h.includes('lat'));
  // Assume RGB columns follow; adjust if needed
  const rIndex = header.findIndex(h => h === 'r' || h === 'red');
  const gIndex = header.findIndex(h => h === 'g' || h === 'green');
  const bIndex = header.findIndex(h => h === 'b' || h === 'blue');

  if (xIndex === -1 || yIndex === -1) {
    throw new Error(`Invalid albedo CSV format in ${filePath}`);
  }

  const colors = [];

  for (let i = 0; i < lines.length; i++) {
    const parts = lines[i].split(',').map(v => parseFloat(v.trim()));
    if (!parts[xIndex] || !parts[yIndex]) continue;

    const x = parts[xIndex];
    const y = parts[yIndex];
    let r, g, b;

    if (rIndex !== -1) r = parts[rIndex];
    else r = 0; // Default black if missing

    if (gIndex !== -1) g = parts[gIndex];
    else g = 0;

    if (bIndex !== -1) b = parts[bIndex];
    else b = 0;

    colors.push({ x, y, r: Math.min(255, Math.max(0, r)), g: Math.min(255, Math.max(0, g)), b: Math.min(255, Math.max(0, b)) });
  }

  return {
    colors,
    bounds: { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
    gridSize: colors.length,
    xIndex, yIndex, rIndex, gIndex, bIndex,
    originalFile: filePath
  };
}

/**
 * Get elevation at a given (x, z) coordinate using nearest-neighbor lookup.
 * @param {number} x - World X coordinate
 * @param {number} z - World Z (or Y) coordinate
 * @param {Object} data - Loaded MOLA data from loadMOLAData()
 * @returns {number|null} - Elevation or null if out of bounds
 */
export function getElevationAt(x, z, data) {
  if (!data || !Array.isArray(data.elevations)) return null;

  // Find nearest grid point
  let best = null;
  let minDist = Infinity;

  for (const pt of data.elevations) {
    const dx = pt.x - x;
    const dz = pt.y - z; // Assuming y in CSV is Z in world
    const dist = Math.sqrt(dx*dx + dz*dz);
    if (dist < minDist) {
      minDist = dist;
      best = pt.z;
    }
  }

  return best !== null ? best : null;
}

/**
 * Get albedo color at a given (x, z) coordinate.
 * @param {number} x - World X coordinate
 * @param {number} z - World Z (or Y) coordinate
 * @param {Object} data - Loaded albedo data from loadAlbedoData()
 * @returns {Object|null} - {r, g, b} or null if out of bounds
 */
export function getAlbedoAt(x, z, data) {
  if (!data || !Array.isArray(data.colors)) return null;

  let best = null;
  let minDist = Infinity;

  for (const pt of data.colors) {
    const dx = pt.x - x;
    const dz = pt.y - z;
    const dist = Math.sqrt(dx*dx + dz*dz);
    if (dist < minDist) {
      minDist = dist;
      best = pt;
    }
  }

  return best !== null ? best : null;
}

// Example usage:
// const molaData = await loadMOLAData('mola-128.csv');
// const albedoData = await loadAlbedoData('gusev-albedo-256.csv');
// const height = getElevationAt(100, 200, molaData);
// const color = getAlbedoAt(100, 200, albedoData);
