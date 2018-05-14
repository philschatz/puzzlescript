# Typed PuzzleScript


This is a remake of PuzzleScript that has the following features:

- There is a [Grammar](https://en.wikipedia.org/wiki/Parsing_expression_grammar) file that parses the game file (uses [ohm](https://github.com/harc/ohm))
- The interpreter is a separate component
- The rendering code is abstracted out so folks can add a different renderer (the example uses ASCII in the Terminal to show the game)
  - This allows for fun things like adding an accessible-friendly interface to play the games
  - Inspired by https://askubuntu.com/questions/699159/ascii-animations-that-are-viewed-in-the-command-line#699161
- The input code is abstracted out so gamepads, buttons, etc can easily be provided
  - This also allows computers to play the games!
