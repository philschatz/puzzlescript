import * as ohm from 'ohm-js'
import { HexColor } from '../models/colors'
import {
    GameLegendTileAnd,
    GameLegendTileOr,
    GameLegendTileSimple,
    GameSprite,
    GameSpritePixels,
    GameSpriteSingleColor,
    IGameTile
} from '../models/tile'
import { IParseable } from './gameGrammar'
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
        Sprite(this: ohm.Node, _1: IParseable<GameSprite>) {
            const gameObject = _1.parse()
            lookup.addToAllObjects(gameObject)
            if (gameObject._optionalLegendChar) {
                // addObjectToAllLegendTiles(gameObject)
                lookup.addObjectToAllLevelChars(gameObject._optionalLegendChar, gameObject)
            } else if (gameObject.getName().length === 1) {
                lookup.addObjectToAllLevelChars(gameObject.getName(), gameObject)
            }
            return gameObject
        },
        SpritePixels(this: ohm.Node, name: IParseable<string>, optionalLegendChar: IParseable<string[]>,
                     _3: IParseable<string>, colors: IParseable<HexColor[]>, _5: IParseable<string>,
                     pixels: IParseable<Array<Array<number | '.'>>>, _7: IParseable<string>) {

            return new GameSpritePixels(this.source, name.parse(), optionalLegendChar.parse()[0], colors.parse(), pixels.parse())
        },
        SpriteNoPixels(this: ohm.Node, name: IParseable<string>, optionalLegendChar: IParseable<string[]>, _3: IParseable<string>, colors: IParseable<HexColor[]>, _5: IParseable<string>) {
            return new GameSpriteSingleColor(this.source, name.parse(), optionalLegendChar.parse()[0], colors.parse())
        },
        PixelRows(this: ohm.Node, row1: IParseable<string>, row2: IParseable<string>, row3: IParseable<string>, row4: IParseable<string>, rows: IParseable<string>) {
            return [
                row1.parse(),
                row2.parse(),
                row3.parse(),
                row4.parse()
            ].concat(rows.parse())
        },
        LookupLegendVarName(this: ohm.Node, tileName: IParseable<string>) {
            // Replace all the Sprite Names with the actual objects
            return lookup.lookupObjectOrLegendTile(this.source, tileName.parse())
        },
        LegendTile(this: ohm.Node, tile: IParseable<GameLegendTileSimple>) {
            const legendTile = tile.parse()
            lookup.addToAllLegendTiles(legendTile)
            if (legendTile.spriteNameOrLevelChar.length === 1) {
                lookup.addLegendToAllLevelChars(legendTile)
            }
            return legendTile
        },
        LegendTileSimple(this: ohm.Node, spriteNameOrLevelChar: IParseable<string>, _equals: IParseable<string>, tile: IParseable<GameSprite>, _whitespace: IParseable<string>) {
            // TODO: Do the lookup and adding to sets here rather than rewiring in LegendTile
            return new GameLegendTileSimple(this.source, spriteNameOrLevelChar.parse(), tile.parse())
        },
        LegendTileAnd(this: ohm.Node, spriteNameOrLevelChar: IParseable<string>, _equals: IParseable<string>, tiles: IParseable<IGameTile[]>, _whitespace: IParseable<string>) {
            return new GameLegendTileAnd(this.source, spriteNameOrLevelChar.parse(), tiles.parse())
        },
        LegendTileOr(this: ohm.Node, spriteNameOrLevelChar: IParseable<string>, _equals: IParseable<string>, tiles: IParseable<IGameTile[]>, _whitespace: IParseable<string>) {
            return new GameLegendTileOr(this.source, spriteNameOrLevelChar.parse(), tiles.parse())
        }
    }
}
