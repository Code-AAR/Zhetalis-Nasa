# Zhetalis Space Field Kit

15 original low-poly space models for Unity prototypes, games and presentations.

## Open in Unity

1. Import `Zhetalis-NASA-Space-Pack.unitypackage` using **Assets > Import Package > Custom Package**.
2. Open **Assets/ZhetalisSpacePack/Generated/SpaceGallery.unity**.
3. Press Play to see the display turntables rotate.
4. Drag any asset from **Generated/Prefabs** into your own scene. The prefabs use their original model scale; the gallery resizes only its display instances.

The ZIP is an alternative: copy its `Assets/ZhetalisSpacePack` folder into your project's `Assets` folder, preserving all `.meta` files.

## Materials and pipelines

The included prefabs and gallery use Built-in Standard materials. To create materials for your project's active pipeline, choose **Tools > Zhetalis Space Pack > Create Prefabs and Demo**. This prompts you to save the current scene, generates a new output folder, and opens the new gallery. Existing generated assets are preserved. Use the newly generated prefabs and scene.

The builder selects Standard for Built-in, Universal Render Pipeline/Lit for URP, and HDRP/Lit for HDRP. The appropriate pipeline must already be installed and active. Built-in was validated in Unity 6000.6.8f1; URP and HDRP shader selection is included but has not been validated here.

## Included models

| Model | Triangles |
| --- | ---: |
| Artemis-inspired launch rocket | 2,092 |
| Research satellite | 952 |
| Six-wheel lunar rover | 3,560 |
| Explorer astronaut | 3,296 |
| Orbital research station | 3,972 |
| Mercury, Venus, Earth, Mars, Jupiter | 2,208 each |
| Saturn with double-sided rings | 3,744 |
| Uranus, Neptune, Moon, Sun | 2,208 each |

Total: 37,488 triangles. Shared palette materials, no texture downloads or paid plugins. Each OBJ includes outward face normals and named mesh parts. The original OBJ/MTL files remain editable in a 3D editor.

## Scale and use

- Y up; +Z forward in the source meshes. Equipment uses stylized metre-scale dimensions. The astronaut is about 1.93 m tall and the rocket about 25.1 m tall.
- Celestial bodies have radius 1 Unity unit, with larger rings on Saturn. Planet sizes, surface patterns and the gallery layout are illustrative, not scientific measurements or geographical maps.
- The astronaut is a static model with separate parts. It has no skeleton, skin weights, humanoid rig or walk animation. The rover and station are static mesh assemblies, not simulated vehicles.
- Prefabs include a simple BoxCollider. Replace or disable it for your gameplay needs, especially for planets and station interiors. No rigidbodies, flight simulation or interaction controls are included.
- Meshes use flat shading. UV layouts, PBR textures, LOD levels and baked lightmap UVs are not provided.
- This is original space-themed artwork, including an Artemis-inspired rocket; it is not an engineering-accurate NASA asset set and does not include NASA insignia.

See `model-manifest.json` for triangle counts and bounds. Source meshes, materials and generated prefabs are portable and contain no user-specific filesystem paths.

## Usage permission

You may use, modify and redistribute these original models and scripts in personal or commercial projects. No attribution is required. No third-party model or texture downloads are bundled.
