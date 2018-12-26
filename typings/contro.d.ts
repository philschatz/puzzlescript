// TypeScript definition for the package
declare module 'contro' {
  export function or<T1, T2 extends Control<T1>>(...controls: T2[]): T2
  export function and<T1, T2 extends Control<T1>>(...controls: T2[]): T2

  interface Vector2 {
    xAxis: number
    yAxis: number
  }

  interface Control<T> {
    label: string
    type: BUTTON_TYPE | STICK_TYPE | ANALOG_TYPE
    query(): T
  }

  interface Button extends Control<boolean> {
    trigger: boolean
  }

  type Stick = Control<Vector2>
  type Analog = Control<number>

  interface Gamepad {
    new (): Gamepad
    isConnected(): boolean

    hasButton(t: BUTTON_TYPE): boolean
  
    button(button: BUTTON_TYPE): Button
    stick(stick: STICK_TYPE): Stick
    // analog(analog: ANALOG_TYPE): Analog
  }

  interface Keyboard {
    new (): Keyboard
    key(k: string): Button
    directionalKeys(k: 'arrows' | 'wasd' | string[4]): Stick
  }

  
  export var Keyboard: Keyboard
  export var Gamepad: Gamepad
  // export Mouse

  // export var gamepads: Gamepads
  // interface Gamepads {
  //   getGamepads(): Gamepad[]
  //   getCombinedGamepad(): Gamepad // Combines all gamepads into one
  // }

  export enum BUTTON_TYPE {
    'ARROW_UP' = 'ARROW_UP',
    'ARROW_DOWN' = 'ARROW_DOWN',
    'ARROW_LEFT' = 'ARROW_LEFT',
    'ARROW_RIGHT' = 'ARROW_RIGHT',
    'HOME' = 'HOME',
    'START' = 'START',
    'SELECT' = 'SELECT',
    'CLUSTER_TOP' = 'CLUSTER_TOP',
    'CLUSTER_LEFT' = 'CLUSTER_LEFT',
    'CLUSTER_RIGHT' = 'CLUSTER_RIGHT',
    'CLUSTER_BOTTOM' = 'CLUSTER_BOTTOM',
    'BUMPER_TOP_LEFT' = 'BUMPER_TOP_LEFT',
    'BUMPER_BOTTOM_LEFT' = 'BUMPER_BOTTOM_LEFT',
    'BUMPER_TOP_RIGHT' = 'BUMPER_TOP_RIGHT',
    'BUMPER_BOTTOM_RIGHT' = 'BUMPER_BOTTOM_RIGHT',
    'STICK_PRESS_LEFT' = 'STICK_PRESS_LEFT',
    'STICK_PRESS_RIGHT' = 'STICK_PRESS_RIGHT',
    'TOUCHSCREEN' = 'TOUCHSCREEN',
  }

  export enum STICK_TYPE {
    'LEFT' = 'LEFT',
    'RIGHT' = 'RIGHT',
  }
  export enum ANALOG_TYPE {
    'BUMPER_LEFT' = 'BUMPER_LEFT',
    'BUMPER_RIGHT' = 'BUMPER_RIGHT',
  }
  
}