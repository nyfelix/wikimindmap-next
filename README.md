# WikiMindMap 2027

The relaunch of [wikimindmap.org](https://github.com/nyfelix/wikimindmap) (2007). Type a term, the Wikipedia article becomes the center of a mind map, and its links become branches. Tap ⊕ on a node to make it the new center and browse the encyclopedia as a map.

Live at https://nyfelix.github.io/wikimindmap-next/

WikiMindMap is an independent project and is not affiliated with or endorsed by the Wikimedia Foundation. Wikipedia is a trademark of the Wikimedia Foundation. Map content comes from Wikipedia under CC BY-SA.

## Getting started

Development runs entirely in a VS Code dev container. On the host you only need:

- **Docker**: [Docker Desktop](https://www.docker.com/products/docker-desktop/) or [OrbStack](https://orbstack.dev/)
- **VS Code** with the [Dev Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) extension

Nothing else needs installing on the host: Node 22, npm, Playwright's browsers, the GitHub CLI and Claude Code all live in the container.

1. Start Docker (or OrbStack).
2. Open this folder in VS Code and choose **Reopen in Container** when prompted (or run *Dev Containers: Reopen in Container* from the command palette).
3. Wait for the first build. Dependencies are installed automatically.
4. In the container terminal, `node -v` shows v22 and `claude --version` works.

Run all commands in the container terminal, not on the host. A missing tool belongs in `.devcontainer/devcontainer.json`; don't install it by hand in the running container.

## Commands

Run these in the container terminal.

```bash
npm run dev          # dev server at http://localhost:5173
npm run check        # typecheck + lint + format check + unit tests (run before every commit)
npm test             # unit tests (Vitest) in watch mode
npm run e2e          # Playwright tests against the built app, network mocked
npm run build        # production build into dist/ (set BASE_PATH for a sub-path)
npm run fixtures -- en "Mind map"   # record real API responses into tests/fixtures/
```

## Documents

- [`architecture.md`](architecture.md): stack, modules, data sources, decisions
- [`datamodel.md`](datamodel.md): TypeScript types
- [`userstories.md`](userstories.md): milestones and stories (the plan)
- [`concepts/`](concepts/): clickable previews of the lenses

## License

The code is released under the [MIT License](LICENSE).

Some parts come with their own licences:

- **Map content** (titles, summaries, images) comes from the wiki being mapped and keeps that wiki's licence. For Wikipedia that's [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). The app shows the attribution on every map.
- **Test fixtures** in `tests/fixtures/` are recorded Wikipedia pages and API responses, under CC BY-SA 4.0, from the articles named in their folder paths.
- **Fonts** (Bricolage Grotesque, Zilla Slab, Fira Sans, Fira Mono) are under the [SIL Open Font License 1.1](https://openfontlicense.org/), installed through Fontsource.

If you fork WikiMindMap and run it publicly, please use your own name and logo, so your version isn't mistaken for this one.
