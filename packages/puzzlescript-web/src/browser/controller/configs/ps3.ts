import { GamepadMapping } from '.'

const config: GamepadMapping = {
    id: '54c-268-PLAYSTATION(R)3 Controller',
    buttons: {
        ARROW_UP: 4,
        ARROW_DOWN: 6,
        ARROW_LEFT: 7,
        ARROW_RIGHT: 5,
        HOME: 16,
        START: 3,
        SELECT: 0,
        CLUSTER_TOP: 12,
        CLUSTER_LEFT: 15,
        CLUSTER_RIGHT: 13,
        CLUSTER_BOTTOM: 14,
        BUMPER_TOP_LEFT: 10,
        BUMPER_BOTTOM_LEFT: 8,
        BUMPER_TOP_RIGHT: 11,
        BUMPER_BOTTOM_RIGHT: 9,
        STICK_PRESS_LEFT: 1,
        STICK_PRESS_RIGHT: 2
    },
    sticks: {
        LEFT: { xAxis: 0, yAxis: 1 },
        RIGHT: { xAxis: 2, yAxis: 3 }
    },
    analogs: {}
}

export default config
