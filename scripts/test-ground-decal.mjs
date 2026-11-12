import assert from 'node:assert/strict';
import { drapeGroundPositions, groundDecalSegments } from '../game/src/ground-decal.js';

// Exercise offset patches, ramps of either sign and curved ground, including a
// summit whose centre is high above every edge (the old floating-quad case).
const surfaces = [
  () => 3,
  (x,z) => 0.7*x - 0.4*z + 2,
  (x,z) => -0.3*x + 0.8*z - 5,
  (x,z) => 4 - 0.2*(x-12)**2 - 0.15*(z+9)**2,
];
let checked = 0;
for (const span of [0.5, 1.56, 3, 8, 20]) {
  const n = groundDecalSegments(span);
  assert.ok(n >= 2 && n <= 32, 'subdivision work stays bounded');
  if (span <= 8) assert.ok(span / n <= 0.25, 'small decals sample at least every 25 cm');
  for (const height of surfaces) {
    const positions = new Float32Array((n+1)**2*3);
    let i=0;
    for (let row=0;row<=n;row++) for (let col=0;col<=n;col++) {
      positions[i++]=12+(col/n-0.5)*span; positions[i++]=900; positions[i++]=-9+(row/n-0.5)*span;
    }
    const original=positions.slice();
    assert.equal(drapeGroundPositions(positions,height),positions,'updates the existing buffer');
    for(let p=0;p<positions.length;p+=3){
      assert.equal(positions[p],original[p]); assert.equal(positions[p+2],original[p+2]);
      assert.ok(Math.abs(positions[p+1]-height(positions[p],positions[p+2])-0.02)<1e-5,'each vertex touches its own terrain sample');
      checked++;
    }
    const once=positions.slice(); drapeGroundPositions(positions,height);
    assert.deepEqual(positions,once,'reprojection does not accumulate lift');
  }
}
// The old 3 m quad was 0.79 m above the ground at this corner.
const hill=(x,z)=>4-0.2*x*x-0.15*z*z;
const corner=new Float32Array([1.5,4.03,1.5]);
assert.ok(corner[1]-hill(corner[0],corner[2])>0.8);
drapeGroundPositions(corner,hill);
assert.ok(Math.abs(corner[1]-hill(corner[0],corner[2])-0.02)<1e-6);
console.log(`Ground decal contact: ${checked} vertices, ramps, curved ground, bounded tessellation and repeat projection passed.`);
