const path = require('path');

module.exports = {
    mode: process.env['NODE_ENV'] || 'production',
    entry: ['babel-polyfill', './src/index-browser.ts'],
    output: {
        path: path.resolve(__dirname, './lib/'),
        filename: 'webpack-output.js',
        library: 'PuzzleScript',
        libraryTarget: 'umd',
    },
    devtool: 'source-map',
    resolve: {
        // Add '.ts' and '.tsx' as resolvable extensions.
        extensions: ['.ts', '.tsx', '.js', '.json'],
        alias: {
            './sound/sfxr': path.resolve(__dirname, './src/sound/sfxr-browser'),
            '../ui/terminal': path.resolve(__dirname, './src/ui/terminalBrowserShim.js')
        }
    },
    module: {
        rules: [
            { 
                test: /\.(js|mjs|jsx|ts|tsx)$/,
                loader: require.resolve('babel-loader'),
                options: {
                    presets: ['@babel/preset-env'],
                    cacheDirectory: true,
                    // Save disk space when time isn't as important
                    cacheCompression: true,
                    compact: true,
                }
            }
        ]
    },
    // Only report errors to stdout, not the bundle stats (like compression)
    // stats: "errors-only"
    stats: {maxModules: Infinity, exclude: undefined}
}