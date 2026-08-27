import { motion, type MotionContract } from "./tokens";

export const reducedMotion: MotionContract = Object.freeze({
  duration: Object.freeze({
    instant: 0,
    fast: 0,
    standard: 0,
    slow: 0
  })
});

export function motionFor(reduceMotion: boolean): MotionContract {
  return reduceMotion ? reducedMotion : motion;
}
