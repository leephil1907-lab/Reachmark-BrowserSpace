import test from "node:test";
import assert from "node:assert/strict";
import { profilePartition } from "./profile-utils.js";

test("profile partitions are stable across runtime restarts", () => {
  const id = "profile-123";
  assert.equal(profilePartition(id), profilePartition(id));
  assert.equal(profilePartition(id), "persist:browserspace-profile-123");
});

test("different profiles always receive different persistent partitions", () => {
  assert.notEqual(profilePartition("profile-a"), profilePartition("profile-b"));
});

test("invalid profile identifiers are rejected", () => {
  assert.throws(() => profilePartition("../profile"), /Invalid profile identifier/);
  assert.throws(() => profilePartition(""), /Invalid profile identifier/);
});
