const path = require('path');

module.exports = {
    mode: process.env['NODE_ENV'] || 'production',
    entry: './lib/index.js',
    output: {
        path: path.resolve(__dirname, './test/'),
        filename: 'webpack-output.js',
        library: 'PuzzleScript',
        libraryTarget: 'umd',
    },
    devtool: 'source-map',
    resolve: {
        alias: {
            '../puzzlescript/js/sfxr': path.resolve(__dirname, './puzzlescript/js/sfxr-browser')
        }
    }
}