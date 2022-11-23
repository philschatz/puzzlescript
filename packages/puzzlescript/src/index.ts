import { Cell, CellSaveState, GameEngine, ILoadingCellsEvent } from './engine'
import { GameData } from './models/game'
import Parser from './parser/parser'
import Serializer, { IGraphJson } from './parser/serializer'
import BaseUI from './ui/base'
import {
    _debounce,
    _flatten,
    Cellish,
    CellishJson,
    EmptyGameEngineHandler,
    Engineish,
    GameEngineHandler,
    GameEngineHandlerOptional,
    INPUT_BUTTON,
    MESSAGE_TYPE,
    Optional,
    pollingPromise,
    PuzzlescriptWorker,
    RULE_DIRECTION,
    shouldTick,
    spritesThatInteractWithPlayer,
    TypedMessageEvent,
    WorkerMessage,
    WorkerResponse } from './util'

// Public API
export { Parser, GameEngine, Cell, ILoadingCellsEvent, GameData, Optional, RULE_DIRECTION, BaseUI, Serializer }

// Semi-public API (used by the CLI)
import { logger } from './logger'
import { CollisionLayer } from './models/collisionLayer'
import { HexColor, IColor } from './models/colors'
import { Dimension } from './models/metadata'
import { A11Y_MESSAGE, A11Y_MESSAGE_TYPE } from './models/rule'
import { GameSprite } from './models/tile'
import { LEVEL_TYPE, Soundish } from './parser/astTypes'
import { saveCoverageFile } from './recordCoverage'
import TableUI from './ui/table'

export { logger, LEVEL_TYPE, saveCoverageFile, _flatten, EmptyGameEngineHandler, INPUT_BUTTON }
export { _debounce, CollisionLayer, IColor, GameSprite, Soundish, Cellish, GameEngineHandler, spritesThatInteractWithPlayer }
export { CellSaveState, A11Y_MESSAGE, A11Y_MESSAGE_TYPE }
export { CellishJson, MESSAGE_TYPE, pollingPromise, shouldTick, TypedMessageEvent, WorkerMessage, WorkerResponse }
export { TableUI }
export { Engineish, GameEngineHandlerOptional }
export { Dimension, IGraphJson, PuzzlescriptWorker, HexColor }
