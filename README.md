# Accessible PuzzleScript
[![NPM version][npm-image]][npm-url]
[![Downloads][downloads-image]][downloads-url]
[![Code coverage][coverage-image]][coverage-url]

## Play in a browser or on your mobile device

1. Visit the [website](https://philschatz.com/puzzlescript)
1. Click the "Add" button at the bottom to keep playing even without an internet connection
1. Plug in a :video_game: controller! (tested with PS3/4/XBox)

<details>

<summary>If you are using <strong>iOS (Apple phone or tablet)</strong> click here for instructions</summary>

1. Visit the [website](https://philschatz.com/puzzlescript)
1. Click the Share button in Safari
1. Scroll over and click "Add to Home Screen"

![ios-install](https://user-images.githubusercontent.com/253202/53995149-c5bc5800-40f9-11e9-9e54-3f6a0e10b857.gif)

</details>


## Play from the command line terminal

1. Run `npx puzzlescript-cli` to start playing!

# Screencaps

Here are some screencaps of games being played.

### [Pot Wash Panic!](https://philschatz.com/puzzlescript/#/pot-wash-panic) ([source](https://hauntpun.itch.io/pot-wash-panic))

(click to see the ascii screencast)

<a href="https://asciinema.org/a/188014?t=25"><img width="300" alt="video of install and a couple games" src="https://asciinema.org/a/188014.png"/></a>


### [Skipping Stones to Lonely Homes](https://philschatz.com/puzzlescript/#/skipping-stones) ([source](http://www.draknek.org/games/puzzlescript/skipping-stones.php))

<a href="https://asciinema.org/a/189279?t=20"><img width="300" alt="video of the beginning of Skipping Stones (BIG)" src="https://asciinema.org/a/189279.png"/></a>


### [Hack the Net](https://philschatz.com/puzzlescript/#/hack-the-net) ([source](http://www.draknek.org/games/puzzlescript/hack-the-net.php))

<a href="https://asciinema.org/a/188016"><img width="300" alt="video of a couple levels of Hack-the-Net" src="https://asciinema.org/a/188016.png"/></a>


### [Entanglement](https://philschatz.com/puzzlescript/#/entanglement-one) ([source](http://www.richardlocke.co.uk/release/entanglement/chapter-1/))

<a href="https://asciinema.org/a/212372?t=18"><img width="300" alt="video of the beginning of Entanglement" src="https://asciinema.org/a/212372.png"/></a>


### [Mirror Isles](https://philschatz.com/puzzlescript/#/mirror-isles/0) ([source](http://www.draknek.org/games/puzzlescript/mirrors.php))

This screencast shows playing the game in a terminal using ASCII and ANSI colors.

![mirror-isles](https://user-images.githubusercontent.com/253202/47133542-ce0d1700-d26e-11e8-851f-233d27aaf0b8.gif)


# Video games that blind people can play?

PuzzleScript lends itself nicely to be playable by people with low or no vision:

1. each level is small (~10x10)
1. each sprite has a human-readable name (since the whole game is in 1 text file and the logic refers to the sprites)
1. a blind person has 2 sets of directions (one to move the player and one to move the “eye” which reads off which sprite is in that spot)
1. the games do not require quick reflexes and have Undo built-in so it is easy to think and try different options
1. we can just print to the terminal whenever something needs to be read (presumably the terminal is read aloud to the person)

If you are blind, you can play the games by running `puzzlescript --no-ui` and use the <kbd>I</kbd>, <kbd>K</kbd>, <kbd>J</kbd>, <kbd>L</kbd>, and <kbd>P</kbd> keys to move the cursor to explore the level.

If you want to experience what a non-sighted person would experience but still see the level, run `NODE_ENV=development puzzlescript` and use the <kbd>I</kbd>, <kbd>K</kbd>, <kbd>J</kbd>, <kbd>L</kbd>, and <kbd>P</kbd> keys to move the cursor to explore the level.

### Screencap

This screencap is a visual demonstration of exploring and then playing a level.

<a href="https://asciinema.org/a/190028?t=4"><img width="600" alt="exploring and playing a level without sight (visual depiction)" src="https://asciinema.org/a/190028.png"/></a>

This screencap is the **non-visual** version of the same steps as shown above. This is what vision-impaired people will read when they move the Inspector cursor around and then move the player to play the game.

<a href="https://asciinema.org/a/193133?t=7"><img width="600" alt="exploring and playing a level without sight" src="https://asciinema.org/a/193133.png"/></a>


# About

The goal of this project is to do 3 things:

1. make PuzzleScript easier to embed (like in 404 pages, easter eggs, etc). See [docs](https://philschatz.com/puzzlescript/docs/classes/_engine_.gameengine.html)
1. allow **blind people to play video games** (by passing the `--no-ui` argument)
1. use the terminal as a GUI for playing games


# Accessibility Notes

To use https://chromevox.com, table navigation keys on the Mac are <kbd>Ctrl</kbd> + <kbd>Command</kbd> + <kbd>Up</kbd>.


# Development Instructions

1. Install [lerna](https://lerna.js.org)
1. `lerna bootstrap --force-local`
1. `lerna run compile`
1. `lerna run test --stream`
    - you can run `test:unit` or `test:web` to just run tests specific to a package
1. `lerna run test:integration --stream` (this runs several games and takes about 30min)
1. `lerna run start:server --stream` to start up a server

## Maintainer Instructions

To publish a new version of the packages:

```sh
lerna publish prerelease
```

## TODO

- [x] Move to a monorepo
- [x] Add embedding example
- [ ] Upgrade dependencies
- [x] Move CLI code into a separate package
- [x] Update so that the puzzlescript package (or puzzlescript-web package) has 0 dependencies
- [x] Get CI tests running again
- [x] get Codecov reporting
- [x] Lint again
- [ ] Support when `<table>` does not have an aria-live caption (by adding one)
- [ ] change the web handler to create a different event when a checkpoint occurs (so saving is easier)
- [ ] change the CLI so that you can specify the path to a puzzlescript game.
- [ ] get code coverage up to 100% by skipping untested code
- [ ] Generate ESModules and CJS: https://www.sensedeep.com/blog/posts/2021/how-to-create-single-source-npm-module.html
- [ ] convert puzzlescript-web to use Cypress and sourcemaps
- [ ] move the games and solutions into a separate package (`puzzlescript-games`)
- [ ] :fire: default exports because they are hard on IDEs and make for a confusing API


[npm-image]: https://img.shields.io/npm/v/puzzlescript.svg
[npm-url]: https://npmjs.org/package/puzzlescript
[downloads-image]: https://img.shields.io/npm/dm/puzzlescript.svg
[downloads-url]: https://npmjs.org/package/puzzlescript
[coverage-image]: https://img.shields.io/codecov/c/github/philschatz/puzzlescript.svg
[coverage-url]: https://codecov.io/gh/philschatz/puzzlescript
