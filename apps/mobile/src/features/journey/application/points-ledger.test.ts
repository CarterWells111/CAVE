import { addPointEvent, getPointSummary, type PointEvent } from "./points-ledger";

const LEARNING: PointEvent = { key: "learning:draft-card:v1", kind: "learning", points: 10 };

test("awards a versioned event idempotently", () => {
  const once = addPointEvent([], LEARNING);
  const twice = addPointEvent(once, LEARNING);

  expect(once).toEqual([LEARNING.key]);
  expect(twice).toBe(once);
  expect(getPointSummary(twice)).toEqual({ total: 10, completedEventKeys: [LEARNING.key] });
});

test("derives points only from allowed task keys, never private choices or text", () => {
  const events: PointEvent[] = [
    LEARNING,
    { key: "reflection:page-5:v1", kind: "reflection", points: 15 },
    { key: "practice:draft-kissing:draft-v1", kind: "practice", points: 20 },
    { key: "review:checklist:v1", kind: "review", points: 15 }
  ];
  const keys = events.reduce(addPointEvent, [] as string[]);

  expect(getPointSummary(keys)).toEqual({
    total: 60,
    completedEventKeys: events.map(({ key }) => key)
  });
  expect(JSON.stringify(events)).not.toMatch(/attitude|userText|journalSaveChoice|length/u);
});
