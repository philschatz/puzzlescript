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
