# LOREBOUND test site

Test builds of LOREBOUND, played at **https://lorebound-dev.github.io/**. The real game is at https://lorebound-game.github.io/.

This repository holds the current test build: the latest `main` of the private `lorebound-game/LOREBOUND` repository, plus every open pull request that changes the game, combined. `test-build.json` lists which pull requests are in, and any that were left out because they clash. `.github/workflows/publish-test.yml` there replaces everything here except `status/` with each test build, so make changes there, not here. The test site has its own address, so its saves never mix with the real game's.
