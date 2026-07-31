# IPTV [![update](https://github.com/iptv-org/iptv/actions/workflows/update.yml/badge.svg)](https://github.com/iptv-org/iptv/actions/workflows/update.yml)

Collection of publicly available IPTV (Internet Protocol television) channels from all over the world.

## Table of contents

- 🚀 [How to use?](#how-to-use)
- 📺 [Playlists](#playlists)
- 🖥 [Playlist viewer](#playlist-viewer)
- 🗓 [EPG](#epg)
- 🗄 [Database](#database)
- 👨‍💻 [API](#api)
- 🧰 [Scripts](#scripts)
- 📚 [Resources](#resources)
- 💬 [Discussions](#discussions)
- ❓ [FAQ](#faq)
- 🛠 [Contribution](#contribution)
- ⚖ [Legal](#legal)
- © [License](#license)

## How to use?

Simply paste the link to one of the playlists into [any video player](https://github.com/iptv-org/awesome-iptv#apps) that supports live streaming and press _Open_.

![VLC Network Panel](https://github.com/iptv-org/iptv/raw/master/.readme/preview.png)

## Playlists

The main playlist containing all channels available in the repository can be found at:

```
https://iptv-org.github.io/iptv/index.m3u
```

Links to other playlists can be found in the [PLAYLISTS.md](PLAYLISTS.md) file.

The source playlists themselves live in [streams/](streams/), one file per country (`br.m3u`), plus provider-specific files where needed (`us_pluto.m3u`). See [Playlist Structure](.github/docs/playlist-structure.md).

## Playlist viewer

A local browser UI for browsing, filtering and checking the playlists in [streams/](streams/). It has no dependencies beyond Node built-ins and binds to `127.0.0.1` only.

```sh
npm install
npm run viewer          # http://127.0.0.1:4321
PORT=8080 npm run viewer
```

It groups every file by the country code in its name, supports search and filters (category, quality, 24/7, geo-blocked, NSFW), can test whether a stream is online, export the current selection as an `.m3u`, and run the format/lint/validate pipeline with live output. Full details in [viewer/README.md](viewer/README.md).

## EPG

[Electronic Program Guide](https://en.wikipedia.org/wiki/Electronic_program_guide) for most of the channels can be downloaded using utilities published in the [iptv-org/epg](https://github.com/iptv-org/epg) repository.

## Database

All channel data is taken from the [iptv-org/database](https://github.com/iptv-org/database) repository. If you find any errors please open a new [issue](https://github.com/iptv-org/database/issues) there.

## API

The API documentation can be found in the [iptv-org/api](https://github.com/iptv-org/api) repository.

## Scripts

The repository is maintained with a set of scripts in [scripts/](scripts/), run via `npm run`:

| Command | Description |
| --- | --- |
| `api:load` | Download the channel data from the API into `temp/data/` (also runs on `postinstall`) |
| `playlist:format` | Normalize the playlists in `streams/` |
| `playlist:lint` | Check the playlists against `m3u-linter.json` |
| `playlist:validate` | Validate stream IDs and links against the database |
| `playlist:test` | Test whether the stream links are still working |
| `playlist:edit` | Interactively edit a playlist |
| `playlist:update` | Apply approved issues to the playlists |
| `playlist:generate` | Generate the public playlists into `.gh-pages/` |
| `playlist:export` | Export the streams as a single dataset |
| `readme:update` | Regenerate `PLAYLISTS.md` from the `.readme/template.md` template |
| `report:create` | Create a report on the current state of the repository |
| `lint` | Run ESLint over `scripts/` and `tests/` |
| `test` | Run the Jest test suites in [tests/](tests/) |

See [Scripts](.github/docs/scripts.md) for more.

## Resources

Links to other useful IPTV-related resources can be found in the [iptv-org/awesome-iptv](https://github.com/iptv-org/awesome-iptv) repository.

## Discussions

If you have a question or idea, welcome to the [Discussions](https://github.com/orgs/iptv-org/discussions).

## FAQ

The answers to the most popular questions can be found in the [FAQ.md](FAQ.md) file.

## Contribution

Please make sure to read the [Contributing Guide](CONTRIBUTING.md) before sending an issue or making a pull request.

And thank you to everyone who has already contributed!

### Backers

<a href="https://opencollective.com/iptv-org"><img src="https://opencollective.com/iptv-org/backers.svg?width=890" /></a>

### Contributors

<a href="https://github.com/iptv-org/iptv/graphs/contributors"><img src="https://opencollective.com/iptv-org/contributors.svg?width=890" /></a>

## Legal

No video files are stored in this repository. The repository simply contains user-submitted links to publicly available video stream URLs, which to the best of our knowledge have been intentionally made publicly by the copyright holders. If any links in these playlists infringe on your rights as a copyright holder, they may be removed by opening an [issue](https://github.com/iptv-org/iptv/issues/new?template=6_copyright-claim.yml). However, note that we have **no control** over the destination of the link, and just removing the link from the playlist will not remove its contents from the web. Note that linking does not directly infringe copyright because no copy is made on the site providing the link, and thus this is **not** a valid reason to send a DMCA notice to GitHub. To remove this content from the web, you should contact the web host that's actually hosting the content (**not** GitHub, nor the maintainers of this repository).

## License

[![CC0](http://mirrors.creativecommons.org/presskit/buttons/88x31/svg/cc-zero.svg)](LICENSE)
