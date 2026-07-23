import { describe, expect, it } from "vitest";
import {
  computeReleaseDigest,
  sha256File,
} from "../build-manifest.js";
import {
  resolveRunTrafficClassification,
} from "../services/run-traffic-classification.js";
import { writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";

describe("run traffic classification", () => {
  it("fails closed when unset", () => {
    const c = resolveRunTrafficClassification({});
    expect(c.trafficClass).toBe("system");
    expect(c.actionable).toBe(false);
    expect(c.actionabilityReason).toBe("unset_fail_closed");
  });

  it("stamps natural/actionable for trusted board user sessions", () => {
    const c = resolveRunTrafficClassification({ requestedByActorType: "user", source: "on_demand" });
    expect(c.trafficClass).toBe("natural");
    expect(c.actionable).toBe(true);
  });

  it("keeps timers/system non-actionable", () => {
    const c = resolveRunTrafficClassification({ source: "timer", triggerDetail: "system" });
    expect(c.trafficClass).toBe("system");
    expect(c.actionable).toBe(false);
  });

  it("honors explicit trusted boundary stamp (canary token path)", () => {
    const c = resolveRunTrafficClassification({
      source: "on_demand",
      trafficClassification: {
        trafficClass: "canary",
        actionable: true,
        actionabilityReason: "board_token_consumed",
      },
    });
    expect(c.trafficClass).toBe("canary");
    expect(c.actionable).toBe(true);
    expect(c.actionabilityReason).toBe("board_token_consumed");
  });

  it("does not trust raw title-like payload fields (ignored)", () => {
    // resolveRunTrafficClassification never reads payload/titles — only opts.trafficClassification
    const c = resolveRunTrafficClassification({
      source: "automation",
      requestedByActorType: "system",
    });
    expect(c.trafficClass).toBe("system");
    expect(c.actionable).toBe(false);
  });
});

describe("release digest", () => {
  it("is stable over sorted package digests and catches tamper", () => {
    const candidateSha = "a".repeat(40);
    const packages = [
      { name: "paperclipai-server", sha256: "b".repeat(64) },
      { name: "paperclipai-db", sha256: "c".repeat(64) },
    ];
    const d1 = computeReleaseDigest({ candidateSha, packageDigests: packages });
    const d2 = computeReleaseDigest({
      candidateSha,
      packageDigests: [...packages].reverse(),
    });
    expect(d1).toBe(d2);
    const tampered = computeReleaseDigest({
      candidateSha,
      packageDigests: [{ name: "paperclipai-server", sha256: "d".repeat(64) }, packages[1]!],
    });
    expect(tampered).not.toBe(d1);
  });

  it("sha256File matches crypto", () => {
    const p = join(tmpdir(), `paperclip-digest-${Date.now()}.bin`);
    writeFileSync(p, "hello-digest");
    try {
      const got = sha256File(p);
      expect(got.sha256).toBe(createHash("sha256").update("hello-digest").digest("hex"));
      expect(got.bytes).toBe(Buffer.byteLength("hello-digest"));
    } finally {
      unlinkSync(p);
    }
  });
});
