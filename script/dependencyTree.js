const path = require('path')
const dependencyTree = require('dependency-tree');

// Returns a dependency tree object for the given file
const rootDir = path.join(__dirname, '../src/')
const treeWithRoot = dependencyTree({
  filename: path.join(rootDir, 'index.ts'),
  directory: rootDir,
  tsConfig: path.join(__dirname, '../tsConfig.json'), // optional
  // nodeModulesConfig: {
  //   entry: 'module'
  // }, // optional
  // filter: path => path.indexOf('node_modules') === -1, // optional
  nonExistent: [] // optional
})


if (Object.keys(treeWithRoot).length !== 1) throw new Error('Expected one root')

const treeRoot = treeWithRoot[Object.keys(treeWithRoot)[0]]

const visited = new Set() // tree contains cycles
const visitedKeys = new Set() // tree contains duplicate entries
const objectWalker = (node) => {
  if (!visited.has(node)) {
    visited.add(node)

    for (const key of Object.keys(node)) {
      const value = node[key]

      // rename the key to be relative to the rootDir
      const relativeKey = path.relative(`${rootDir}/`, key)

      delete node[key]

      // bail if we are inside node_modules
      if (/node_modules/.test(key)) {
        node[relativeKey] = '(external)'
      } else {
      
        if (visitedKeys.has(key)) {
          node[relativeKey] = '(duplicate)'
        } else {
          visitedKeys.add(key)
          
          node[relativeKey] = value
          objectWalker(value)
    
        }
      }
    }
  }
}

objectWalker(treeRoot)


console.log(JSON.stringify(treeRoot, null, 2))