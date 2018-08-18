const path = require('path');

// ./lib/index.js
// --target web
// --output-library-target
// --mode development
// --devtool source-map
// --output ./test/webpack-output.js
module.exports = {
    mode: process.env['NODE_ENV'] || 'production',
    entry: './lib/index.js',
    output: {
        path: path.resolve(__dirname, './test/'),
        filename: 'webpack-output.js',
        library: 'PuzzleScript',
        libraryTarget: 'umd',
    },
    devtool: 'source-map'
}