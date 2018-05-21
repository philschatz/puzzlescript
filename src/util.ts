import { GameSprite } from "./models/tile";

export function setEquals<T>(set1: Set<T>, set2: Set<T>) {
  if (set1.size !== set2.size) return false
  for (const elem of set1) {
    if (!set2.has(elem)) return false
  }
  return true
}

export function setAddAll<T>(setA: Set<T>, iterable: Iterable<T>) {
  const newSet = new Set(setA)
  for (const elem of iterable) {
    newSet.add(elem)
  }
  return newSet
}

export function setIntersection<T>(setA: Set<T>, setB: Set<T>) {
  const intersection = new Set()
  for (const elem of setB) {
    if (setA.has(elem)) {
      intersection.add(elem)
    }
  }
  return intersection
}

export function setDifference<T>(setA: Set<T>, setB: Set<T>) {
  const difference = new Set(setA)
  for (const elem of setB) {
    difference.delete(elem)
  }
  return difference
}

export class SpriteSet {
  _allSprites: GameSprite
  constructor(sprites: GameSprite[]) {

  }
}

// From https://stackoverflow.com/a/19303725
let seed = 1
export function nextRandom(maxNonInclusive) {
    let x = Math.sin(seed++) * 10000
    return Math.round((x - Math.floor(x)) * (maxNonInclusive - 1))
}
export function resetRandomSeed() {
  seed = 1
}

export enum RULE_MODIFIER {
  RANDOM = 'RANDOM',
  UP = 'UP',
  DOWN = 'DOWN',
  LEFT = 'LEFT',
  RIGHT = 'RIGHT',
  VERTICAL = 'VERTICAL',
  HORIZONTAL = 'HORIZONTAL',
  ORTHOGONAL = 'ORTHOGONAL',
  LATE = 'LATE',
  RIGID = 'RIGID'
}
