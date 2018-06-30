import { IColor } from './colors'

export class Dimension {
    readonly width: number
    readonly height: number

    constructor(width: number, height: number) {
        this.width = width
        this.height = height
    }
}

export class GameMetadata {
    author?: string
    homepage?: string
    youtube?: string
    zoomscreen?: Dimension
    flickscreen?: Dimension
    color_palette?: string
    background_color?: IColor
    text_color?: IColor
    realtime_interval?: string
    key_repeat_interval?: string
    again_interval?: string
    noaction: boolean
    noundo: boolean
    run_rules_on_level_start?: string
    norepeat_action: boolean
    throttle_movement: boolean
    norestart: boolean
    require_player_movement: boolean
    verbose_logging: boolean

    constructor() {
        this.noaction = false
        this.noundo = false
        this.norepeat_action = false
        this.throttle_movement = false
        this.norestart = false
        this.require_player_movement = false
        this.verbose_logging = false
    }

    _setValue(key: string, value: boolean | string | Dimension | IColor) {
        switch (key) {
            case 'author': this.author = <string> value; break
            case 'homepage': this.homepage = <string> value; break
            case 'youtube': this.youtube = <string> value; break
            case 'zoomscreen': this.zoomscreen = <Dimension> value; break
            case 'flickscreen': this.flickscreen = <Dimension> value; break
            case 'color_palette': this.color_palette = <string> value; break
            case 'background_color': this.background_color = <IColor> value; break
            case 'text_color': this.text_color = <IColor> value; break
            case 'realtime_interval': this.realtime_interval = <string> value; break
            case 'key_repeat_interval': this.key_repeat_interval = <string> value; break
            case 'again_interval': this.again_interval = <string> value; break
            case 'noaction': this.noaction = <boolean> value; break
            case 'noundo': this.noundo = <boolean> value; break
            case 'run_rules_on_level_start': this.run_rules_on_level_start = <string> value; break
            case 'norepeat_action': this.norepeat_action = <boolean> value; break
            case 'throttle_movement': this.throttle_movement = <boolean> value; break
            case 'norestart': this.norestart = <boolean> value; break
            case 'require_player_movement': this.require_player_movement = <boolean> value; break
            case 'verbose_logging': this.verbose_logging = <boolean> value; break
            default:
                throw new Error(`BUG: Unsupported config field "${key}" with value "${value}"`)
        }
    }
}