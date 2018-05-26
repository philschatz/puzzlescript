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

// From https://stackoverflow.com/a/19303725
let seed = 1
let randomValuesForTesting = null
export function nextRandom(maxNonInclusive) {
    if (randomValuesForTesting) {
      if (randomValuesForTesting.length <= seed - 1) {
        throw new Error(`BUG: the list of random values for testing was too short. See calls to setRandomValuesForTesting([...]). The list was [${randomValuesForTesting}]. Index being requested is ${seed - 1}`)
      }
      const ret = randomValuesForTesting[seed - 1]
      seed++
      // console.log(`Sending "random" value of "${ret}"`);

      return ret
    }
    let x = Math.sin(seed++) * 10000
    return Math.round((x - Math.floor(x)) * (maxNonInclusive - 1))
}
export function resetRandomSeed() {
  seed = 1
}
export function setRandomValuesForTesting(values: number[]) {
  randomValuesForTesting = values
  resetRandomSeed()
}
export function clearRandomValuesForTesting() {
  randomValuesForTesting = null
  resetRandomSeed()
}
export function getRandomSeed() {
  return seed
}

export enum RULE_DIRECTION_ABSOLUTE {
  UP = 'UP',
  DOWN = 'DOWN',
  LEFT = 'LEFT',
  RIGHT = 'RIGHT',
}

export const RULE_DIRECTION_ABSOLUTE_LIST = [
  RULE_DIRECTION_ABSOLUTE.UP,
  RULE_DIRECTION_ABSOLUTE.DOWN,
  RULE_DIRECTION_ABSOLUTE.LEFT,
  RULE_DIRECTION_ABSOLUTE.RIGHT
]

export const RULE_DIRECTION_ABSOLUTE_SET: Set<string> = new Set(RULE_DIRECTION_ABSOLUTE_LIST)


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
