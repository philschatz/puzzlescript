# Usage

This library is inspired by [contro](https://npm.im/contro) but has a few different features:

- uses the [standard](https://w3c.github.io/gamepad/#dfn-standard-gamepad-layout) layout to refer to buttons and sticks
- supports gamepads that do not use the `standard` layout 
  - some browsers like Firefox do not provide a standard mapping
  - uses [mapping files](./configs/) to support non-standard gamepads
- allows checking if a specific button is available on the gamepad
- allows composing buttons, sticks, and even gamepads to make it easier to write games
- allows disposing of keyboard buttons

## Example

This example shows how to set controls for a simple single-player platformer.

```ts
import { Controllers, BUTTON_TYPE, DIRECTION, dpadAsStick } from './controller'

const pad = Controllers.getAnyGamepad()
const stick = dpadAsStick(pad)
const jumpButton = pad.button(BUTTON_TYPE.CLUSTER_BOTTOM)

function loop() {

    if (stick.direction() === DIRECTION.RIGHT) {
        // move right...
    }
    if (jumpButton.query()) {
        // jump...
    }

    if (pad.isConnected()) {
        console.log('The gamepad is connected!')
    }
}
```

## API

Here are all of the importable things (excluding interfaces)

```ts
import {
    Controllers,
    BUTTON_TYPE,
    STICK_TYPE,
    dpadAsStick,
    wsadKeysAsStick,
    arrowKeysAsStick,
} from './controller'
```

## Get gamepads

These methods allow getting a specific gamepad, an array of gamepads (some of which are null), or an AnyGamepad which is like or'ing all of the gamepads together if your game does not care about multiple gamepads.

```ts
const gamepad = Controllers.getAnyGamepad()
const gamepad2 = Controllers.getGamepad(2)
const gamepads = Controllers.getGamepads()
```

## Check the state

```ts
gamepad.isConnected()
gamepad.hasButton(BUTTON_TYPE.ARROW_LEFT)
gamepad.hasStick(STICK_TYPE.LEFT)

const button = gamepad.button(BUTTON_TYPE.ARROW_LEFT)
const stick = gamepad.stick(STICK_TYPE.LEFT)

// Not all controllers have the same buttons so there is a handy `.has()`
button.has() // Check if this button is available on the gamepad
stick.has()  // Check if this stick  is available on the gamepad

const isPressed = button.query() // `false` when not available so use `.has()` to check
const {x, y} = stick.query()     // `{x:0, y:0}` when not available so use `.has()` to check
const direction = stick.direction() // 'UP', 'DOWN', ..., or null . The cardinal stick direction
```

## Keyboard handling

Keyboard keys can also be handled like gamepad buttons.

```ts
const button2 = Controllers.key('Enter')
const isPressed = button2.query()
button2.dispose()
```

## Composition

You can compose buttons together, buttons into a stick, sticks together, or all of the controllers into one.

```ts
// Combine multiple buttons
const composite = Controllers.or([button, button2])

// Construct a dpad using the controller OR the wsad keys
const dpad = Controllers.asStick(
    Controllers.or([gamepad.button(BUTTON_TYPE.ARROW_UP), Controllers.key('w')]),
    Controllers.or([gamepad.button(BUTTON_TYPE.ARROW_DOWN), Controllers.key('s')]),
    Controllers.or([gamepad.button(BUTTON_TYPE.ARROW_LEFT), Controllers.key('a')]),
    Controllers.or([gamepad.button(BUTTON_TYPE.ARROW_RIGHT), Controllers.key('d')]),
)

// Or, use one of the pre-created ones:
const dpadStick = dpadAsStick(gamepad)
const wsadStick = wsadKeyAsStick()
const arrowStick = arrowKeysAsStick()

// Combine multiple sticks (which could be buttons)
const megaStick = Controllers.orStick([dpadStick, wsadStick, arrowStick])

// Combine all the gamepads into one
const any = Controllers.getAnyGamepad()
```

