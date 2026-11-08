# NASA Orion capsule mesh

Source: https://science.nasa.gov/3d-resources/orion-capsule/
Download: https://assets.science.nasa.gov/content/dam/science/cds/3d/resources/printable/orion-capsule/Orion%20Capsule%20(no%20fbc).stl
Retrieved 8 November 2026. NASA 3D Resources, 51,736 triangles. Original STL retained; runtime scales capsule width to 5 m and adds illustrative materials. Service module and arrays are game geometry, not a flight engineering model. No Kerbal Space Program assets are included. This use does not imply NASA endorsement.

## Full-resolution Moon

Source: https://svs.gsfc.nasa.gov/14959/
Original: https://svs.gsfc.nasa.gov/vis/a010000/a014900/a014959/Moon_NASA_LRO_8k_Topo_Small.glb
Credit: NASA's Goddard Space Flight Center; LRO imagery and topography. Retrieved 8 November 2026. The original 81,505,784-byte GLB is retained unchanged: no mesh simplification or texture resizing. It is loaded once and reused across flybys. A simple sphere is displayed only while downloading/loading, then its GPU resources are released. This is the full original topographic web model supplied by NASA; other NASA variants also exist.

## Phone-only Lite derivative

`moon-lro-lite.glb` is a separate phone-only derivative of the same NASA source: UV-grid vertex clustering (31,539 vertices, 61,462 triangles) and a 2048×1024 texture. Desktop/tablet Auto loads the unchanged full original. Phone Auto loads Lite; selecting Full quality loads the original. No user-agent spoofing or private device fingerprinting is used.
