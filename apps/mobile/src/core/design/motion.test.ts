import { motionFor, reducedMotion } from "./motion";
import { motion } from "./tokens";

describe("motion preferences", () => {
  it("keeps standard motion durations available when reduction is off", () => {
    expect(motionFor(false)).toBe(motion);
    expect(Object.values(motionFor(false).duration).some((duration) => duration > 0)).toBe(true);
  });

  it("sets every duration to zero when reduced motion is requested", () => {
    expect(motionFor(true)).toBe(reducedMotion);
    expect(Object.values(motionFor(true).duration)).toEqual([0, 0, 0, 0]);
  });

  it("uses the approved restrained duration scale", () => {
    expect(motion.duration).toEqual({ instant: 0, fast: 120, standard: 200, slow: 260 });
  });

  it("returns frozen motion contracts", () => {
    for (const contract of [motion, motion.duration, reducedMotion, reducedMotion.duration]) {
      expect(Object.isFrozen(contract)).toBe(true);
    }
  });
});
