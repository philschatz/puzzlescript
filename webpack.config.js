const path = require('path');
const HardSourceWebpackPlugin = require('hard-source-webpack-plugin')

module.exports = {
    mode: process.env['NODE_ENV'] || 'production',
    entry: './src/index-browser.ts',
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
            './sound/sfxr': path.resolve(__dirname, './lib/sound/sfxr-browser'),
            '../ui/terminal': path.resolve(__dirname, './src/ui/terminalBrowserShim.js')
        }
    },
    module: {
        rules: [
          // All files with a '.ts' or '.tsx' extension will be handled by 'awesome-typescript-loader'.
          { test: /\.tsx?$/, loader: 'awesome-typescript-loader' },

          // All output '.js' files will have any sourcemaps re-processed by 'source-map-loader'.
          { enforce: 'pre', test: /\.js$/, loader: 'source-map-loader' }
        ]
    },
    // Only report errors to stdout, not the bundle stats (like compression)
    // stats: "errors-only"
    stats: {maxModules: Infinity, exclude: undefined},
    plugins: [
        new HardSourceWebpackPlugin()
    ]
}