// TypeScript definition for the package
declare module 'bitset' {

    class BitSet {
        get: (i: number) => number
        set: (i: number) => void
        clear: (from?: number, to?: number) => void
        slice: (from: number, to: number) => BitSet
        clone: () => BitSet
        and: (b: BitSet) => BitSet
        or: (b: BitSet) => BitSet
        isEmpty: () => boolean
        cardinality: () => number
    }

    export default BitSet
}

