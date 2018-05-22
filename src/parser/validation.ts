import { GameData, IGameNode } from '../models/game'

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

export class ValidationHelper {
    _validationMessages: ValidationMessage[]

    constructor () {
        this._validationMessages = []
    }

    addValidationMessage(source: IGameNode, level: ValidationLevel, message: string) {
        this._validationMessages.push(new ValidationMessage(source, level, message))
    }

    getValidationMessages() {
        return this._validationMessages
    }
}