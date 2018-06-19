# Terminal PuzzleScript

This is a program that you can run in your terminal to play [PuzzleScript](https://puzzlescript.net) games.

## Install

1. Run `npm install -g puzzlescript-cli`
1. Run `puzzlescript` to start playing


# About

This is a remake of PuzzleScript that has the following features:

- There is a [Grammar](https://en.wikipedia.org/wiki/Parsing_expression_grammar) file that parses the game file (uses [ohm](https://github.com/harc/ohm))
- The interpreter is a separate component
- The rendering code is abstracted out so folks can add a different renderer (the example uses ASCII in the Terminal to show the game)
  - This allows for fun things like adding an accessible-friendly interface to play the games
  - Inspired by https://askubuntu.com/questions/699159/ascii-animations-that-are-viewed-in-the-command-line#699161
- The input code is abstracted out so gamepads, buttons, etc can easily be provided
  - This also allows computers to play the games!

# Dev Notes

## Commands

- `npm run play` runs the games in the [./gists/](./gists/) directory without debugging info (10x faster) (uses `NODE_ENV=production`)
- `npm run play-dev` runs the games in the [./gists/](./gists/) directory with sprite info (useful for debugging)
- `npm run play-debug` runs the games in the [./gists/](./gists/) directory with a Chrome Debugger open so you can set breakpoints
- `npm start` runs all of the games in the [./gists/](./gists/) directory with a few sample moves (up/down/left/right/action)
- `npm test` runs all of the unit tests (including solutions in the [./gist-solutions/](./gist-solutions/) directory)
- `npm run watch` Run the tests and when you update the source, it re-runs the tests
- `npm run test-debug` Run the tests but opens a debugger (remember to add a `debugger` line into the JavaScript)
- `npm test; open coverage/lcov-report/index.html` to see test coverage
- `npm run coverage` generates a coverage report which includes the JS code as well as any games that you ran in dev mode (using `npm run dev`)

## Objects

- **Level** contains a table of Cells which contain a set of Sprites that should be rendered
- **Rule** contains the conditions and actions to be executed.
  - It also contains methods for checking if the Rule matches a Cell and methods for how to change the Cell
- **Cell** contains a set of Sprites and is used to represent the current state of the Game
