import { GamepadMapping } from '.'

const config: GamepadMapping = {
    id: 'Wireless Controller (STANDARD GAMEPAD)',
    buttons: {
        ARROW_UP: 12,
        ARROW_DOWN: 13,
        ARROW_LEFT: 14,
        ARROW_RIGHT: 15,
        HOME: 16,
        START: 9,
        SELECT: 8,
        CLUSTER_TOP: 3,
        CLUSTER_LEFT: 2,
        CLUSTER_RIGHT: 1,
        CLUSTER_BOTTOM: 0,
        BUMPER_TOP_LEFT: 4,
        BUMPER_BOTTOM_LEFT: 6,
        BUMPER_TOP_RIGHT: 5,
        BUMPER_BOTTOM_RIGHT: 7,
        STICK_PRESS_LEFT: 10,
        STICK_PRESS_RIGHT: 11
    },
    sticks: {
        LEFT: { xAxis: 0, yAxis: 1 },
        RIGHT: { xAxis: 2, yAxis: 3 }
    },
    analogs: {}
}

export default config
