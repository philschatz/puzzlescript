const path = require('path')
const WorkboxPlugin = require('workbox-webpack-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')

module.exports = {
    mode: process.env['NODE_ENV'] || 'production',
    entry: {
        'pwa-app': './src/pwa-app.ts',
        'puzzlescript-webworker': './src/index-webworker.ts',
        'puzzlescript': './src/index-browser.ts',
    },
    output: {
        path: path.resolve(__dirname, './'),
        filename: '[name].js',
    },
    devtool: 'source-map',
    resolve: {
        // Add '.ts' and '.tsx' as resolvable extensions.
        extensions: ['.ts', '.tsx', '.js', '.json'],
        alias: {
            // TODO: There should only be 1 sfxr entry
            './sound/sfxr': path.resolve(__dirname, './src/sound/sfxr-browser'),
            '../sound/sfxr': path.resolve(__dirname, './src/sound/sfxr-browser'),
            '../ui/terminal': path.resolve(__dirname, './src/ui/terminalBrowserShim.js')
        }
    },
    plugins: [
        new HtmlWebpackPlugin({
            xhtml: true,
            template: 'pwa-template.xhtml',
            filename: 'index.xhtml',
            inject: 'head',
            chunks: ['pwa-app']
        }),
        new WorkboxPlugin.GenerateSW({
            // these options encourage the ServiceWorkers to get in there fast 
            // and not allow any straggling "old" SWs to hang around
            clientsClaim: true,
            skipWaiting: true,
            directoryIndex: 'index.xhtml',
            swDest: 'pwa-service-worker.js'
        })
    ],
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
}