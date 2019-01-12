import { INPUT_BUTTON, Optional } from '../util'
import { BUTTON_TYPE, Controllers, IButton, IGamepad, IStick, STICK_TYPE } from './controller/controller'

interface Control<T> {
    up: T,
    down: T,
    left: T,
    right: T,
    action: T,
    undo: T,
    restart: T
}

interface StickControl<T> {
    left: T,
    right: T,
}

export default class InputWatcher {
    private readonly table: HTMLTableElement
    private readonly gamepad: IGamepad
    private readonly controls: Control<{button: IButton, lastPressed: Optional<number>}>
    private readonly stickControls: StickControl<{stick: IStick, lastPressed: Optional<number>}>
    private readonly controlCheckers: Array<() => void>
    private readonly possibleKeys: string[]
    private readonly boundOnKeyEvents: (evt: KeyboardEvent) => void
    private polledInput: Optional<INPUT_BUTTON>
    private repeatIntervalInSeconds: Optional<number>

    constructor(table: HTMLTableElement) {
        this.gamepad = Controllers.getAnyGamepad()
        this.table = table
        this.polledInput = null
        this.repeatIntervalInSeconds = null

        this.possibleKeys = []
        const keyboardKey = (key: string) => {
            this.possibleKeys.push(key)
            return Controllers.key(key)
        }

        // const anyGamepad = Contro.getAnyGamepad()
        // const stick = Contro.orSticks([
        //     dpadAsStick(anyGamepad),
        //     anyGamepad.stick(STICK_TYPE.LEFT),
        //     anyGamepad.stick(STICK_TYPE.RIGHT),
        //     // arrowKeysAsStick(),
        //     // wsadKeysAsStick(),
        //     Contro.asStick(keyboardKey('w'), keyboardKey('s'), keyboardKey('a'), keyboardKey('d')),
        //     Contro.asStick(keyboardKey('ArrowUp'), keyboardKey('ArrowDown'), keyboardKey('ArrowLeft'), keyboardKey('ArrowRight')),
        // ])
        // const action = Contro.or([this.gamepad.button(BUTTON_TYPE.CLUSTER_BOTTOM), keyboardKey('x'), keyboardKey(' '), keyboardKey('Enter')])
        // const undo = Contro.or([this.gamepad.button(BUTTON_TYPE.CLUSTER_LEFT), this.gamepad.button(BUTTON_TYPE.BUMPER_TOP_LEFT), keyboardKey('z'), keyboardKey('u')])
        // const restart = Contro.or([this.gamepad.button(BUTTON_TYPE.CLUSTER_TOP), keyboardKey('r')])

        this.controls = {
            up: { lastPressed: null, button: Controllers.or([this.gamepad.button(BUTTON_TYPE.ARROW_UP), keyboardKey('w'), keyboardKey('ArrowUp')]) },
            down: { lastPressed: null, button: Controllers.or([this.gamepad.button(BUTTON_TYPE.ARROW_DOWN), keyboardKey('s'), keyboardKey('ArrowDown')]) },
            left: { lastPressed: null, button: Controllers.or([this.gamepad.button(BUTTON_TYPE.ARROW_LEFT), keyboardKey('a'), keyboardKey('ArrowLeft')]) },
            right: { lastPressed: null, button: Controllers.or([this.gamepad.button(BUTTON_TYPE.ARROW_RIGHT), keyboardKey('d'), keyboardKey('ArrowRight')]) },
            action: { lastPressed: null, button: Controllers.or([this.gamepad.button(BUTTON_TYPE.CLUSTER_BOTTOM), keyboardKey('x'), keyboardKey(' '), keyboardKey('Enter')]) },
            undo: { lastPressed: null, button: Controllers.or([this.gamepad.button(BUTTON_TYPE.CLUSTER_LEFT), this.gamepad.button(BUTTON_TYPE.BUMPER_TOP_LEFT), keyboardKey('z'), keyboardKey('u')]) },
            restart: { lastPressed: null, button: Controllers.or([this.gamepad.button(BUTTON_TYPE.CLUSTER_TOP), keyboardKey('r')]) }
        }
        this.stickControls = {
            left: { lastPressed: null, stick: this.gamepad.stick(STICK_TYPE.LEFT) },
            right: { lastPressed: null, stick: this.gamepad.stick(STICK_TYPE.RIGHT) }
        }

        const makeChecker = (control: keyof Control<IButton>, gameAction: () => void) => {
            return () => {
                const now = Date.now()
                const interval = (this.repeatIntervalInSeconds || .25) * 1000
                const { button, lastPressed } = this.controls[control]
                if (button.query()) {
                    if (!lastPressed || (lastPressed + interval) < now) {
                        gameAction()
                        this.controls[control].lastPressed = now
                    }
                } else {
                    this.controls[control].lastPressed = null
                }
            }
        }

        const makeStickChecker = (whichStick: keyof StickControl<any>) => {
            return () => {
                const now = Date.now()
                const interval = (this.repeatIntervalInSeconds || .25) * 1000
                const control = this.stickControls[whichStick]
                const { stick, lastPressed } = control
                const { x: xAxis, y: yAxis } = stick.query()
                const yLean = Math.abs(yAxis)
                const xLean = Math.abs(xAxis)
                if (yLean > xLean) {
                    if (yLean > .5) {
                        if (!lastPressed || (lastPressed + interval) < now) {
                            control.lastPressed = now
                            this.polledInput = yAxis < 0 ? INPUT_BUTTON.UP : INPUT_BUTTON.DOWN
                        }
                        return
                    }
                } else {
                    if (xLean > .5) {
                        if (!lastPressed || (lastPressed + interval) < now) {
                            control.lastPressed = now
                            this.polledInput = xAxis < 0 ? INPUT_BUTTON.LEFT : INPUT_BUTTON.RIGHT
                        }
                        return
                    }
                }
                control.lastPressed = null
            }
        }

        this.controlCheckers = [
            makeStickChecker('left'),
            makeStickChecker('right'),
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
