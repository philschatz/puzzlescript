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
    private readonly table: HTMLTableElement
    private readonly gamepad: Gamepad
    private readonly controls: Control<{button: Button, lastPressed: Optional<number>}>
    private readonly controlCheckers: Array<() => void>
    private readonly possibleKeys: string[]
    private readonly boundOnKeyEvents: (evt: KeyboardEvent) => void
    private polledInput: Optional<INPUT_BUTTON>
    private repeatIntervalInSeconds: Optional<number>

    constructor(table: HTMLTableElement) {
        const keyboard = new Keyboard()
        this.gamepad = new Gamepad()
        this.table = table
        this.polledInput = null
        this.repeatIntervalInSeconds = null

        this.possibleKeys = []
        const keyboardKey = (key: string) => {
            this.possibleKeys.push(key)
            return keyboard.key(key)
        }

        this.controls = {
            up: { lastPressed: null, button: or(this.gamepad.button(BUTTON_TYPE.ARROW_UP), keyboardKey('w'), keyboardKey('ArrowUp')) },
            down: { lastPressed: null, button: or(this.gamepad.button(BUTTON_TYPE.ARROW_DOWN), keyboardKey('s'), keyboardKey('ArrowDown')) },
            left: { lastPressed: null, button: or(this.gamepad.button(BUTTON_TYPE.ARROW_LEFT), keyboardKey('a'), keyboardKey('ArrowLeft')) },
            right: { lastPressed: null, button: or(this.gamepad.button(BUTTON_TYPE.ARROW_RIGHT), keyboardKey('d'), keyboardKey('ArrowRight')) },
            action: { lastPressed: null, button: or(this.gamepad.button(BUTTON_TYPE.CLUSTER_BOTTOM), keyboardKey('x'), keyboardKey(' '), keyboardKey('Enter')) },
            undo: { lastPressed: null, button: or(this.gamepad.button(BUTTON_TYPE.CLUSTER_LEFT), this.gamepad.button(BUTTON_TYPE.BUMPER_TOP_LEFT), keyboardKey('z'), keyboardKey('u')) },
            restart: { lastPressed: null, button: or(this.gamepad.button(BUTTON_TYPE.CLUSTER_TOP), keyboardKey('r')) }
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

        // Disable bubbling up events when keys are pressed
        this.boundOnKeyEvents = this.onKeyEvents.bind(this)
        window.addEventListener('keydown', this.boundOnKeyEvents)
        window.addEventListener('keyup', this.boundOnKeyEvents)
        window.addEventListener('keypress', this.boundOnKeyEvents)
    }

    public onKeyEvents(evt: KeyboardEvent) {
        if (evt.metaKey || evt.shiftKey || evt.altKey || evt.ctrlKey) {
            return
        }
        if (window.document.activeElement !== this.table) {
            return
        }
        if (this.possibleKeys.indexOf(evt.key) >= 0) {
            evt.preventDefault()
        }
    }

    public pollControls() {
        if (window.document.activeElement !== this.table) {
            // Ignore if the game is not in focus
            return null
        }
        this.polledInput = null
        this.controlCheckers.forEach((fn) => fn())
        const input = this.polledInput
        this.polledInput = null
        return input
    }

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

    public dispose() {
        window.removeEventListener('keydown', this.boundOnKeyEvents)
        window.removeEventListener('keyup', this.boundOnKeyEvents)
        window.removeEventListener('keypress', this.boundOnKeyEvents)
    }
}
