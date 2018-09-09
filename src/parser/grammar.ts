import { COLLISIONLAYERS_GRAMMAR } from './collisionLayerGrammar'
import { COMMON_GRAMMAR, METADATA_GRAMMAR, STRINGTOKEN_GRAMMAR } from './gameGrammar'
import { LEVEL_GRAMMAR } from './levelGrammar'
import { RULE_GRAMMAR } from './ruleGrammar'
import { SOUND_GRAMMAR } from './soundGrammar'
import { LEGEND_GRAMMAR, SPRITE_GRAMMAR } from './tileGrammar'
import { WINCONDITIONS_GRAMMAR } from './winConditionGrammar'

export const PUZZLESCRIPT_GRAMMAR = `Puzzlescript {
    ${COMMON_GRAMMAR}
    ${STRINGTOKEN_GRAMMAR}
    ${METADATA_GRAMMAR}
    ${SPRITE_GRAMMAR}
    ${LEGEND_GRAMMAR}
    ${SOUND_GRAMMAR}
    ${COLLISIONLAYERS_GRAMMAR}
    ${RULE_GRAMMAR}
    ${WINCONDITIONS_GRAMMAR}
    ${LEVEL_GRAMMAR}
}`
