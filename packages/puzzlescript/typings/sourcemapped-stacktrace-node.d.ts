// TypeScript definition for the package
declare module 'sourcemapped-stacktrace-node' {

    export default function(message: string, opts: {isChromeOrEdge: boolean}): Promise<string>
}
