// Static ground decals use world-space vertices. Sample after all X/Z transforms,
// rather than lifting one horizontal quad to the height of its centre.
export function groundDecalSegments(span) {
  return Math.min(32, Math.max(2, Math.ceil(span / 0.25)));
}

export function drapeGroundPositions(positions, heightAt, lift = 0.02) {
  for (let i = 0; i < positions.length; i += 3) {
    positions[i + 1] = heightAt(positions[i], positions[i + 2]) + lift;
  }
  return positions;
}
