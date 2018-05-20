import { IColor } from '../parser/parser'

class Dimension {
    width: number
    height: number

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
    noaction: false
    noundo: false
    run_rules_on_level_start?: string
    norepeat_action: false
    throttle_movement: false
    norestart: false
    require_player_movement: false
    verbose_logging: false

    constructor() { }

    _setValue(key: any, value: any) {
      this[key] = value
    }
  }