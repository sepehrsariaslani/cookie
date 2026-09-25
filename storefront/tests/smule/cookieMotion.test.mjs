import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createIngredientFlight, positionStoryCamera, smooth } from "../../components/smule/cookieMotion.ts";

test("smooth progress is bounded and monotonic", () => {
  assert.equal(smooth(.06, .3, 0), 0);
  assert.equal(smooth(.06, .3, 1), 1);
  let previous = 0;
  for (let p = 0; p <= 1; p += .01) {
    const current = smooth(.06, .3, p);
    assert.ok(current >= previous);
    previous = current;
  }
});

for (const [ingredient, count, middle] of [["chocolate", 17, .43], ["walnut", 8, .66]]) {
  test(`${ingredient} flights are reversible and preserve every Blender landing pose`, () => {
    for (let index = 0; index < count; index++) {
      const part = new THREE.Object3D();
      part.position.set(index * .07 - .7, .51, index * .12 - 1);
      part.rotation.set(.1, .25, .31);
      part.scale.set(1.1, .9, 1.2);
      part.userData = { smuleIngredient: ingredient, pieceIndex: index };
      const original = part.clone();
      const animate = createIngredientFlight(part);
      animate(0, false);
      assert.equal(part.visible, false);
      animate(middle, false);
      assert.equal(part.visible, true);
      assert.ok(part.position.y > original.position.y);
      const flightPose = part.position.clone();
      const flightRotation = part.quaternion.clone();
      animate(1, false);
      assert.ok(part.position.distanceTo(original.position) < 1e-10);
      assert.ok(part.quaternion.angleTo(original.quaternion) < 1e-7);
      assert.ok(part.scale.equals(original.scale));
      animate(middle, false);
      assert.ok(part.position.equals(flightPose));
      assert.ok(part.quaternion.equals(flightRotation));
      animate(0, true);
      assert.equal(part.visible, false);
      animate(1, true);
      assert.equal(part.visible, true);
      assert.ok(part.position.equals(original.position));
    }
  });
}

test("camera path stays continuous, finite and outside the cookie", () => {
  const camera = new THREE.PerspectiveCamera(36, 1, .1, 60);
  let previous;
  for (let index = 0; index <= 1000; index++) {
    positionStoryCamera(camera, index / 1000, 10);
    assert.ok(camera.position.toArray().every(Number.isFinite));
    assert.ok(camera.position.length() >= 9.59);
    assert.ok(camera.position.length() <= 10.61);
    if (previous) assert.ok(camera.position.distanceTo(previous) < .04);
    previous = camera.position.clone();
  }
});
