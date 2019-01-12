import { GamepadMapping } from '.'

const config: GamepadMapping = {
    id: '79-6-Generic   USB  Joystick  ',
    buttons: {
        ARROW_UP: 12,
        ARROW_DOWN: 13,
        ARROW_LEFT: 14,
        ARROW_RIGHT: 15,
        // HOME
        START: 9,
        // SELECT
        CLUSTER_TOP: 3,
        CLUSTER_LEFT: 8,
        CLUSTER_RIGHT: 2,
        CLUSTER_BOTTOM: 6,
        BUMPER_TOP_LEFT: 4,
        BUMPER_BOTTOM_LEFT: 7,
        BUMPER_TOP_RIGHT: 5,
        // BUMPER_BOTTOM_RIGHT
        STICK_PRESS_LEFT: 0,
        STICK_PRESS_RIGHT: 1
    },
    sticks: {
        LEFT: { xAxis: 1, yAxis: 2 }
        // RIGHT
    },
    analogs: {}
}

export default config
