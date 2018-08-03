import { Optional } from "./util";

export interface Comparator<T> {
    (a: T, b: T): number
}

export class SortedArray<T> implements Iterable<T> {
    private readonly comparator: Comparator<T>
    private ary: T[]
    constructor(comparator: Comparator<T>) {
        this.comparator = comparator
        this.ary = []
    }
    [Symbol.iterator]() {
        return this.ary[Symbol.iterator]()
    }
    add(newItem: T) {
        if (this.ary.indexOf(newItem) < 0) {
            this.ary.push(newItem)
            this.ary.sort(this.comparator)
        }
    }

    delete(item: T) {
        const index = this.ary.indexOf(item)
        this.ary.splice(index, 1)
    }

    has(item: T) {
        return this.ary.indexOf(item) >= 0
    }

    isEmpty() {
        return this.ary.length === 0
    }
    size() {
        return this.ary.length
    }
    clear() {
        this.ary = []
    }
}

export class SortedList<T> implements Iterable<T> {
    static fromIterable<T>(iterable: Iterable<T>, comparator: Comparator<T>) {
        const list = new SortedList(comparator)
        for (const item of iterable) {
            list.add(item)
        }
        return list
    }
    private readonly comparator: Comparator<T>
    private head: Optional<ListItem<T>>
    constructor(comparator: Comparator<T>) {
        this.comparator = comparator
    }
    [Symbol.iterator]() {
        return new ListIterator<T>(this.head)
    }
    add(newItem: T) {
        let prev: Optional<ListItem<T>> = null
        let current = this.head

        while(current) {
            // check if the current node is less than the new node
            const cmp = current.item === newItem ? 0 : this.comparator(current.item, newItem)
            if (cmp === 0) {
                return false // item already exists in our list
            } else if (cmp > 0) {
                break // add here
            }
            prev = current
            current = current.next
        }

        // Cases:
        // - add to middle of list (current and prev) add just before current
        // - add to end of list (!current and prev)
        // - add to beginning of list (current and !prev)
        // - empty list (!current and !prev)
        if (prev && current) {
            // insert before the prev
            const node = new ListItem<T>(newItem, prev, current)
            prev.next = node
            current.previous = node
            // this.head = node
        } else if (prev) {
            // same as previous case except we don't repoint current.previous
            const node = new ListItem<T>(newItem, prev, current)
            prev.next = node
            // current.previous = node
            // this.head = node
        } else if (current) {
            // insert before the prev
            const node = new ListItem<T>(newItem, prev, current)
            // prev.next = node
            current.previous = node
            this.head = node
        } else {
            const node = new ListItem<T>(newItem, prev, current)
            // prev.next = node
            // current.previous = node
            this.head = node
        }
        return true // added
    }

    delete(item: T) {
        const node = this.findNode(item)
        if (node) {

            // detach
            if (node.previous) {
                node.previous.next = node.next
            } else if (this.head === node) {
                this.head = node.next
            } else {
                throw new Error(`BUG: Invariant violation`)
            }
            if (node.next) {
                node.next.previous = node.previous
            }
            return true
        } else {
            throw new Error(`BUG: Item was not in the list`)
            // return false
        }
    }

    private findNode(item: T) {
        let current = this.head
        while (current) {
            if (current.item === item || this.comparator(current.item, item) === 0) {
                return current
            }
            current = current.next
        }
        return null
    }

    has(item: T) {
        return !!this.findNode(item)
    }

    isEmpty() {
        return !this.head
    }
    size() {
        let size = 0
        for (const item of this) {
            item // just so the variable is not marked as unused
            size++
        }
        return size
    }
    clear() {
        this.head = null
    }
    first() {
        if (this.head) {
            return this.head.item
        } else {
            throw new Error(`BUG: List was empty so cannot get first cell`)
        }
    }
}

class ListItem<T> {
    item: T
    previous: Optional<ListItem<T>>
    next: Optional<ListItem<T>>
    constructor(item: T, previous: Optional<ListItem<T>>, next: Optional<ListItem<T>>) {
        this.item = item
        this.previous = previous
        this.next = next
    }
}

class ListIterator<T> implements Iterator<T> {
    private listHead: Optional<ListItem<T>>
    private current: Optional<ListItem<T>>
    constructor(listHead: Optional<ListItem<T>>) {
        this.listHead = listHead
        this.current = null
    }
    next(value?: any) {
        if (this.listHead) {
            this.current = this.listHead
            this.listHead = null
        } else if (this.current) {
            // increment right before we return the item, not earlier because folks could have add items in
            this.current = this.current.next
        }
        if (this.current) {
            return new ListIteratorResult<T>(this.current.item)
        } else {
            return new IteratorResultDone<T>()
        }
    }
}

class IteratorResultDone<T> implements IteratorResult<T> {
    done: true
    value: T
    constructor() {
        this.done = true
        this.value = <T> {}
    }
}
class ListIteratorResult<T> implements IteratorResult<T> {
    value: T
    done: false
    constructor(value: T) {
        this.done = false
        this.value = value
    }
}