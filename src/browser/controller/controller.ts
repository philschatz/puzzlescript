import { getGamepadConfig } from './configs'

export enum BUTTON_TYPE {
    ARROW_UP = 'ARROW_UP',
    ARROW_DOWN = 'ARROW_DOWN',
    ARROW_LEFT = 'ARROW_LEFT',
    ARROW_RIGHT = 'ARROW_RIGHT',
    HOME = 'HOME',
    START = 'START',
    SELECT = 'SELECT',
    CLUSTER_TOP = 'CLUSTER_TOP',
    CLUSTER_LEFT = 'CLUSTER_LEFT',
    CLUSTER_RIGHT = 'CLUSTER_RIGHT',
    CLUSTER_BOTTOM = 'CLUSTER_BOTTOM',
    BUMPER_TOP_LEFT = 'BUMPER_TOP_LEFT',
    BUMPER_BOTTOM_LEFT = 'BUMPER_BOTTOM_LEFT',
    BUMPER_TOP_RIGHT = 'BUMPER_TOP_RIGHT',
    BUMPER_BOTTOM_RIGHT = 'BUMPER_BOTTOM_RIGHT',
    STICK_PRESS_LEFT = 'STICK_PRESS_LEFT',
    STICK_PRESS_RIGHT = 'STICK_PRESS_RIGHT',
    TOUCHSCREEN = 'TOUCHSCREEN'
}
export enum STICK_TYPE {
    LEFT = 'LEFT',
    RIGHT = 'RIGHT'
}
export enum ANALOG_TYPE {
    BUMPER_LEFT = 'BUMPER_LEFT',
    BUMPER_RIGHT = 'BUMPER_RIGHT'
}

export enum DIRECTION {
    UP = 'UP',
    DOWN = 'DOWN',
    LEFT = 'LEFT',
    RIGHT = 'RIGHT'
}

export enum KEY_MODIFIER {
    ALT = 'ALT',
    CTRL = 'CTRL',
    META = 'META',
    SHIFT = 'SHIFT'
}

export interface IGamepad {
    isConnected(): boolean
    hasButton(arg: BUTTON_TYPE): boolean
    hasStick(arg: STICK_TYPE): boolean
    isButtonPressed(arg: BUTTON_TYPE): boolean
    getStickValue(arg: STICK_TYPE): IVector
    getStickDirection(arg: STICK_TYPE): DIRECTION | null
    button(arg: BUTTON_TYPE): IButton
    stick(arg: STICK_TYPE): IStick
}

export interface IButton {
    has(): boolean
    query(): boolean
}

export interface IKeyboardButton extends IButton {
    dispose(): void
}

export interface IStick {
    has(): boolean
    query(): IVector
    direction(): DIRECTION | null
}

export interface IVector {
    x: number
    y: number
}

function lookupButtonIndex(gamepad: Gamepad, arg: BUTTON_TYPE) {
    const config = getGamepadConfig(gamepad)
    // little more complicated because the index could be 0
    if (config) {
        if (typeof config.buttons[arg] !== 'undefined') {
            return config.buttons[arg] || null
        }
    }
    return null
}

function lookupStickIndex(gamepad: Gamepad, arg: STICK_TYPE) {
    const config = getGamepadConfig(gamepad)
    return config && config.sticks[arg] || null
}

class ControllerGamepad implements IGamepad {
    private readonly index: number
    constructor(index: number) {
        if (!(index >= 0)) {
            throw new Error(`Must provide an index. Or, use the AnyGamepad class`)
        }
        this.index = index
    }
    public isConnected() {
        return !!this.raw()
    }
    public isButtonPressed(arg: BUTTON_TYPE) {
        const raw = this.raw()
        if (raw) {
            const index = this.buttonIndex(arg)
            return index !== null && raw.buttons[index].pressed
        } else {
            return false
        }
    }
    public hasButton(arg: BUTTON_TYPE) {
        return this.buttonIndex(arg) !== null
    }
    public button(arg: BUTTON_TYPE): IButton {
        return {
            has: () => this.hasButton(arg),
            query: () => this.isButtonPressed(arg)
        }
    }
    public getStickValue(arg: STICK_TYPE): IVector {
        const raw = this.raw()
        if (raw) {
            const indexes = this.stickIndex(arg)
            if (indexes) {
                const { xAxis, yAxis } = indexes
                return { x: raw.axes[xAxis], y: raw.axes[yAxis] }
            }
        }
        return { x: 0, y: 0 }
    }
    public getStickDirection(arg: STICK_TYPE) {
        const { x, y } = this.getStickValue(arg)
        const xAbs = Math.abs(x)
        const yAbs = Math.abs(y)
        if (xAbs < .5 && yAbs < .5) { return null } else if (xAbs > yAbs) { return x > 0 ? DIRECTION.LEFT : DIRECTION.RIGHT } else { return y > 0 ? DIRECTION.DOWN : DIRECTION.UP }
    }
    public hasStick(arg: STICK_TYPE) {
        return this.stickIndex(arg) !== null
    }
    public stick(arg: STICK_TYPE): IStick {
        return {
            has: () => this.hasStick(arg),
            query: () => this.getStickValue(arg),
            direction: () => this.getStickDirection(arg)
        }
    }
    private raw() {
        return [...navigator.getGamepads()][this.index] || null
    }
    private buttonIndex(arg: BUTTON_TYPE) {
        const raw = this.raw()
        return raw && lookupButtonIndex(raw, arg)
    }
    private stickIndex(arg: STICK_TYPE) {
        const raw = this.raw()
        return raw && lookupStickIndex(raw, arg)
    }
}

class AnyGamepad implements IGamepad {
    public isConnected() {
        return !!Controllers.getGamepads().find((c) => !!c && c.isConnected())
    }
    public hasButton(arg: BUTTON_TYPE) {
        return !!Controllers.getGamepads().find((c) => !!c && c.hasButton(arg))
    }
    public isButtonPressed(arg: BUTTON_TYPE) {
        for (const c of Controllers.getGamepads()) {
            if (c && c.isButtonPressed(arg)) {
                return true
            }
        }
        return false
    }
    public button(arg: BUTTON_TYPE): IButton {
        return {
            has: () => this.hasButton(arg),
            query: () => this.isButtonPressed(arg)
        }
    }
    public hasStick(arg: STICK_TYPE) {
        return !!Controllers.getGamepads().find((c) => !!c && c.hasStick(arg))
    }
    public getStickValue(arg: STICK_TYPE) {
        let xSum = 0
        let ySum = 0
        for (const c of Controllers.getGamepads()) {
            if (c) {
                const { x, y } = c.getStickValue(arg)
                xSum += x
                ySum += y
            }
        }
        return { x: xSum, y: ySum }
    }
    public getStickDirection(arg: STICK_TYPE) {
        const gamepad = Controllers.getGamepads().find((c) => !!c && c.getStickDirection(arg) !== null) || null
        return gamepad && gamepad.getStickDirection(arg)
    }
    public stick(arg: STICK_TYPE): IStick {
        return {
            has: () => this.hasStick(arg),
            query: () => this.getStickValue(arg),
            direction: () => this.getStickDirection(arg)
        }
    }
}

export const Controllers = new (class ControllersSingleton {
    private readonly cache: IGamepad[]
    private any: IGamepad | null
    constructor() {
        this.cache = []
        this.any = null
    }
    public getGamepads() {
        return [...navigator.getGamepads()].map((raw, index) => raw && this.getGamepad(index))
    }
    public getGamepad(index: number) {
        this.cache[index] = this.cache[index] || new ControllerGamepad(index)
        return this.cache[index]
    }
    public getAnyGamepad() {
        if (this.any) {
            return this.any
        }
        const anyGamepad = new AnyGamepad()
        this.any = anyGamepad
        return anyGamepad
    }

    public key(key: string, context?: Element, modifiers?: KEY_MODIFIER[]): IKeyboardButton {
        const mods = new Set(modifiers ? modifiers : [])
        let pressed = false
        const checkModifiers = (m: Set<KEY_MODIFIER>, evt: KeyboardEvent) => {
            return m.has(KEY_MODIFIER.ALT) === evt.altKey &&
                m.has(KEY_MODIFIER.CTRL) === evt.ctrlKey &&
                m.has(KEY_MODIFIER.META) === evt.metaKey &&
                m.has(KEY_MODIFIER.SHIFT) === evt.shiftKey
        }
        const checkActiveElement = (root: Element, current: Element | null): boolean => {
            if (root === current) {
                return true
            }
            if (current !== null && current.parentElement) {
                return checkActiveElement(root, current.parentElement)
            }
            return false
        }
        const onKeyDown = (evt: KeyboardEvent) => {
            if (evt.key === key && checkModifiers(mods, evt)) {
                if (!context || checkActiveElement(context, window.document.activeElement)) {
                    pressed = true
                    evt.preventDefault()
                }
            }
        }
        const onKeyUp = (evt: KeyboardEvent) => {
            if (evt.key === key && checkModifiers(mods, evt)) {
                if (!context || checkActiveElement(context, window.document.activeElement)) {
                    pressed = false
                    evt.preventDefault()
                }
            }
        }
        window.addEventListener('keydown', onKeyDown)
        window.addEventListener('keyup', onKeyUp)
        return {
            has() { return true },
            query: () => pressed,
            dispose: () => {
                window.removeEventListener('keydown', onKeyDown)
                window.removeEventListener('keyup', onKeyUp)
            }
        }
    }

    public or(arg: IButton[]): IButton {
        return {
            has() { return !!arg.find((b) => b.has()) },
            query() { return !!arg.find((b) => b.query()) }
        }
    }

    public asStick(up: IButton, down: IButton, left: IButton, right: IButton): IStick {
        function query() {
            const u = up.query()
            const d = down.query()
            const l = left.query()
            const r = right.query()
            const x = 0 + (u ? -1 : 0) + (d ? 1 : 0)
            const y = 0 + (l ? -1 : 0) + (r ? 1 : 0)
            return { x, y }
        }
        return {
            query,
            has() {
                return up.has() && down.has() && left.has() && right.has()
            },
            direction() {
                const { x, y } = query()
                if (x < 0 && y === 0) { return DIRECTION.UP }
                if (x > 0 && y === 0) { return DIRECTION.DOWN }
                if (y < 0 && x === 0) { return DIRECTION.LEFT }
                if (y > 0 && x === 0) { return DIRECTION.RIGHT }
                return null
            }
        }
    }

    public orSticks(arg: IStick[]): IStick {
        function query() {
            let xSum = 0
            let ySum = 0
            for (const stick of arg) {
                const { x, y } = stick.query()
                xSum += x
                ySum += y
            }
            return { x: xSum, y: ySum }
        }
        return {
            query,
            has() {
                return !!arg.find((c) => c.has())
            },
            direction() {
                const { x, y } = query()
                if (x < 0 && y === 0) { return DIRECTION.UP }
                if (x > 0 && y === 0) { return DIRECTION.DOWN }
                if (y < 0 && x === 0) { return DIRECTION.LEFT }
                if (y > 0 && x === 0) { return DIRECTION.RIGHT }
                return null
            }
        }
    }
})() // new Singleton

export const arrowKeysAsStick = (root?: Element) => Controllers.asStick(
    Controllers.key('ArrowUp', root),
    Controllers.key('ArrowDown', root),
    Controllers.key('ArrowLeft', root),
    Controllers.key('ArrowRight', root)
)

export const wsadKeysAsStick = (root?: Element) => Controllers.asStick(
    Controllers.key('w', root),
    Controllers.key('s', root),
    Controllers.key('a', root),
    Controllers.key('d', root)
)

export const dpadAsStick = (arg: IGamepad) => Controllers.asStick(
    arg.button(BUTTON_TYPE.ARROW_UP),
    arg.button(BUTTON_TYPE.ARROW_DOWN),
    arg.button(BUTTON_TYPE.ARROW_LEFT),
    arg.button(BUTTON_TYPE.ARROW_RIGHT)
)
