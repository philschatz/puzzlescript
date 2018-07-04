# Terminal PuzzleScript

This is a program that you can run in your terminal to play [PuzzleScript](https://puzzlescript.net) games.

Also, it is **accessible**, meaning that [blind or visually impaired people can play these games](#video-games-that-blind-people-can-play) too!


## Install

1. Run `npm install -g puzzlescript-cli`
1. Run `puzzlescript` to start playing


# Screencaps

Here are some screencaps of games being played.

<a href="https://asciinema.org/a/md0Zep9LOBhdB4nx00OyA0NNH?t=25"><img width="300" alt="video of install and a couple games" src="https://asciinema.org/a/md0Zep9LOBhdB4nx00OyA0NNH.png"/></a>


### Hack the Net ([original](http://www.draknek.org/games/puzzlescript/hack-the-net.php))

<a href="https://asciinema.org/a/TG6K5iinlW7cnrRjtJ1vz6nJl"><img width="300" alt="video of a couple levels of Hack-the-Net" src="https://asciinema.org/a/TG6K5iinlW7cnrRjtJ1vz6nJl.png"/></a>

### Skipping Stones to Lonely Homes ([original](http://www.draknek.org/games/puzzlescript/skipping-stones.php))

<a href="https://asciinema.org/a/mvHT4Btkpj49GzN8fawsUgCTX?t=20"><img width="300" alt="video of the beginning of Skipping Stones (BIG)" src="https://asciinema.org/a/mvHT4Btkpj49GzN8fawsUgCTX.png"/></a>

### Entanglement ([original]())

<a href="https://asciinema.org/a/B6QBhxI4iarolk5k3x4cIRewc?t=23"><img width="300" alt="video of the beginning of Entanglement" src="https://asciinema.org/a/B6QBhxI4iarolk5k3x4cIRewc.png"/></a>


# Video games that blind people can play?

PuzzleScript lends itself nicely to be playable by people with low or no vision:

1. each level is small (~10x10)
1. each sprite has a human-readable name (since the whole game is in 1 text file and the logic refers to the sprites)
1. a blind person has 2 sets of directions (one to move the player and one to move the “eye” which reads off which sprite is in that spot)
1. the games do not require quick reflexes and have Undo built-in so it is easy to think and try different options
1. we can just print to the terminal whenever something needs to be read (presumably the terminal is read aloud to the person)


### Screencap

This screencap is a visual demonstration of exploring and then playing a level.

<a href="https://asciinema.org/a/ORa64VAH4hran37CaOBRWEWmw?t=4"><img width="600" alt="exploring and playing a level without sight" src="https://asciinema.org/a/ORa64VAH4hran37CaOBRWEWmw.png"/></a>


# About

The goal of this project is to do 3 things:

1. make PuzzleScript easier to embed (like in 404 pages, easter eggs, etc)
1. allow **blind people to play video games**
1. use the terminal as a GUI for playing games


# Dev Notes

This is a remake of PuzzleScript that has the following features:

- There is a [Grammar](https://en.wikipedia.org/wiki/Parsing_expression_grammar) file that parses the game file (uses [ohm](https://github.com/harc/ohm))
- The interpreter is a separate component
- The rendering code is abstracted out so folks can add a different renderer (the example uses ASCII in the Terminal to show the game)
  - This allows for fun things like adding an accessible-friendly interface to play the games
  - Inspired by https://askubuntu.com/questions/699159/ascii-animations-that-are-viewed-in-the-command-line#699161
- The input code is abstracted out so gamepads, buttons, etc can easily be provided
  - This also allows computers to play the games!

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
