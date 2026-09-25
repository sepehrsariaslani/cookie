"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { createIngredientFlight, positionStoryCamera, smooth } from "./cookieMotion";
import { DOUGHS, TOPPINGS, type DoughId, type ToppingId } from "@/lib/smule/cookie-builder";
import { smuleAsset } from "@/lib/smule/assets";
import { createCookieBuilderScene, type CustomAppearance } from "./three/cookieBuilderScene";
import { disposeModel } from "./three/disposeModel";

type CookieCanvasProps = {
  variant: "chocolate" | "marble-walnut" | "builder";
  progressRef?: RefObject<number>;
  className?: string;
  customDough?: DoughId;
  customToppings?: ToppingId[];
  customSize?: number;
};

/** Blender authors the geometry and PBR maps; this only lights and presents it. */
export function CookieCanvas({ variant, progressRef, className = "", customDough = "marble", customToppings = [], customSize = 50 }: CookieCanvasProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const customToppingsKey = customToppings.join("|");
  const customAppearanceRef = useRef<CustomAppearance | null>(null);
  const applyCustomRef = useRef<((appearance: CustomAppearance | null) => void) | null>(null);

  useEffect(() => {
    const appearance = variant === "builder"
      ? { dough: customDough, toppings: customToppingsKey.split("|").filter(Boolean) as ToppingId[], sizeGrams: customSize }
      : null;
    customAppearanceRef.current = appearance;
    applyCustomRef.current?.(appearance);
  }, [variant, customDough, customToppingsKey, customSize]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let renderer: THREE.WebGLRenderer | undefined;
    let scene: THREE.Scene | undefined;
    let environment: THREE.WebGLRenderTarget | undefined;
    let resize: ResizeObserver | undefined;
    let visibility: IntersectionObserver | undefined;
    let frame = 0;
    let disposed = false;
    let inView = true;
    let elapsed = 0;
    let lastTime = 0;
    let distance = 10;
    let builderScene: ReturnType<typeof createCookieBuilderScene> | undefined;
    let progress = progressRef?.current ?? 1;
    let vanillaMap: THREE.Texture | undefined;
    let keyLight: THREE.DirectionalLight | undefined;
    const marbleMix = { value: 0 };
    const isBuilder = variant === "builder";
    const isStory = variant === "marble-walnut";
    const flights: ReturnType<typeof createIngredientFlight>[] = [];
    const finishes: Array<{ object: THREE.Object3D; position: THREE.Vector3 }> = [];
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");

    try {
      scene = new THREE.Scene();
      const root = new THREE.Group();
      root.rotation.y = -.3;
      scene.add(root);
      const camera = new THREE.PerspectiveCamera(36, 1, .1, 60);
      const cameraDirection = new THREE.Vector3(.15, 7.5, 8.3).normalize();

      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = isBuilder ? 1 : 1.1;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFShadowMap;
      renderer.domElement.setAttribute("aria-hidden", "true");
      mount.appendChild(renderer.domElement);

      const studio = new RoomEnvironment();
      const pmrem = new THREE.PMREMGenerator(renderer);
      environment = pmrem.fromScene(studio, .04);
      scene.environment = environment.texture;
      scene.environmentIntensity = isBuilder ? .30 : .38;
      studio.dispose();
      pmrem.dispose();

      scene.add(new THREE.HemisphereLight(0xfff2de, 0x66574a, isBuilder ? .48 : .65));
      const key = new THREE.DirectionalLight(0xfff1dc, isBuilder ? 2.2 : 2.8);
      keyLight = key;
      key.position.set(-3, 7, 5);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      Object.assign(key.shadow.camera, { left: -3.5, right: 3.5, top: 3.5, bottom: -3.5, near: .5, far: 18 });
      key.shadow.normalBias = isBuilder ? .008 : .027;
      key.shadow.bias = -.00015;
      scene.add(key);
      const fill = new THREE.DirectionalLight(0xe7efff, isBuilder ? .6 : .8);
      fill.position.set(4, 3, 1);
      scene.add(fill);
      const rim = new THREE.DirectionalLight(0xffe5c4, isBuilder ? 1 : 1.5);
      rim.position.set(1, 4, -4);
      scene.add(rim);

      if (isBuilder) {
        builderScene = createCookieBuilderScene(root, Math.min(renderer.capabilities.getMaxAnisotropy(), 8), (status) => {
          if (disposed) return;
          setUpdating(status === "loading");
          setLoadFailed(status === "error");
          if (status === "ready") {
            setLoaded(true);
            mount.dataset.model = "blender-natural-builder";
          } else if (status === "error") setLoaded(false);
        });
        applyCustomRef.current = builderScene.apply;
        void builderScene.apply(customAppearanceRef.current);
      } else {
        const textureReady = isStory
          ? new THREE.TextureLoader().loadAsync(smuleAsset("/models/smule-cookie-vanilla.webp")).then((texture) => {
              if (disposed) { texture.dispose(); return undefined; }
              texture.flipY = false;
              texture.colorSpace = THREE.SRGBColorSpace;
              vanillaMap = texture;
              return texture;
            }).catch(() => undefined)
          : Promise.resolve(undefined);
        new GLTFLoader().load(smuleAsset(`/models/smule-cookie-${variant}.glb`), async ({ scene: model }) => {
          const vanilla = await textureReady;
          if (disposed) { disposeModel(model); return; }
          const patchedMaterials = new Set<THREE.Material>();
          model.traverse((object) => {
            if (isStory && object.userData.smuleIngredient) flights.push(createIngredientFlight(object));
            if (isStory && ["Salt", "Crumbs"].includes(object.userData.smulePart)) {
              finishes.push({ object, position: object.position.clone() });
            }
            if (!(object instanceof THREE.Mesh)) return;
            object.castShadow = true;
            object.receiveShadow = true;
            for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
              if (material instanceof THREE.MeshStandardMaterial && material.map) {
                material.map.anisotropy = Math.min(renderer!.capabilities.getMaxAnisotropy(), 8);
                let parent: THREE.Object3D | null = object;
                while (parent && parent.userData.smuleSurface !== "dough") parent = parent.parent;
                if (vanilla && parent && isStory && !patchedMaterials.has(material)) {
                  patchedMaterials.add(material);
                  material.onBeforeCompile = (shader) => {
                    shader.uniforms.uVanillaMap = { value: vanilla };
                    shader.uniforms.uMarbleMix = marbleMix;
                    shader.fragmentShader = `uniform sampler2D uVanillaMap;\nuniform float uMarbleMix;\n${shader.fragmentShader}`;
                    const map = THREE.ShaderChunk.map_fragment.replace(
                      "diffuseColor *= sampledDiffuseColor;",
                      "sampledDiffuseColor = mix(texture2D(uVanillaMap, vMapUv), sampledDiffuseColor, uMarbleMix);\n diffuseColor *= sampledDiffuseColor;",
                    );
                    shader.fragmentShader = shader.fragmentShader.replace("#include <map_fragment>", map);
                  };
                  material.customProgramCacheKey = () => "smule-marble-blend-v1";
                }
              }
            }
          });
          root.add(model);
          setLoaded(true);
          mount.dataset.model = `blender-${variant}`;
        }, undefined, () => {
          // Keep the photographic fallback visible if WebGL/model loading fails.
          if (!disposed) setLoaded(false);
        });
      }

      const fit = () => {
        if (!renderer) return;
        const width = Math.max(mount.clientWidth, 1), height = Math.max(mount.clientHeight, 1);
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        // Fit the full silhouette, including on narrow mobile canvases.
        distance = (isBuilder ? 2.72 : 3.06) / Math.tan(THREE.MathUtils.degToRad(18)) / Math.min(camera.aspect, 1);
        camera.position.copy(cameraDirection).multiplyScalar(distance);
        camera.lookAt(0, .15, 0);
        camera.updateProjectionMatrix();
      };
      resize = new ResizeObserver(fit);
      resize.observe(mount);
      fit();

      const render = (time: number) => {
        if (disposed) return;
        const dt = lastTime ? Math.min((time - lastTime) / 1000, .05) : .016;
        lastTime = time;
        if (inView && !document.hidden) {
          elapsed += dt;
          if (isStory) {
            progress = THREE.MathUtils.lerp(progress, progressRef?.current ?? 1, motion.matches ? 1 : 1 - Math.exp(-dt * 12));
            marbleMix.value = smooth(.06, .3, progress);
            flights.forEach((animate) => animate(progress, motion.matches));
            const finish = motion.matches ? Number(progress > .88) : smooth(.8, .94, progress);
            finishes.forEach(({ object, position }) => {
              object.visible = finish > .001;
              object.position.copy(position);
              object.position.y += (1 - finish) * 1.5;
            });
            positionStoryCamera(camera, motion.matches ? 0 : progress, distance);
            root.rotation.y = motion.matches ? -.3 : -.3 + progress * .45;
            root.rotation.z = 0;
            mount.dataset.progress = progress.toFixed(3);
          } else {
            root.rotation.y = -.3 + (motion.matches ? 0 : Math.sin(elapsed * .16) * .22);
            root.rotation.z = motion.matches ? 0 : Math.sin(elapsed * .23) * .012;
          }
          renderer?.render(scene!, camera);
        }
        frame = requestAnimationFrame(render);
      };
      visibility = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; }, { rootMargin: "100px" });
      visibility.observe(mount);
      frame = requestAnimationFrame(render);
    } catch {
      queueMicrotask(() => {
        if (disposed) return;
        setLoaded(false);
        setUpdating(false);
        setLoadFailed(isBuilder);
      });
    }

    return () => {
      disposed = true;
      applyCustomRef.current = null;
      builderScene?.dispose();
      cancelAnimationFrame(frame);
      resize?.disconnect();
      visibility?.disconnect();
      if (scene) disposeModel(scene);
      vanillaMap?.dispose();
      keyLight?.shadow.dispose();
      environment?.dispose();
      renderer?.dispose();
      renderer?.domElement.remove();
    };
  }, [variant, progressRef]);

  const fallbackImage = variant === "builder"
    ? smuleAsset(`/images/builder-dough/${customDough}.png`)
    : smuleAsset(`/images/smule-cookie-${variant}.png`);
  const selectedNames = TOPPINGS.filter((option) => customToppings.includes(option.id)).map((option) => option.name);
  const doughName = DOUGHS.find((option) => option.id === customDough)?.name ?? "کوکی";
  return (
    <div className={`cookie-canvas ${updating ? "is-updating" : ""} ${loadFailed ? "has-load-error" : ""} ${className}`} ref={mountRef} role="img" aria-busy={updating} aria-label={variant === "builder" ? `پیش‌نمایش تقریبی سه‌بعدی ${doughName} ${customSize} گرمی${selectedNames.length ? ` با ${selectedNames.join("، ")}` : " بدون تاپینگ"}` : variant === "chocolate" ? "کوکی دست‌ساز با خمیر کاملاً شکلاتی" : "ساخت کوکی ماربل وانیل و کاکائو با تکه‌های شکلات و گردو، همراه اسکرول"}>
      <img className={`canvas-fallback ${loaded ? "is-hidden" : ""}`} src={fallbackImage} alt="" />
      {variant === "builder" && (updating || loadFailed) && <span className="cookie-preview-message">{loadFailed ? "پیش‌نمایش سه‌بعدی بارگذاری نشد" : "در حال آماده‌سازی کوکی…"}</span>}
    </div>
  );
}
