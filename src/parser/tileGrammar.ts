import * as ohm from 'ohm-js'
import {
    GameSprite,
    GameSpritePixels,
    GameSpriteSingleColor,
    GameLegendTileSimple,
    GameLegendTileOr,
    GameLegendTileAnd,
    IGameTile
} from '../models/tile'
import { LookupHelper } from './lookup'

export const SPRITE_GRAMMAR = `
    Sprite
        = SpritePixels
        | SpriteNoPixels

    SpriteNoPixels =
        spriteName legendShortcutChar? lineTerminator
        colorNameOrHex+ lineTerminator+

    SpritePixels =
        spriteName legendShortcutChar? lineTerminator
        colorNameOrHex+ lineTerminator+
        PixelRows
        lineTerminator*

    spriteName = ruleVariableName
    pixelRow = pixelDigit+ lineTerminator
    pixelDigit = digit | "."
    legendShortcutChar = (~lineTerminator any)

    PixelRows = pixelRow pixelRow pixelRow pixelRow pixelRow
`

export const LEGEND_GRAMMAR = `
    LegendTile
        = LegendTileSimple
        | LegendTileAnd
        | LegendTileOr

    LegendTileSimple = LegendVarNameDefn "=" LookupLegendVarName lineTerminator+
    LegendTileAnd = LegendVarNameDefn "=" NonemptyListOf<LookupLegendVarName, t_AND> lineTerminator+
    LegendTileOr = LegendVarNameDefn "=" NonemptyListOf<LookupLegendVarName, t_OR> lineTerminator+

    LegendVarNameDefn = ruleVariableName | legendVariableChar
    LookupLegendVarName = LegendVarNameDefn
`

export function getTileSemantics(lookup: LookupHelper) {
    return {
        Sprite: function (_1: ohm.Node) {
            const gameObject: GameSprite = _1.parse()
            lookup.addToAllObjects(gameObject)
            if (gameObject._optionalLegendChar) {
                // addObjectToAllLegendTiles(gameObject)
                lookup.addObjectToAllLevelChars(gameObject._optionalLegendChar, gameObject)
            } else if (gameObject._name.length === 1) {
                lookup.addObjectToAllLevelChars(gameObject._name, gameObject)
            }
            return gameObject
        },
        SpritePixels: function (name: ohm.Node, optionalLegendChar: ohm.Node, _3: ohm.Node, colors: ohm.Node, _5: ohm.Node, pixels: ohm.Node, _7: ohm.Node) {
            return new GameSpritePixels(this.source, name.parse(), optionalLegendChar.parse()[0], colors.parse(), pixels.parse())
        },
        SpriteNoPixels: function (name: ohm.Node, optionalLegendChar: ohm.Node, _3: ohm.Node, colors: ohm.Node, _5: ohm.Node) {
            return new GameSpriteSingleColor(this.source, name.parse(), optionalLegendChar.parse()[0], colors.parse())
        },
        PixelRows: function (row1: ohm.Node, row2: ohm.Node, row3: ohm.Node, row4: ohm.Node, row5: ohm.Node) {
            // Exactly 5 rows. We do this because some games contain vertical whitespace after, but not all
            return [
                row1.parse(),
                row2.parse(),
                row3.parse(),
                row4.parse(),
                row5.parse()
            ]
        },
        LookupLegendVarName: function (tile: ohm.Node) {
            // Replace all the Sprite Names with the actual objects
            return lookup.lookupObjectOrLegendTile(this.source, tile.parse())
        },
        LegendTile: function (_1: ohm.Node) {
            const legendTile: GameLegendTileSimple = _1.parse()
            lookup.addToAllLegendTiles(legendTile)
            if (legendTile._spriteNameOrLevelChar.length === 1) {
                lookup.addLegendToAllLevelChars(legendTile)
            }
            return legendTile
        },
        LegendTileSimple: function (spriteNameOrLevelChar: ohm.Node, _equals: ohm.Node, tile: ohm.Node, _whitespace: ohm.Node) {
            // TODO: Do the lookup and adding to sets here rather than rewiring in LegendTile
            return new GameLegendTileSimple(this.source, spriteNameOrLevelChar.parse(), tile.parse())
        },
        LegendTileAnd: function (spriteNameOrLevelChar: ohm.Node, _equals:string, tiles: ohm.Node, _whitespace: ohm.Node) {
            return new GameLegendTileAnd(this.source, spriteNameOrLevelChar.parse(), tiles.parse())
        },
        LegendTileOr: function (spriteNameOrLevelChar: ohm.Node, _equals: ohm.Node, tiles: ohm.Node, _whitespace: ohm.Node) {
            return new GameLegendTileOr(this.source, spriteNameOrLevelChar.parse(), tiles.parse())
        }
    }
}