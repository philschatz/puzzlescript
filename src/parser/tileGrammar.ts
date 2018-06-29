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
import { Parseable } from './gameGrammar';
import { HexColor } from '../models/colors';

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
        Sprite: function (_1: Parseable<GameSprite>) {
            const gameObject = _1.parse()
            lookup.addToAllObjects(gameObject)
            if (gameObject._optionalLegendChar) {
                // addObjectToAllLegendTiles(gameObject)
                lookup.addObjectToAllLevelChars(gameObject._optionalLegendChar, gameObject)
            } else if (gameObject._name.length === 1) {
                lookup.addObjectToAllLevelChars(gameObject._name, gameObject)
            }
            return gameObject
        },
        SpritePixels: function (name: Parseable<string>, optionalLegendChar: Parseable<string[]>, _3: Parseable<string>, colors: Parseable<HexColor[]>, _5: Parseable<string>, pixels: Parseable<(number | ".")[][]>, _7: Parseable<string>) {
            return new GameSpritePixels(this.source, name.parse(), optionalLegendChar.parse()[0], colors.parse(), pixels.parse())
        },
        SpriteNoPixels: function (name: Parseable<string>, optionalLegendChar: Parseable<string[]>, _3: Parseable<string>, colors: Parseable<HexColor[]>, _5: Parseable<string>) {
            return new GameSpriteSingleColor(this.source, name.parse(), optionalLegendChar.parse()[0], colors.parse())
        },
        PixelRows: function (row1: Parseable<string>, row2: Parseable<string>, row3: Parseable<string>, row4: Parseable<string>, rows: Parseable<string>) {
            return [
                row1.parse(),
                row2.parse(),
                row3.parse(),
                row4.parse()
            ].concat(rows.parse())
        },
        LookupLegendVarName: function (tileName: Parseable<string>) {
            // Replace all the Sprite Names with the actual objects
            return lookup.lookupObjectOrLegendTile(this.source, tileName.parse())
        },
        LegendTile: function (tile: Parseable<GameLegendTileSimple>) {
            const legendTile = tile.parse()
            lookup.addToAllLegendTiles(legendTile)
            if (legendTile._spriteNameOrLevelChar.length === 1) {
                lookup.addLegendToAllLevelChars(legendTile)
            }
            return legendTile
        },
        LegendTileSimple: function (spriteNameOrLevelChar: Parseable<string>, _equals: Parseable<string>, tile: Parseable<GameSprite>, _whitespace: Parseable<string>) {
            // TODO: Do the lookup and adding to sets here rather than rewiring in LegendTile
            return new GameLegendTileSimple(this.source, spriteNameOrLevelChar.parse(), tile.parse())
        },
        LegendTileAnd: function (spriteNameOrLevelChar: Parseable<string>, _equals: Parseable<string>, tiles: Parseable<IGameTile[]>, _whitespace: Parseable<string>) {
            return new GameLegendTileAnd(this.source, spriteNameOrLevelChar.parse(), tiles.parse())
        },
        LegendTileOr: function (spriteNameOrLevelChar: Parseable<string>, _equals: Parseable<string>, tiles: Parseable<IGameTile[]>, _whitespace: Parseable<string>) {
            return new GameLegendTileOr(this.source, spriteNameOrLevelChar.parse(), tiles.parse())
        }
    }
}