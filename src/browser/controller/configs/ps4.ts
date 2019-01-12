import { GamepadMapping } from '.'

const config: GamepadMapping = {
    id: '54c-9cc-Wireless Controller',
    buttons: {
        ARROW_UP: 14,
        ARROW_DOWN: 15,
        ARROW_LEFT: 16,
        ARROW_RIGHT: 17,
        HOME: 12,
        START: 9,
        SELECT: 8,
        CLUSTER_TOP: 3,
        CLUSTER_LEFT: 0,
        CLUSTER_RIGHT: 2,
        CLUSTER_BOTTOM: 1,
        BUMPER_TOP_LEFT: 4,
        BUMPER_BOTTOM_LEFT: 6,
        BUMPER_TOP_RIGHT: 5,
        BUMPER_BOTTOM_RIGHT: 7,
        STICK_PRESS_LEFT: 10,
        STICK_PRESS_RIGHT: 11,
        TOUCHSCREEN: 13
    },
    sticks: {
        LEFT: { xAxis: 0, yAxis: 1 },
        RIGHT: { xAxis: 2, yAxis: 5 }
    },
    analogs: {
        BUMPER_LEFT: 3,
        BUMPER_RIGHT: 4
    }
}

export default config
