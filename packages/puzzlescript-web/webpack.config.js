const path = require('path')
const WorkboxPlugin = require('workbox-webpack-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const { DefinePlugin } = require('webpack')

module.exports = {
    stats: {
        children: true, 
        errorDetails: true
    },
    mode: 'development', // Projects that include this library can minify if they want. We will not minify and include sourcemaps
    entry: {
        'pwa-app': './src/pwa/app.ts',
        'puzzlescript-webworker': './src/webworker.ts',
        'puzzlescript': './src/browser.ts',
    },
    output: {
        path: path.resolve(__dirname, './static'),
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
    optimization: {
        minimize: false
    },
    plugins: [
        new DefinePlugin({
            'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
            'process.env.PUZZLESCRIPT_METHOD': JSON.stringify(''), // 'ondemand',
            'process.env.LOG_LEVEL': JSON.stringify(process.env.LOG_LEVEL ?? 'INFO'),
            'process.env.VERIFY_MATCHES': JSON.stringify(false),
            'process.stdout': JSON.stringify(false),
        }),
        new HtmlWebpackPlugin({
            xhtml: true,
            template: 'static/pwa-template.xhtml',
            filename: 'index.xhtml',
            inject: 'head',
            chunks: ['pwa-app'],
            // Inject the async tag:
            templateParameters: (compilation, assets, tags, options) => {
                tags.headTags.forEach((tag) => {
                    if (tag.tagName === 'script') {
                        tag.attributes.async = true;
                    }
                });
                return {
                    htmlWebpackPlugin: { options }
                }
            },
        }),
        new WorkboxPlugin.GenerateSW({
            // these options encourage the ServiceWorkers to get in there fast 
            // and not allow any straggling "old" SWs to hang around
            clientsClaim: true,
            skipWaiting: true,
            offlineGoogleAnalytics: true,
            directoryIndex: 'index.xhtml',
            swDest: 'pwa-service-worker.js',
            runtimeCaching: [{
                urlPattern: /\/games\//,
                handler: 'StaleWhileRevalidate',
                options: {
                    cacheName: 'games-v1',
                    cacheableResponse: {
                        statuses: [0, 200]
                    }
                }
            },
            {
                urlPattern: /\/game-thumbnails\//,
                handler: 'StaleWhileRevalidate',
                options: {
                    cacheName: 'game-thumbnails-v1',
                    cacheableResponse: {
                        statuses: [0, 200]
                    }
                }
            },
            {
                urlPattern: /\/style\.css/,
                handler: 'StaleWhileRevalidate',
                options: {
                    cacheName: 'app-v1',
                    cacheableResponse: {
                        statuses: [0, 200]
                    }
                }
            },
            {
                urlPattern: /\/favicon\.ico/,
                handler: 'StaleWhileRevalidate',
                options: {
                    cacheName: 'app-icons-v1',
                    cacheableResponse: {
                        statuses: [0, 200]
                    }
                }
            },
            {
                urlPattern: /\/apple-.*\.png/,
                handler: 'StaleWhileRevalidate',
                options: {
                    cacheName: 'app-icons-v1',
                    cacheableResponse: {
                        statuses: [0, 200]
                    }
                }
            },

        ]
            
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