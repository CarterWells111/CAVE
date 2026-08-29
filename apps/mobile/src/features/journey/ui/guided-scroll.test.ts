import {
  calculateRevealOffset,
  createGuidedScrollCoordinator,
  type GuidedScrollNode,
} from "./guided-scroll";

function node(y: number, height: number): GuidedScrollNode {
  return {
    measureInWindow(callback) {
      callback(0, y, 320, height);
    },
  };
}

test("does not move when the complete target is already visible", () => {
  expect(calculateRevealOffset({
    currentOffset: 240,
    gap: 16,
    mode: "down-only",
    targetHeight: 48,
    targetTop: 420,
    viewportHeight: 640,
    viewportTop: 0,
  })).toBeNull();
});

test("moves only enough to reveal a target below the viewport", () => {
  expect(calculateRevealOffset({
    currentOffset: 240,
    gap: 16,
    mode: "down-only",
    targetHeight: 64,
    targetTop: 620,
    viewportHeight: 640,
    viewportTop: 0,
  })).toBe(300);
});

test("aligns an oversized target to the safe viewport top", () => {
  expect(calculateRevealOffset({
    currentOffset: 100,
    gap: 16,
    mode: "down-only",
    targetHeight: 720,
    targetTop: 80,
    viewportHeight: 640,
    viewportTop: 0,
  })).toBe(164);
});

test("nearest mode can make the smallest upward correction", () => {
  expect(calculateRevealOffset({
    currentOffset: 500,
    gap: 16,
    mode: "nearest",
    targetHeight: 80,
    targetTop: -20,
    viewportHeight: 640,
    viewportTop: 0,
  })).toBe(464);
});

test("a newer request cancels an older scheduled reveal", () => {
  const scheduled: Array<() => void> = [];
  const scrollTo = jest.fn();
  const targets = new Map([
    ["old", node(700, 48)],
    ["new", node(760, 48)],
  ]);
  const coordinator = createGuidedScrollCoordinator({
    gap: 16,
    getCurrentOffset: () => 100,
    getReducedMotion: () => false,
    getScrollNode: () => ({ ...node(0, 640), scrollTo }),
    getTarget: (id) => targets.get(id) ?? null,
    schedule: (callback) => scheduled.push(callback),
  });

  coordinator.reveal("old");
  coordinator.reveal("new");
  scheduled.forEach((callback) => callback());

  expect(scrollTo).toHaveBeenCalledTimes(1);
  expect(scrollTo).toHaveBeenCalledWith({ animated: true, y: 284 });
});

test("cancel, dispose, missing targets and failed measurements never scroll", () => {
  const scheduled: Array<() => void> = [];
  const scrollTo = jest.fn();
  const brokenNode: GuidedScrollNode = { measureInWindow: () => undefined };
  const targets = new Map<string, GuidedScrollNode>([["broken", brokenNode]]);
  const coordinator = createGuidedScrollCoordinator({
    gap: 16,
    getCurrentOffset: () => 0,
    getReducedMotion: () => false,
    getScrollNode: () => ({ ...node(0, 640), scrollTo }),
    getTarget: (id) => targets.get(id) ?? null,
    schedule: (callback) => scheduled.push(callback),
  });

  coordinator.reveal("missing");
  coordinator.cancel();
  coordinator.reveal("broken");
  scheduled.forEach((callback) => callback());
  coordinator.dispose();
  coordinator.reveal("broken");

  expect(scrollTo).not.toHaveBeenCalled();
});

test("thrown native measurement failures are ignored", () => {
  const scrollTo = jest.fn();
  const coordinator = createGuidedScrollCoordinator({
    gap: 16,
    getCurrentOffset: () => 0,
    getReducedMotion: () => false,
    getScrollNode: () => ({ ...node(0, 640), scrollTo }),
    getTarget: () => ({
      measureInWindow() {
        throw new Error("native-measure-failed");
      },
    }),
    schedule: (callback) => callback(),
  });

  expect(() => coordinator.reveal("broken")).not.toThrow();
  expect(scrollTo).not.toHaveBeenCalled();
});

test("reduced motion uses an immediate native scroll", () => {
  const scrollTo = jest.fn();
  const coordinator = createGuidedScrollCoordinator({
    gap: 16,
    getCurrentOffset: () => 0,
    getReducedMotion: () => true,
    getScrollNode: () => ({ ...node(0, 640), scrollTo }),
    getTarget: () => node(700, 48),
    schedule: (callback) => callback(),
  });

  coordinator.reveal("continue");

  expect(scrollTo).toHaveBeenCalledWith({ animated: false, y: 124 });
});
