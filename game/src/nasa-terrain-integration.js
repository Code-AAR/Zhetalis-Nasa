/**
 * NASA Terrain Integration Module
 * Integrates MOLA elevation and albedo data with procedural noise for realistic Mars terrain.
 */

import { loadCSV } from './utils.js';
import { fbm, noise, simplexNoise } from './noise-functions.js';

// Global cache for loaded NASA data
let molaElevationData = null;
let molaAlbedoData = null;
let elevationGrid = null;
let albedoGrid = null;

/**
 * Load and parse MOLA elevation CSV into a usable grid.
 * Expects columns: longitude, latitude, elevation
 */
export function loadMolarelevation(dataPath) {
    const rows = loadCSV(dataPath);
    const minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const tempGrid = [];

    rows.forEach(row => {
        if (!row || row.length < 3) return;
        const lon = parseFloat(row[0]);
        const lat = parseFloat(row[1]);
        const elev = parseFloat(row[2]);

        if (isNaN(lon) || isNaN(lat) || isNaN(elev)) return;

        // Normalize to 0-1 range assuming full Mars sphere
        const normLon = ((lon + 180) / 360);
        const normLat = ((lat + 90) / 180);

        minX = Math.min(minX, lon);
        maxX = Math.max(maxX, lon);
        minY = Math.min(minY, lat);
        maxY = Math.max(maxY, lat);

        // Simple linear interpolation grid (coarse resolution for performance)
        const gridKey = `${normLon.toFixed(2)},${normLat.toFixed(2)}`;
        tempGrid[gridKey] = elev;
    });

    // Create a simple 2D array lookup (approximate)
    elevationGrid = buildInterpolationGrid(tempGrid, minX, maxX, minY, maxY);
}

/**
 * Load and parse MOLA albedo CSV into a usable grid.
 */
export function loadMolaAlbedo(dataPath) {
    const rows = loadCSV(dataPath);
    const tempGrid = {};

    rows.forEach(row => {
        if (!row || row.length < 2) return;
        const lon = parseFloat(row[0]);
        const albedo = parseFloat(row[1]);

        if (isNaN(lon) || isNaN(albedo)) return;

        const normLon = ((lon + 180) / 360);
        const gridKey = `${normLon.toFixed(2)},0`; // Simplified lat assumption for albedo
        tempGrid[gridKey] = albedo;
    });

    albedoGrid = buildInterpolationGrid(tempGrid, minX, maxX, 0, 180);
}

/**
 * Build a simple bilinear interpolation grid from sparse data points.
 */
function buildInterpolationGrid(data, xMin, xMax, yMin, yMax) {
    const rangeX = xMax - xMin;
    const rangeY = yMax - yMin;
    const step = 0.01; // 1% resolution grid
    
    const grid = {};
    
    for (let x = Math.floor(xMin / step) * step; x <= Math.ceil(xMax / step) * step; x += step) {
        for (let y = Math.floor(yMin / step) * step; y <= Math.ceil(yMax / step) * step; y += step) {
            const key = `${(x - xMin)/rangeX.toFixed(2)},${(y - yMin)/rangeY.toFixed(2)}`;
            if (data[key] !== undefined) {
                grid[key] = data[key];
            } else {
                grid[key] = 0; // Default to zero if no data
            }
        }
    }
    
    return grid;
}

/**
 * Query elevation at a given longitude and latitude.
 * Uses NASA data if available, falls back to procedural noise.
 */
export function getElevationAt(lon, lat) {
    if (!elevationGrid) return fbm(0, 0); // Fallback to default terrain

    const normLon = ((lon + 180) / 360);
    const normLat = ((lat + 90) / 180);

    // Find closest grid point
    let bestKey = null;
    let minDiff = Infinity;

    for (const key in elevationGrid) {
        const [gx, gy] = key.split(',').map(parseFloat);
        const diff = Math.sqrt(Math.pow(normLon - gx, 2) + Math.pow(normLat - gy, 2));
        if (diff < minDiff) {
            minDiff = diff;
            bestKey = key;
        }
    }

    if (!bestKey) return fbm(0, 0); // No data found

    const baseElev = elevationGrid[bestKey];

    // Add multi-scale noise for fine detail
    const detail = 0.1 * (noise(normLon, normLat) + 0.5);
    
    return Math.max(-1000, Math.min(10000, baseElev + detail));
}

/**
 * Query albedo at a given longitude and latitude.
 */
export function getAlbedoAt(lon, lat) {
    if (!albedoGrid) return 0.3; // Default albedo

    const normLon = ((lon + 180) / 360);
    const normLat = ((lat + 90) / 180);

    // Find closest grid point (simplified for albedo)
    let bestKey = null;
    let minDiff = Infinity;

    for (const key in albedoGrid) {
        const [gx] = key.split(',').map(parseFloat);
        const diff = Math.abs(normLon - gx);
        if (diff < minDiff) {
            minDiff = diff;
            bestKey = key;
        }
    }

    if (!bestKey) return 0.3; // Default albedo

    return albedoGrid[bestKey];
}

/**
 * Initialize NASA terrain integration with data files.
 */
export function initNASAIntegration(elevationPath, albedoPath) {
    loadMolarelevation(elevationPath);
    loadMolaAlbedo(albedoPath);
}

/**
 * Get combined elevation blending NASA data with procedural noise.
 */
export function getEnhancedElevation(lon, lat, blendFactor = 0.7) {
    const nasaElev = elevationGrid ? getElevationAt(lon, lat) : fbm(0, 0);
    const proceduralElev = fbm(0, 0); // Could use separate noise instance
    
    return nasaElev * blendFactor + proceduralElev * (1 - blendFactor);
}
