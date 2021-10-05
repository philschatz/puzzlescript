# Design

# Rules

Example: `RIGHT [ > Player | NO Enemy STATIONARY Wall ] -> [ Player | Monster ] MESSAGE Hello World`



- `IRule` contains: (e.g. `RIGHT [ > Player | NO Enemy STATIONARY Wall ] -> [ Player | Monster ] MESSAGE Hello World`)
  - a set of condition `Bracket`s to match
  - an optional set of action `Bracket`s
- `Bracket` contains a list of `Neighbor` to match (e.g. `[ > Player | NO Enemy STATIONARY Wall ]`)
- `Neighbor` contains a set of `TileWithModifier` (e.g. `NO Enemy STATIONARY Wall`)
- `TileWithModifier` contains: (e.g. `NO Enemy`)
  - a `IGameTile`
  - an optional `RULE_DIRECTION` that represents which direction a `GameSprite` wants to move
  - an optional flag if it is negated (e.g. `NO Enemy`)
- `IGameTile` represents one or more sprites that will be matched in an `IRule` (e.g. `Enemy`)
  - can be an `LegendTile` (one sprite), `OrTile` (of a set of sprites), or `AndTile` (all of the set of sprites)
- `GameSprite` contains: (e.g. `Monster`)
  - a 5x5 array of Pixels or a single color (`RGBA[][]`)
  - a name (`string`)
  - a `CollisionLayer`


# Level

