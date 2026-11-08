// Pure sampling of archived NASA MOLA elevations. No procedural height noise.
export function createMeasuredTerrain(samples, meta) {
  const n=meta.n,span=meta.worldSpan;
  if(samples.length!==n*n)throw new Error('Invalid MOLA terrain dimensions');
  const clamp=v=>Math.max(0,Math.min(n-1,v));
  function elevation(x,z){
    const u=clamp((x/span+.5)*n-.5),v=clamp((z/span+.5)*n-.5);
    const x0=Math.floor(u),z0=Math.floor(v),x1=Math.min(n-1,x0+1),z1=Math.min(n-1,z0+1),fx=u-x0,fz=v-z0;
    const a=samples[z0*n+x0]*(1-fx)+samples[z0*n+x1]*fx;
    const b=samples[z1*n+x0]*(1-fx)+samples[z1*n+x1]*fx;
    return a*(1-fz)+b*fz;
  }
  const origin=elevation(0,0);
  return {elevation,origin,height(x,z){
    const r=Math.hypot(x,z),t=Math.max(0,Math.min(1,(r-meta.flatBaseRadius)/(meta.flatBaseBlendEnd-meta.flatBaseRadius)));
    return (elevation(x,z)-origin)*meta.verticalScale*t*t*(3-2*t);
  }};
}
