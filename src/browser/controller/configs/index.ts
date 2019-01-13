/* Mappings for all supported controllers.
 * To add a new controller, add a new JSON file and update the `controllerConfigs` below.
 * https://html5gamepad.com/ can be helpful for getting the values.
 */
import c0 from './n64-retrolink'
import c1 from './ps3'
import c2 from './ps4'
import standard from './standard'
import c3 from './xbox'
import c4 from './xbox-360'

const controllerConfigs = [
    // These are ordered by popularity
    standard,
    c2,
    c3,
    c1,
    c4,
    c0
]

export interface StickIndexes {
    xAxis: number
    yAxis: number
}

export interface GamepadMapping {
    id: string
    buttons: {
        ARROW_UP?: number
        ARROW_DOWN?: number
        ARROW_LEFT?: number
        ARROW_RIGHT?: number
        HOME?: number
        START?: number
        SELECT?: number
        CLUSTER_TOP?: number
        CLUSTER_LEFT?: number
        CLUSTER_RIGHT?: number
        CLUSTER_BOTTOM?: number
        BUMPER_TOP_LEFT?: number
        BUMPER_BOTTOM_LEFT?: number
        BUMPER_TOP_RIGHT?: number
        BUMPER_BOTTOM_RIGHT?: number
        STICK_PRESS_LEFT?: number
        STICK_PRESS_RIGHT?: number
        TOUCHSCREEN?: number
    },
    sticks: {
        LEFT?: StickIndexes
        RIGHT?: StickIndexes
    },
    analogs: {
        BUMPER_LEFT?: number
        BUMPER_RIGHT?: number
    }
}

export function getGamepadConfig(gamepad: Gamepad) {
    if (gamepad.mapping === 'standard') {
        return standard
    } else {
        return controllerConfigs.find((c) => gamepad.id === c.id) || null
    }
}
