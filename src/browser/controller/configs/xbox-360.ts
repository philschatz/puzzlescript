import { GamepadMapping } from '.'

const config: GamepadMapping = {
    id: '45e-28e-Xbox 360 Wired Controller',
    buttons: {
        ARROW_UP: 0,
        ARROW_DOWN: 1,
        ARROW_LEFT: 2,
        ARROW_RIGHT: 3,
        HOME: 10,
        START: 4,
        SELECT: 5,
        CLUSTER_TOP: 14,
        CLUSTER_LEFT: 13,
        CLUSTER_RIGHT: 12,
        CLUSTER_BOTTOM: 11,
        BUMPER_TOP_LEFT: 8,
        // BUMPER_BOTTOM_LEFT: 7,
        BUMPER_TOP_RIGHT: 9,
        // BUMPER_BOTTOM_RIGHT
        STICK_PRESS_LEFT: 6,
        STICK_PRESS_RIGHT: 7
    },
    sticks: {
        LEFT: { xAxis: 0, yAxis: 1 },
        RIGHT: { xAxis: 3, yAxis: 4 }
    },
    analogs: {
        BUMPER_LEFT: 2, // -1, 1
        BUMPER_RIGHT: 5 // -1, 1
    }
}

export default config
