import { COMMON_GRAMMAR, STRINGTOKEN_GRAMMAR, METADATA_GRAMMAR } from './gameGrammar'
import { SPRITE_GRAMMAR, LEGEND_GRAMMAR } from './tileGrammar'
import { SOUND_GRAMMAR } from './soundGrammar'
import { RULE_GRAMMAR } from './ruleGrammar'
import { LEVEL_GRAMMAR } from './levelGrammar'
import { COLLISIONLAYERS_GRAMMAR } from './collisionLayerGrammar'
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