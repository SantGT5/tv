# IPTV

Collection of publicly available IPTV (Internet Protocol television) channels from all over the world.

This is a working copy of [iptv-org/iptv](https://github.com/iptv-org/iptv) with a local [playlist viewer](#playlist-viewer) added on top.

## Table of contents

- 🚀 [How to use?](#how-to-use)
- 📺 [Playlists](#playlists)
- 🖥 [Playlist viewer](#playlist-viewer)
- 🧰 [Scripts](#scripts)
- 🗂 [Project structure](#project-structure)
- 🗓 [EPG](#epg)
- 🗄 [Database](#database)
- 👨‍💻 [API](#api)
- 📚 [Resources](#resources)
- 💬 [Discussions](#discussions)
- ⚖ [Legal](#legal)
- © [License](#license)

## How to use?

Simply paste the link to one of the playlists into [any video player](https://github.com/iptv-org/awesome-iptv#apps) that supports live streaming and press _Open_.

## Playlists

The main published playlist containing all channels can be found at:

```
https://iptv-org.github.io/iptv/index.m3u
```

Links to the other published playlists (by category, language, country, region) are listed in [PLAYLISTS.md](https://github.com/iptv-org/iptv/blob/master/PLAYLISTS.md) upstream.

The source playlists live in [streams/](streams/) — one file per country (`br.m3u`), plus provider-specific files where needed (`us_pluto.m3u`). `npm run playlist:generate` builds the published versions from them.

## Playlist viewer

A local browser UI for browsing, filtering and checking the playlists in [streams/](streams/). It has no dependencies beyond Node built-ins and binds to `127.0.0.1` only.

```sh
npm install
npm run viewer          # http://127.0.0.1:4321
PORT=8080 npm run viewer
```

It groups every file by the country code in its name, supports search and filters (category, quality, 24/7, geo-blocked, NSFW), can test whether a stream is online, export the current selection as an `.m3u`, and run the format/lint/validate pipeline with live output. Full details in [viewer/README.md](viewer/README.md).

## Scripts

The repository is maintained with a set of scripts in [scripts/](scripts/), run via `npm run`:

| Command             | Description                                                                           |
| ------------------- | ------------------------------------------------------------------------------------- |
| `api:load`          | Download the channel data from the API into `temp/data/` (also runs on `postinstall`) |
| `playlist:format`   | Normalize the playlists in [streams/](streams/)                                       |
| `playlist:lint`     | Check the playlists against [m3u-linter.json](m3u-linter.json)                        |
| `playlist:validate` | Validate stream IDs and links against the database                                    |
| `playlist:test`     | Test whether the stream links are still working                                       |
| `playlist:edit`     | Interactively edit a playlist                                                         |
| `playlist:update`   | Apply approved issues to the playlists                                                |
| `playlist:generate` | Generate the published playlists into `.gh-pages/`                                    |
| `playlist:export`   | Export all streams as a single `.api/streams.json`                                    |
| `report:create`     | Create a report on the state of the open issues and discussions                       |
| `lint`              | Run ESLint over `scripts/` and `tests/`                                               |
| `test`              | Run the Jest test suites in [tests/](tests/)                                          |

Two script entries in [package.json](package.json) don't work in this checkout because their inputs aren't part of it: `readme:update` needs `.readme/template.md`, and the `act:*` commands need `.github/workflows/`.

## Project structure

- [scripts/](scripts/): internal utility scripts backing the `npm run` commands above.
- [streams/](streams/): the playlists themselves, one `.m3u` per country/provider.
- [tests/](tests/): Jest suites covering the commands in `scripts/commands/`.
- [viewer/](viewer/): the local playlist viewer (server + static frontend).
- `temp/`: API data and logs downloaded by `api:load`; not checked in.

## EPG

[Electronic Program Guide](https://en.wikipedia.org/wiki/Electronic_program_guide) for most of the channels can be downloaded using utilities published in the [iptv-org/epg](https://github.com/iptv-org/epg) repository.

## Database

All channel data is taken from the [iptv-org/database](https://github.com/iptv-org/database) repository. If you find any errors please open a new [issue](https://github.com/iptv-org/database/issues) there.

## API

The API documentation can be found in the [iptv-org/api](https://github.com/iptv-org/api) repository.

## Resources

Links to other useful IPTV-related resources can be found in the [iptv-org/awesome-iptv](https://github.com/iptv-org/awesome-iptv) repository.

## Discussions

If you have a question or idea, welcome to the [Discussions](https://github.com/orgs/iptv-org/discussions).

## Legal

No video files are stored in this repository. The repository simply contains user-submitted links to publicly available video stream URLs, which to the best of our knowledge have been intentionally made publicly by the copyright holders. If any links in these playlists infringe on your rights as a copyright holder, they may be removed by opening an [issue](https://github.com/iptv-org/iptv/issues/new?template=6_copyright-claim.yml). However, note that we have **no control** over the destination of the link, and just removing the link from the playlist will not remove its contents from the web. Note that linking does not directly infringe copyright because no copy is made on the site providing the link, and thus this is **not** a valid reason to send a DMCA notice to GitHub. To remove this content from the web, you should contact the web host that's actually hosting the content (**not** GitHub, nor the maintainers of this repository).
