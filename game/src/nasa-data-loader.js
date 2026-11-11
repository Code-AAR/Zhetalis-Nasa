// NASA Data Loader for Mars terrain enhancement
// Loads and parses NASA MOLA elevation and albedo data files

export class NASADataLoader {
    constructor() {
        this.molaData = null;      // MOLA elevation grid (128x128 or similar)
        this.albedoData = null;    // Albedo/color data
        this.molaSpacing = 0.05;   // Approximate spacing between MOLA grid points (in world units)
        this.gridSize = 128;       // Size of the MOLA grid
        
        // Cache for interpolated elevation values
        this.elevationCache = new Map();
    }
    
    /**
     * Load NASA data files from your project folder
     */
    async loadNASAData() {
        try {
            // Read MOLA elevation CSV file
            const molaContent = await import('file://./assets/terrain/gusev-mola-128.csv');
            this.molaData = this.parseCSV(molaContent.default);
            
            // Read albedo/color CSV file  
            const albedoContent = await import('file://./assets/terrain/gusev-albedo-256.csv');
            this.albedoData = this.parseCSV(albedoContent.default);
            
            console.log('NASA data loaded successfully');
            console.log(`MOLA grid: ${this.molaData.gridWidth} x ${this.molaData.gridHeight}`);
            console.log(`Albedo grid: ${this.albedoData.gridWidth} x ${this.albedoData.gridHeight}`);
            
        } catch (error) {
            console.warn('NASA data files not found or failed to load, using procedural fallback');
            console.error(error.message);
            this.molaData = null;
            this.albedoData = null;
        }
    }
    
    /**
     * Parse CSV content into a 2D grid array
     */
    parseCSV(csvText) {
        const lines = csvText.trim().split('\n');
        const grid = [];
        
        for (let y = 0; y < lines.length; y++) {
            const row = lines[y].split(',').map(val => parseFloat(val.trim()));
            grid.push(row);
        }
        
        return {
            grid: grid,
            gridWidth: grid[0]?.length || 128,
            gridHeight: grid.length || 128
        };
    }
    
    /**
     * Get elevation at world coordinates (x, y) using NASA MOLA data with interpolation
     */
    getMOLAAverageElevation(x, y) {
        if (!this.molaData || !this.molaData.grid) {
            return null;
        }
        
        // Convert world coordinates to grid coordinates
        const gridX = Math.floor((x + 10000) / this.molaSpacing);
        const gridY = Math.floor((y + 10000) / this.molaSpacing);
        
        // Check if within grid bounds
        const minGridX = Math.max(0, gridX - 2);
        const maxGridX = Math.min(this.molaData.gridWidth - 1, gridX + 2);
        const minGridY = Math.max(0, gridY - 2);
        const maxGridY = Math.min(this.molaData.gridHeight - 1, gridY + 2);
        
        // Collect nearby sample points for averaging
        let totalElevation = 0;
        let sampleCount = 0;
        
        for (let gy = minGridY; gy <= maxGridY; gy++) {
            for (let gx = minGridX; gx <= maxGridX; gx++) {
                if (gy < this.molaData.grid.length && gx < this.molaData.grid[gy].length) {
                    totalElevation += this.molaData.grid[gy][gx];
                    sampleCount++;
                }
            }
        }
        
        if (sampleCount === 0) {
            return null;
        }
        
        const averageElevation = totalElevation / sampleCount;
        
        // Cache the result
        this.elevationCache.set(`${x},${y}`, averageElevation);
        
        return {
            elevation: averageElevation,
            originalX: x,
            originalY: y
        };
    }
    
    /**
     * Get albedo/color value at world coordinates
     */
    getAlbedoColor(x, y) {
        if (!this.albedoData || !this.albedoData.grid) {
            return null;
        }
        
        const gridX = Math.floor((x + 10000) / this.molaSpacing);
        const gridY = Math.floor((y + 10000) / this.molaSpacing);
        
        // Simple nearest-neighbor lookup (could be improved with interpolation)
        if (gridY >= 0 && gridY < this.albedoData.grid.length && 
            gridX >= 0 && gridX < this.albedoData.grid[gridY].length) {
            
            const value = this.albedoData.grid[gridY][gridX];
            
            return {
                r: Math.floor(value * 255),
                g: Math.floor(value * 255 * 0.85), // Mars is reddish
                b: Math.floor(value * 255 * 0.6)
            };
        }
        
        return null;
    }
    
    /**
     * Check if a location has significant geological features from NASA data
     */
    hasGeologicalFeatures(x, y) {
        const nasaElevation = this.getMOLAAverageElevation(x, y);
        return nasaElevation !== null && Math.abs(nasaElevation.elevation) > 50;
    }
}

// Export a singleton instance for global use
export const nasaDataLoader = new NASADataLoader();
