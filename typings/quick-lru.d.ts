// Typings derived from @types/quick-lru but exporting default
declare module 'quick-lru' {
  export = QuickLRU;

  class QuickLRU<K, V> implements Iterable<[K, V]> {
      readonly size: number;
      constructor(options?: Options);
      [Symbol.iterator](): Iterator<[K, V]>;
      set(key: K, value: V): this;
      get(key: K): V | undefined;
      has(key: K): boolean;
      peek(key: K): V | undefined;
      delete(key: K): void;
      clear(): void;
      keys(): Iterable<K>;
      values(): Iterable<V>;
  }

  interface Options {
      maxSize: number;
  }
}