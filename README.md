# Typed PuzzleScript


This is a remake of PuzzleScript that has the following features:

- There is a [Grammar](https://en.wikipedia.org/wiki/Parsing_expression_grammar) file that parses the game file (uses [ohm](https://github.com/harc/ohm))
- The interpreter is a separate component
- The rendering code is abstracted out so folks can add a different renderer (the example uses ASCII in the Terminal to show the game)
  - This allows for fun things like adding an accessible-friendly interface to play the games
  - Inspired by https://askubuntu.com/questions/699159/ascii-animations-that-are-viewed-in-the-command-line#699161
- The input code is abstracted out so gamepads, buttons, etc can easily be provided
  - This also allows computers to play the games!

# Dev Commands

- `npm run play` runs the first game in the gists directory without debugging info (10x faster) (uses `NODE_ENV=production`)
- `npm run play-dev` runs the first game in the gists directory with sprite info (useful for debugging)
- `npm run play-debug` runs the first game with a Chrome Debugger open so you can set breakpoints
- `npm install`
- `npm test`
- `npm run watch` Run the tests and when you update the source, it re-runs the tests
- `npm run test-debug` Run the tests but open a debugger (remember to add a `debugger` line into the JavaScript)
- `node lib/runGame.js"` Run all the games (change the `glob(...)` line to load just one file)
- `node --inspect-brk index.js` Run all the games with the Debugger open
- `npm test; open coverage/lcov-report/index.html` to see test coverage


# File Layout

- `parser.js` contains the Grammar as well as the Abstract Syntax Tree nodes that represent the game
  - Many of those nodes also contain evaluation logic (like finding out if a Rule matches a Cell)
- `engine.js` evaluates all the Rules when `tick()` is called. `tick()` returns a list of Cells to re-render
- `ui.js` renders the Level (and individual Cells) on the screen

# Objects

- **Level** contains a table of Cells which contain a set of Sprites that should be rendered
- **Rule** contains the conditions and actions to be executed.
  - It also contains methods for checking if the Rule matches a Cell and methods for how to change the Cell
- **Cell** contains a set of Sprites and is used to represent the current state of the Game



Sound hack:

~~In `node_modules/web-audio-api/build/AudioContext.js` just above `if (this$0.outStream.write(this$0._encoder(outBuff._data)))` add:~~

```
// PHILHACK
if (!this$0._playing) { return }
```


Fork `speaker` and change `deps/mpg123/mpg123.gyp` so that the `'Release': {` block instead says: `'defines': [ 'NDEBUG', 'NO_WARNING' ],` .

This way we can keep the audio open, for sending sound effects but do not need to keep the NodeJS event loop to be really short (& keep sending sound data to `mpg123`) so that `mpg123` does not print warning messages about not having sound data to send to speakers.