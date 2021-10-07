# Instructions

1. Install [lerna](https://lerna.js.org)
1. `lerna bootstrap`
1. `lerna run compile`
1. `lerna run test --stream`
    - you can run `test:unit` or `test:web` to just run tests specific to a package
1. `lerna run test:integration --stream` (this runs several games and takes about 30min)
1. `lerna run start`


lerna bootstrap
lerna run compile:grammar
lerna run compile:ts
lerna run build

# TODO

- [x] Move to a monorepo
- [x] Add embedding example
- [ ] Move CLI code into a separate package
- [ ] Maybe move games into a separate package
- [ ] Update so that the puzzlescript package (or puzzlescript-embed package) has 0 dependencies
