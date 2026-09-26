import test from "node:test";
import assert from "node:assert/strict";
import { isCurrentLocationRequest } from "../../lib/smule/location-request.ts";

test("delivery coordinates are accepted only for the current request and address", () => {
  const request = { id: 4, revision: 7 };

  assert.equal(isCurrentLocationRequest(request, 4, 7), true);
  assert.equal(isCurrentLocationRequest(request, 5, 7), false);
  assert.equal(isCurrentLocationRequest(request, 4, 8), false);
});
