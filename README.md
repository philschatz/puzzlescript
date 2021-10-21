# Instructions

1. Install [lerna](https://lerna.js.org)
1. `lerna bootstrap --force-local`
1. `lerna run compile`
1. `lerna run test --stream`
    - you can run `test:unit` or `test:web` to just run tests specific to a package
1. `lerna run test:integration --stream` (this runs several games and takes about 30min)
1. `lerna run start:server --stream` to start up a server

# Maintainer Instructions

To publish a new version of the packages:

```sh
lerna publish prerelease
```

# TODO

- [x] Move to a monorepo
- [x] Add embedding example
- [ ] Upgrade dependencies
- [x] Move CLI code into a separate package
- [ ] Maybe move games into a separate package
- [ ] Update so that the puzzlescript package (or puzzlescript-embed package) has 0 dependencies
