import * as _ from 'lodash'
import * as ohm from 'ohm-js'
import { PUZZLESCRIPT_GRAMMAR } from './grammar'
import { LookupHelper } from './lookup'
import { getGameSemantics } from './gameGrammar'
import { getTileSemantics } from './tileGrammar'
import { getSoundSemantics } from './soundGrammar'
import { getRuleSemantics } from './ruleGrammar'
import { getLevelSemantics } from './levelGrammar'
import { getCollisionLayerSemantics } from './collisionLayerGrammar'
import { getWinConditionSemantics } from './winConditionGrammar'
import { GameData, IGameNode } from '../models/game'

let _GRAMMAR: ohm.Grammar = null

export type AddValidationFunc = (source: IGameNode, level: ValidationLevel, message: string) => void

export enum ValidationLevel {
    ERROR,
    WARNING,
    INFO
}

class ValidationMessage {
    gameNode: IGameNode
    level: ValidationLevel
    message: string

    constructor(gameNode: IGameNode, level: ValidationLevel, message: string) {
        this.gameNode = gameNode
        this.level = level
        this.message = message
    }
}

class Parser {
    getGrammar() {
        _GRAMMAR = _GRAMMAR || ohm.grammar(PUZZLESCRIPT_GRAMMAR)
        return _GRAMMAR
    }

    parseGrammar(code: string) {
        // HACKs
        // 8645c163ff321d2fd1bad3fcaf48c107 has a typo so we .replace()
        // 0c2625672bf47fcf728fe787a2630df6 has a typo se we .replace()
        // another couple of games do not have a trailing newline at the end of the file so we add that
        code = code
            .replace('again]', '] AGAIN') // From "Rose"
            .replace('][ ->', '] ->')
            .replace('[[spring]', '[spring][') + '\n' // Not all games have a trailing newline. this makes it easier on the parser

        const g = this.getGrammar()
        return { match: g.match(code) }
    }

    parse(code: string) {
        const g = this.getGrammar()
        const { match: m } = this.parseGrammar(code)
        const validationMessages: ValidationMessage[] = []

        function addValidationMessage(source: IGameNode, level: ValidationLevel, message: string) {
            validationMessages.push(new ValidationMessage(source, level, message))
        }

        if (m.succeeded()) {
            const s = g.createSemantics()
            const lookup = new LookupHelper()

            let operations = {}

            _.extend(operations,
                getGameSemantics(lookup, addValidationMessage),
                getTileSemantics(lookup),
                getSoundSemantics(lookup),
                getRuleSemantics(lookup),
                getLevelSemantics(lookup),
                getCollisionLayerSemantics(lookup, addValidationMessage),
                getWinConditionSemantics()
            )
            s.addOperation('parse', operations)
            const game: GameData = s(m).parse()

            // Validate that the game objects are rectangular
            game.objects.forEach((sprite) => {
                // if (!sprite.hasCollisionLayer()) {
                //   addValidationMessage(sprite, ValidationLevel.WARNING, `Game object is not in a Collision Layer. All objects must be in exactly one collision layer`)
                // }
                if (sprite.isInvalid()) {
                    addValidationMessage(sprite, ValidationLevel.WARNING, `Game Object is Invalid. Reason: ${sprite.isInvalid()}`)
                }
            })

            // Validate that the level maps are rectangular
            game.levels.forEach((level) => {
                if (level.isInvalid()) {
                    addValidationMessage(level, ValidationLevel.WARNING, `Level is Invalid. Reason: ${level.isInvalid()}`)
                }
            })

            return { data: game, validationMessages }
        } else {
            const trace = g.trace(code)
            return { error: m, trace: trace }
        }
    }
}

export default new Parser()
