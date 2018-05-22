import { IColor } from './colors'

export class Dimension {
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
  color_palette?: string
  background_color?: IColor
  zoomscreen?: Dimension
  flickscreen?: Dimension
  text_color?: IColor
  run_rules_on_level_start?: string
  realtime_interval?: number
  key_repeat_interval?: number
  again_interval?: number
  noaction: boolean
  noundo: boolean
  norepeat_action: boolean
  throttle_movement: boolean
  norestart: boolean
  require_player_movement: boolean
  verbose_logging: boolean

  constructor() {
    this.author = ''
    this.homepage = ''
    this.youtube = ''
    this.color_palette = ''
    this.realtime_interval = 0
    this.key_repeat_interval = 0
    this.again_interval = 0
    this.noaction = false
    this.noundo = false
    this.norepeat_action = false
    this.throttle_movement = false
    this.norestart = false
    this.require_player_movement = false
    this.verbose_logging = false
  }
}