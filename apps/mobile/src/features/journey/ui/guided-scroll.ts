export type GuidedScrollMode = "down-only" | "nearest";

export type GuidedScrollNode = {
  measureInWindow(
    callback: (x: number, y: number, width: number, height: number) => void,
  ): void;
};

export type GuidedScrollContainer = GuidedScrollNode & {
  scrollTo(options: { animated: boolean; y: number }): void;
};

type RevealGeometry = {
  currentOffset: number;
  gap: number;
  mode: GuidedScrollMode;
  targetHeight: number;
  targetTop: number;
  viewportHeight: number;
  viewportTop: number;
};

export function calculateRevealOffset({
  currentOffset,
  gap,
  mode,
  targetHeight,
  targetTop,
  viewportHeight,
  viewportTop,
}: RevealGeometry): number | null {
  const safeTop = viewportTop + gap;
  const safeBottom = viewportTop + viewportHeight - gap;
  const safeHeight = Math.max(0, safeBottom - safeTop);
  const targetBottom = targetTop + targetHeight;
  let delta: number | null = null;

  if (targetHeight > safeHeight) {
    delta = targetTop - safeTop;
  } else if (targetBottom > safeBottom) {
    delta = targetBottom - safeBottom;
  } else if (mode === "nearest" && targetTop < safeTop) {
    delta = targetTop - safeTop;
  }

  if (delta === null || delta === 0 || (mode === "down-only" && delta < 0)) return null;
  return Math.max(0, currentOffset + delta);
}

type GuidedScrollDependencies = {
  gap: number;
  getCurrentOffset(): number;
  getReducedMotion(): boolean;
  getScrollNode(): GuidedScrollContainer | null;
  getTarget(id: string): GuidedScrollNode | null;
  schedule(callback: () => void): void;
};

export type GuidedScrollCoordinator = {
  cancel(): void;
  dispose(): void;
  reveal(id: string, options?: { mode?: GuidedScrollMode }): void;
};

export function createGuidedScrollCoordinator(
  dependencies: GuidedScrollDependencies,
): GuidedScrollCoordinator {
  let generation = 0;
  let disposed = false;

  return {
    cancel() {
      generation += 1;
    },
    dispose() {
      disposed = true;
      generation += 1;
    },
    reveal(id, options) {
      if (disposed) return;
      const requestGeneration = ++generation;
      dependencies.schedule(() => {
        if (disposed || requestGeneration !== generation) return;
        const scrollNode = dependencies.getScrollNode();
        const target = dependencies.getTarget(id);
        if (scrollNode === null || target === null) return;

        try {
          scrollNode.measureInWindow((_scrollX, viewportTop, _scrollWidth, viewportHeight) => {
            if (disposed || requestGeneration !== generation) return;
            try {
              target.measureInWindow((_targetX, targetTop, _targetWidth, targetHeight) => {
                if (disposed || requestGeneration !== generation) return;
                const y = calculateRevealOffset({
                  currentOffset: dependencies.getCurrentOffset(),
                  gap: dependencies.gap,
                  mode: options?.mode ?? "down-only",
                  targetHeight,
                  targetTop,
                  viewportHeight,
                  viewportTop,
                });
                if (y === null) return;
                scrollNode.scrollTo({ animated: !dependencies.getReducedMotion(), y });
              });
            } catch {
              // Native target measurement may fail while layout is changing.
            }
          });
        } catch {
          // Native viewport measurement may fail during navigation or teardown.
        }
      });
    },
  };
}
