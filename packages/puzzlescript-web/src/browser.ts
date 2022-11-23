import 'babel-polyfill' // tslint:disable-line:no-implicit-dependencies
import SyncTableEngine from './browser/SyncTableEngine'
import WebworkerTableEngine from './browser/WebworkerTableEngine'

// Public API
(window as any).PuzzleScript = {
    WebworkerTableEngine,
    SyncTableEngine
}

export default {
    WebworkerTableEngine,
    SyncTableEngine
}

export {
    WebworkerTableEngine,
    SyncTableEngine
}