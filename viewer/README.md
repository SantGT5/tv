# Playlist viewer

A local browser UI for the playlists in [`streams/`](../streams). No dependencies — it runs on Node built-ins only.

```sh
npm run viewer          # http://127.0.0.1:4321
PORT=8080 npm run viewer
```

Every file is grouped by the country code in its name (`br.m3u` → Brazil, `us_pluto.m3u` → United States / `pluto` playlist).

## What it does

- **Countries sidebar** with flag, name and channel count; playlists with a suffix (`ca_stingray.m3u`) stay under their country and can be picked in the *All playlists* filter.
- **Open ↗** opens the stream URL in a new tab — nothing is played in the page itself.
- **Update lists** runs `playlist:format`, `playlist:lint` and `playlist:validate` in sequence, streams their output live into a log window, stops at the first failure, and reloads the library when done.
- **Search** (`/` focuses it) across channel names, `tvg-id`s, URLs and filenames; every term must match.
- **Filters**: playlist file, category, quality, 24/7 only, hide geo-blocked, hide NSFW. Sort by name, quality or country.
- **Check** asks the server to fetch a stream and reports `online <ms>`, the HTTP status, or `timeout`. *Check streams* runs the same test over the visible rows, 8 at a time.
- **Favorites** (★) are kept in `localStorage` and get their own sidebar entry.
- **Export .m3u** downloads the current filtered selection as a valid playlist, `#EXTVLCOPT` headers included.
- **Raw** opens the underlying `.m3u` file, **Copy** copies a stream URL.
- Dark/light theme toggle, remembered between visits.

## Optional metadata

Channel logos, categories and NSFW flags come from `temp/data/*.json`, produced by `npm run api:load`. Without those files the viewer still works — country names fall back to `Intl.DisplayNames`, and rows show a flag instead of a logo.

## Layout

| File | Role |
| --- | --- |
| [server.mjs](server.mjs) | static server, playlist parsing, `/api/library`, `/api/raw`, `/api/check`, `/api/update` |
| [public/index.html](public/index.html) | markup |
| [public/app.js](public/app.js) | filtering, rendering, update log, stream checks |
| [public/styles.css](public/styles.css) | theme and layout |

The server binds to `127.0.0.1` only.
