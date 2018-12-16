import { Optional } from '../util'

/**
 * Seedable random number generator functions.
 * @version 1.0.0
 * @license Public Domain
 *
 * @example
 * var rng = new RNG('Example');
 * rng.random(40, 50);  // =>  42
 * rng.uniform();       // =>  0.7972798995050903
 * rng.normal();        // => -0.6698504543216376
 * rng.exponential();   // =>  1.0547367609131555
 * rng.poisson(4);      // =>  2
 * rng.gamma(4);        // =>  2.781724687386858
 */

/**
 * Get the underlying bytes of this string.
 * @return {Array} An array of bytes
 */
function getBytes(str: string) {
    let output: number[] = []
    for (let i = 0; i < str.length; i++) {
        let c = str.charCodeAt(i)
        const bytes: number[] = []
        do {
            bytes.push(c & 0xFF) // tslint:disable-line:no-bitwise
            c = c >> 8 // tslint:disable-line:no-bitwise
        } while (c > 0)
        output = output.concat(bytes.reverse())
    }
    return output
}

class RC4 {
    private s: number[]
    private i: number
    private j: number

    /**
     * @param {String} seed A string to seed the generator.
     * @constructor
     */
    constructor(seed: string) {
        this.s = new Array(256)
        this.i = 0
        this.j = 0
        for (let i = 0; i < 256; i++) {
            this.s[i] = i
        }
        if (seed) {
            this.mix(seed)
        }
    }

    public _swap(i: number, j: number) {
        const tmp = this.s[i]
        this.s[i] = this.s[j]
        this.s[j] = tmp
    }

    /**
     * Mix additional entropy into this generator.
     * @param {String} seed
     */
    public mix(seed: string) {
        const input = getBytes(seed)
        let j = 0
        for (let i = 0; i < this.s.length; i++) {
            j += this.s[i] + input[i % input.length]
            j %= 256
            this._swap(i, j)
        }
    }

    /**
     * @return The next byte of output from the generator.
     */
    public next() {
        this.i = (this.i + 1) % 256
        this.j = (this.j + this.s[this.i]) % 256
        this._swap(this.i, this.j)
        return this.s[(this.s[this.i] + this.s[this.j]) % 256]
    }

}

class RNG {
    private _normal: Optional<number>
    private readonly _state: RC4

    /**
     * Create a new random number generator with optional seed. If the
     * provided seed is a function (i.e. Math.random) it will be used as
     * the uniform number generator.
     * @param seed An arbitrary object used to seed the generator.
     * @constructor
     */
    constructor(seed: number) {
        // this.seed = seed;
        // if (seed == null) {
        //     seed = (Math.random() + Date.now()).toString();
        //     //window.console.log("setting random seed "+seed);
        //     //print_call_stack();

        // } else if (typeof seed === 'function') {
        //     // Use it as a uniform number generator
        //     this.uniform = seed;
        //     this.nextByte = function() {
        //         return ~~(this.uniform() * 256);
        //     };
        //     seed = null;
        // } else if (Object.prototype.toString.call(seed) !== '[object String]') {
        //     seed = JSON.stringify(seed);
        // } else {
        //     //window.console.log("setting seed "+seed);
        //     //print_call_stack();
        // }
        this._normal = null
        this._state = new RC4(JSON.stringify(seed))
    }

    /**
     * @return {number} Uniform random number between 0 and 255.
     */
    public nextByte() {
        return this._state.next()
    }

    /**
     * @return {number} Uniform random number between 0 and 1.
     */
    public uniform() {
        const BYTES = 7 // 56 bits to make a 53-bit double
        let output = 0
        for (let i = 0; i < BYTES; i++) {
            output *= 256
            output += this.nextByte()
        }
        return output / (Math.pow(2, BYTES * 8) - 1)
    }

    /**
     * Produce a random integer within [n, m).
     * @param {number} [n=0]
     * @param {number} m
     *
     */
    public random(n: Optional<number>, m: Optional<number>) {
        if (n === null) {
            return this.uniform()
        } else if (m === null) {
            m = n
            n = 0
        }
        return n + Math.floor(this.uniform() * (m - n))
    }

    /**
     * Generates numbers using this.uniform() with the Box-Muller transform.
     * @return {number} Normally-distributed random number of mean 0, variance 1.
     */
    public normal() {
        if (this._normal !== null) {
            const n = this._normal
            this._normal = null
            return n
        } else {
            const x = this.uniform() || Math.pow(2, -53) // can't be exactly 0
            const y = this.uniform()
            this._normal = Math.sqrt(-2 * Math.log(x)) * Math.sin(2 * Math.PI * y)
            return Math.sqrt(-2 * Math.log(x)) * Math.cos(2 * Math.PI * y)
        }
    }

    /**
     * Generates numbers using this.uniform().
     * @return {number} Number from the exponential distribution, lambda = 1.
     */
    public exponential() {
        return -Math.log(this.uniform() || Math.pow(2, -53))
    }

    /**
     * Generates numbers using this.uniform() and Knuth's method.
     * @param {number} [mean=1]
     * @return {number} Number from the Poisson distribution.
     */
    public poisson(mean: number) {
        const L = Math.exp(-(mean || 1))
        let k = 0
        let p = 1
        do {
            k++
            p *= this.uniform()
        } while (p > L)
        return k - 1
    }

    /**
     * Generates numbers using this.uniform(), this.normal(),
     * this.exponential(), and the Marsaglia-Tsang method.
     * @param {number} a
     * @return {number} Number from the gamma distribution.
     */
    // gamma(a: number) {
    //     var d = (a < 1 ? 1 + a : a) - 1 / 3;
    //     var c = 1 / Math.sqrt(9 * d);
    //     do {
    //         do {
    //             var x = this.normal();
    //             var v = Math.pow(c * x + 1, 3);
    //         } while (v <= 0);
    //         var u = this.uniform();
    //         var x2 = Math.pow(x, 2);
    //     } while (u >= 1 - 0.0331 * x2 * x2 &&
    //             Math.log(u) >= 0.5 * x2 + d * (1 - v + Math.log(v)));
    //     if (a < 1) {
    //         return d * v * Math.exp(this.exponential() / -a);
    //     } else {
    //         return d * v;
    //     }
    // };

    // /**
    //  * Accepts a dice rolling notation string and returns a generator
    //  * function for that distribution. The parser is quite flexible.
    //  * @param {string} expr A dice-rolling, expression i.e. '2d6+10'.
    //  * @param {RNG} rng An optional RNG object.
    //  * @return {Function}
    //  */
    // static roller(expr, rng) {
    //     var parts = expr.split(/(\d+)?d(\d+)([+-]\d+)?/).slice(1);
    //     var dice = parseFloat(parts[0]) || 1;
    //     var sides = parseFloat(parts[1]);
    //     var mod = parseFloat(parts[2]) || 0;
    //     rng = rng || new RNG();
    //     return function() {
    //         var total = dice + mod;
    //         for (var i = 0; i < dice; i++) {
    //             total += rng.random(sides);
    //         }
    //         return total;
    //     };
    // }
}

export { RNG }
