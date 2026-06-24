import data from "./birds.json";

/**
 * 3D model manifest. Each species maps to a procedural Blender GLB
 * (`/assets/birds3d/<id>/<id>.glb`) with a shared rig and 8 animation clips.
 * `GENERATED_3D` tracks which models have actually been built/exported so far;
 * the rest fall back to the 2D illustration until generated.
 */

export const BIRD_ANIMATIONS = ["idle", "hop", "peck", "look_around", "flap", "short_fly", "sleep", "happy"] as const;

export interface Bird3D {
  id: string;
  commonName: string;
  scientificName: string;
  region: string;
  habitat: string[];
  rarityTier: string;
  model: string;
  animations: string[];
  fieldMarks: string[];
}

export const BIRDS_3D: Bird3D[] = (data as Array<Omit<Bird3D, "model" | "animations">>).map((b) => ({
  ...b,
  model: `/assets/birds3d/${b.id}/${b.id}.glb`,
  animations: [...BIRD_ANIMATIONS],
}));

/** Species whose GLB has actually been generated (all 60). */
export const GENERATED_3D = new Set<string>(BIRDS_3D.map((b) => b.id));

export function model3dFor(id: string | null | undefined): string | null {
  return id && GENERATED_3D.has(id) ? `/assets/birds3d/${id}/${id}.glb` : null;
}
