import * as THREE from "three";

export const smooth = (start: number, end: number, value: number) => {
  const t = THREE.MathUtils.clamp((value - start) / (end - start), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Positions are authored in Blender; every flight returns to that exact pose. */
export function createIngredientFlight(object: THREE.Object3D) {
  const position = object.position.clone();
  const rotation = object.quaternion.clone();
  const index = Number(object.userData.pieceIndex || 0);
  const walnut = object.userData.smuleIngredient === "walnut";
  const stagger = index * (walnut ? .009 : .004);
  const start = (walnut ? .55 : .31) + stagger;
  const end = (walnut ? .73 : .47) + stagger;
  const spin = rotation.clone().multiply(new THREE.Quaternion().setFromEuler(
    new THREE.Euler(.65 + index * .13, -.6 + index * .23, .45 * Math.sin(index)),
  ));
  return (progress: number, reducedMotion: boolean) => {
    const t = reducedMotion ? Number(progress >= end) : smooth(start, end, progress);
    object.visible = t > .001;
    const air = 1 - t;
    object.position.copy(position);
    object.position.x += Math.sin(index * 2.4) * air * .75;
    object.position.y += air * air * (walnut ? 3.5 : 2.8);
    object.position.z += Math.cos(index * 1.7) * air * .5;
    object.quaternion.slerpQuaternions(spin, rotation, t);
  };
}

const cameraStops = [
  [0, .15, 7.5, 8.3, 1],
  [.27, -1.3, 9.2, 6.5, .98],
  [.52, 2.8, 7.5, 8.3, 1.06],
  [.78, -2.1, 7.7, 8.4, 1.06],
  [1, .3, 8.4, 7.5, .96],
];

export function positionStoryCamera(camera: THREE.PerspectiveCamera, progress: number, distance: number) {
  const next = cameraStops.findIndex((stop) => stop[0] >= progress);
  const end = cameraStops[Math.max(next, 1)];
  const start = cameraStops[Math.max(next - 1, 0)];
  const t = smooth(start[0], end[0], progress);
  camera.position.set(
    THREE.MathUtils.lerp(start[1], end[1], t),
    THREE.MathUtils.lerp(start[2], end[2], t),
    THREE.MathUtils.lerp(start[3], end[3], t),
  ).normalize().multiplyScalar(distance * THREE.MathUtils.lerp(start[4], end[4], t));
  camera.lookAt(0, .2, 0);
}
