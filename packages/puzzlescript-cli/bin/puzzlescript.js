#!/usr/bin/env node

const updateNotifier = require('update-notifier')
const pkg = require('../package.json')
updateNotifier({pkg}).notify()

const playGame = require('../lib/puzzlescript-cli/src/cli/playGame')