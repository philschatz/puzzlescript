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

    // Support at least 5x5 sprites (so we can disambiguate from single-color definitions)
    PixelRows = pixelRow pixelRow pixelRow pixelRow pixelRow+
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
        Sprite: function (_1) {
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
        SpritePixels: function (name, optionalLegendChar, _3, colors, _5, pixels, _7) {
            return new GameSpritePixels(this.source, name.parse(), optionalLegendChar.parse()[0], colors.parse(), pixels.parse())
        },
        SpriteNoPixels: function (name, optionalLegendChar, _3, colors, _5) {
            return new GameSpriteSingleColor(this.source, name.parse(), optionalLegendChar.parse()[0], colors.parse())
        },
        PixelRows: function (row1, row2, row3, row4, rows) {
            return [
                row1.parse(),
                row2.parse(),
                row3.parse(),
                row4.parse()
            ].concat(rows.parse())
        },
        LookupLegendVarName: function (tile) {
            // Replace all the Sprite Names with the actual objects
            return lookup.lookupObjectOrLegendTile(this.source, tile.parse())
        },
        LegendTile: function (_1) {
            const legendTile: GameLegendTileSimple = _1.parse()
            lookup.addToAllLegendTiles(legendTile)
            if (legendTile._spriteNameOrLevelChar.length === 1) {
                lookup.addLegendToAllLevelChars(legendTile)
            }
            return legendTile
        },
        LegendTileSimple: function (spriteNameOrLevelChar, _equals, tile, _whitespace) {
            // TODO: Do the lookup and adding to sets here rather than rewiring in LegendTile
            return new GameLegendTileSimple(this.source, spriteNameOrLevelChar.parse(), tile.parse())
        },
        LegendTileAnd: function (spriteNameOrLevelChar, _equals, tiles, _whitespace) {
            return new GameLegendTileAnd(this.source, spriteNameOrLevelChar.parse(), tiles.parse())
        },
        LegendTileOr: function (spriteNameOrLevelChar, _equals, tiles, _whitespace) {
            return new GameLegendTileOr(this.source, spriteNameOrLevelChar.parse(), tiles.parse())
        }
    }
}