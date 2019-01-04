import { Button, BUTTON_TYPE, Gamepad, Keyboard, or } from 'contro'
import { INPUT_BUTTON, Optional } from '../util'

interface Control<T> {
    up: T,
    down: T,
    left: T,
    right: T,
    action: T,
    undo: T,
    restart: T
}

export default class InputWatcher {
    private polledInput: Optional<INPUT_BUTTON>
    private repeatIntervalInSeconds: Optional<number>
    private gamepad: Gamepad
    private controls: Control<{button: Button, lastPressed: Optional<number>}>
    private controlCheckers: Array<() => void>

    constructor() {
        const keyboard = new Keyboard()
        this.gamepad = new Gamepad()
        this.polledInput = null
        this.repeatIntervalInSeconds = null

        this.controls = {
            up: { lastPressed: null, button: or(this.gamepad.button(BUTTON_TYPE.ARROW_UP), keyboard.key('w')) },
            down: { lastPressed: null, button: or(this.gamepad.button(BUTTON_TYPE.ARROW_DOWN), keyboard.key('s')) },
            left: { lastPressed: null, button: or(this.gamepad.button(BUTTON_TYPE.ARROW_LEFT), keyboard.key('a')) },
            right: { lastPressed: null, button: or(this.gamepad.button(BUTTON_TYPE.ARROW_RIGHT), keyboard.key('d')) },
            action: { lastPressed: null, button: or(this.gamepad.button(BUTTON_TYPE.CLUSTER_BOTTOM), keyboard.key('x'), keyboard.key('Space')) },
            undo: { lastPressed: null, button: or(this.gamepad.button(BUTTON_TYPE.CLUSTER_LEFT), this.gamepad.button(BUTTON_TYPE.BUMPER_TOP_LEFT), keyboard.key('z'), keyboard.key('u')) },
            restart: { lastPressed: null, button: or(this.gamepad.button(BUTTON_TYPE.CLUSTER_TOP), keyboard.key('r')) }
        }
        const makeChecker = (control: keyof Control<Button>, gameAction: () => void) => {
            return () => {
                const now = Date.now()
                const interval = this.repeatIntervalInSeconds || .25
                const { button, lastPressed } = this.controls[control]
                if (button.query()) {
                    if (!lastPressed || (lastPressed + interval * 1000) < now) {
                        gameAction()
                        this.controls[control].lastPressed = now
                    }
                } else {
                    this.controls[control].lastPressed = null
                }
            }
        }

        this.controlCheckers = [
            makeChecker('up', () => this.polledInput = INPUT_BUTTON.UP),
            makeChecker('down', () => this.polledInput = INPUT_BUTTON.DOWN),
            makeChecker('left', () => this.polledInput = INPUT_BUTTON.LEFT),
            makeChecker('right', () => this.polledInput = INPUT_BUTTON.RIGHT),
            makeChecker('action', () => this.polledInput = INPUT_BUTTON.ACTION),
            makeChecker('undo', () => this.polledInput = INPUT_BUTTON.UNDO),
            makeChecker('restart', () => this.polledInput = INPUT_BUTTON.RESTART)
        ]
    }

    public pollControls() {
        this.polledInput = null
        this.controlCheckers.forEach((fn) => fn())
        const input = this.polledInput
        this.polledInput = null
        return input
    }

    // TODO: This might not be needed. pollControls() might be sufficient
    public isSomethingPressed() {
        for (const entry of Object.values(this.controls)) {
            if (entry.button.query()) {
                return true
            }
        }
        return false
    }

    public setKeyRepeatInterval(repeatIntervalInSeconds: number) {
        this.repeatIntervalInSeconds = repeatIntervalInSeconds
    }

}
