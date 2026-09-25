import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { DoughId, ToppingId } from "@/lib/smule/cookie-builder";
import { smuleAsset } from "@/lib/smule/assets";
import { disposeModel } from "./disposeModel";

export type CustomAppearance = { dough: DoughId; toppings: ToppingId[]; sizeGrams: number };

/** Blender supplies complete PBR materials. No color-tint or shader substitution. */
export function createCookieBuilderScene(
  root: THREE.Group,
  anisotropy: number,
  status: (value: "loading" | "ready" | "error") => void,
) {
  const loader = new GLTFLoader();
  const models = new Map<DoughId, THREE.Group>();
  const requests = new Map<DoughId, Promise<THREE.Group>>();
  const toppings = new Map<ToppingId, THREE.Object3D>();
  const surfaces = new Map<string, THREE.Object3D>();
  let disposed = false;
  let revision = 0;
  let visibleDough: DoughId | undefined;
  let desiredDough: DoughId | undefined;

  function trimCache() {
    for (const [id, model] of models) {
      if (models.size <= 3) break;
      if (id === visibleDough || id === desiredDough) continue;
      root.remove(model);
      disposeModel(model);
      models.delete(id);
      requests.delete(id);
    }
  }

  function prepare(model: THREE.Group) {
    model.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow = true;
      object.receiveShadow = true;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (material instanceof THREE.MeshStandardMaterial) {
          for (const map of [material.map, material.normalMap, material.roughnessMap]) {
            if (map) map.anisotropy = anisotropy;
          }
        }
      }
    });
  }

  const ingredients = loader.loadAsync(smuleAsset("/models/smule-cookie-builder-natural-ingredients.glb")).then(({ scene }) => {
    if (disposed) { disposeModel(scene); return; }
    prepare(scene);
    scene.traverse((object) => {
      if (object.userData.smuleTopping) {
        toppings.set(object.userData.smuleTopping as ToppingId, object);
        object.visible = false;
      }
      if (object.userData.smuleDoughSurface) {
        surfaces.set(object.userData.smuleDoughSurface, object);
        object.visible = false;
      }
    });
    root.add(scene);
  });
  // apply() handles failures; attach a handler immediately during initial load.
  void ingredients.catch(() => undefined);

  function loadDough(id: DoughId): Promise<THREE.Group> {
    const cached = requests.get(id);
    if (cached) return cached;
    const request = loader.loadAsync(smuleAsset(`/models/builder-dough/${id}.glb`)).then(({ scene }) => {
      if (disposed) { disposeModel(scene); return scene; }
      prepare(scene);
      scene.visible = false;
      models.set(id, scene);
      root.add(scene);
      trimCache();
      return scene;
    });
    requests.set(id, request);
    void request.catch(() => requests.delete(id));
    return request;
  }

  async function apply(appearance: CustomAppearance | null) {
    if (!appearance || disposed) return;
    const version = ++revision;
    desiredDough = appearance.dough;
    if (visibleDough !== appearance.dough) status("loading");
    try {
      await Promise.all([ingredients, loadDough(appearance.dough)]);
      if (disposed || version !== revision) return;
      models.forEach((model, id) => { model.visible = id === appearance.dough; });
      const selected = new Set(appearance.toppings);
      toppings.forEach((group, id) => { group.visible = selected.has(id); });
      surfaces.forEach((group, surface) => {
        group.visible = surface === "oat"
          ? appearance.dough === "oat" || appearance.dough === "banana-oat"
          : surface === appearance.dough;
      });
      root.scale.setScalar(Math.min(1.25, Math.max(.84, Math.cbrt(appearance.sizeGrams / 50))));
      visibleDough = appearance.dough;
      const active = models.get(appearance.dough);
      if (active) { models.delete(appearance.dough); models.set(appearance.dough, active); }
      trimCache();
      status("ready");
    } catch {
      if (!disposed && version === revision) status("error");
    }
  }

  // Attached models are released by the canvas; late arrivals release themselves.
  return { apply, dispose: () => { disposed = true; revision++; } };
}
