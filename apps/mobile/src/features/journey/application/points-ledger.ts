export type PointEvent = {
  key: string;
  kind: "learning" | "reflection" | "practice" | "review";
  points: number;
};

const POINTS_BY_KIND: Record<PointEvent["kind"], number> = {
  learning: 10,
  reflection: 15,
  practice: 20,
  review: 15
};

export function addPointEvent(keys: string[], event: PointEvent): string[] {
  if (keys.includes(event.key)) return keys;
  return [...keys, event.key];
}

export function getPointSummary(keys: string[]) {
  return {
    total: keys.reduce((total, key) => {
      const kind = key.slice(0, key.indexOf(":")) as PointEvent["kind"];
      return total + (POINTS_BY_KIND[kind] ?? 0);
    }, 0),
    completedEventKeys: [...keys]
  };
}
