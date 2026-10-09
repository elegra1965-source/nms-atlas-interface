# ATLAS — NMS AI Interface

> *"All things tend toward Atlas."*

A voice-first, No Man's Sky–themed AI assistant. Speak to the Atlas — it speaks back.

## What's new in v4.3

- **Two tickers, always visible** — the expedition ticker and a new **ALLIANCES** ticker now run full width under the ATLAS title, so neither gets squeezed on phones. Tap either one to pause it.
- **Live alliance leaderboard** — the alliance ticker shows the top 10 Galactic Alliances (in-game rank, members, stations and 24-hour changes) and where your own logged alliances rank. Refreshed every 15 minutes. Leaderboard courtesy of [Voyager's Haven](https://havenmap.online), built by [u/IAmThe-Ekimo-1920](https://www.reddit.com/user/IAmThe-Ekimo-1920/). The switch is `HAVEN_ALLIANCE_FEED` at the top of the alliances ticker section in `js/widgets.js`; with it off, the ticker shows an alliance briefing instead.

## What's new in v4.2

- **Real worlds in the System Scan** — planets charted by players on Voyager's Haven (the same data as the NMS Weather app). The first scan each day is a featured world; tap ⟳ for another. Each shows the portal address, discoverer, and a **◈ SHOW ON GALACTIC MAP** link.
- **Galactic Alliances** — when an expedition ends, the countdown panel becomes an alliances briefing (Cosmos update) and switches back by itself when the next expedition starts. Tap **⇄** on that panel any time to flip between them.
- **Your alliances** — log up to three alliances (tag + name). They're stored only in your browser, and ATLAS knows who you fly with, in demo mode and with a key.
- **Scroll arrows on phones** — the tile strips show ◆› / ‹◆ arrows when there's more to see sideways; tap to jump a tile.

## What's new in v4.0

- **Faster replies** — ATLAS starts speaking as soon as the first sentence of an answer arrives, instead of waiting for the whole reply.
- **Long-term memory** — ATLAS remembers lasting things you tell it about yourself (name, platform, galaxy, base, ship, goals) across visits. See and edit it under **◈ MEMORY** (in the log bar, or the ⚙ settings). Stored only in your browser; export/import as a text file to move it between devices.
- **Welcome back** — returning Travellers are greeted by name with the live expedition.
- **Interrupt any time** — tap the mic (or hold the spacebar) while ATLAS talks to cut in; End Transmission now also stops the request behind it.
- **Hold-to-talk** — hold the spacebar to speak, release to send (desktop).
- **Sound-reactive orb** — the orb brightens and swells with the voice (real loudness with ElevenLabs, word-by-word with device voices, and with your words while listening).
- **Transmission log folds away** — the log is now a slim bar you can expand, so the glyph + English captions are never hidden behind it. On laptop-height screens it tucks itself away while ATLAS speaks.

## About

ATLAS is a **free, unofficial fan project**. The creator receives **no money whatsoever** — there are no ads, fees, donations, or tracking. ATLAS is not affiliated with or endorsed by Hello Games or Anthropic. No Man's Sky and all related imagery © Hello Games.

## How the AI works — open and honest

Almost everything here runs in your browser at no cost to anyone: the HUD, the orb, the live expedition ticker, the countdown, the planet scanner, the weather, and **demo mode** — where ATLAS answers from a built-in memory of No Man's Sky lore, spoken aloud, completely free, forever.

The one exception is the full AI brain. When you ask ATLAS a free-form question, the thinking doesn't happen in your browser — it happens on **Anthropic's servers**, and Anthropic charges for that computing the same way an electricity meter charges for power. That is why full conversation needs your own Anthropic API key. Creating the key at console.anthropic.com is free, but the API account is prepaid: you add a small credit there (even $5 lasts months) before the key works. Important: this Console balance is completely separate from a Claude.ai Pro/Max subscription — a subscription does not include API credit. Your key, your account, your control: a typical chat costs a penny or two, billed by Anthropic directly to you, and you can set spending limits or revoke the key there at any time. Nothing passes through — or to — the creator of ATLAS.

No key? No problem. ATLAS simply stays in demo mode. The choice is entirely yours.

## Quick start

1. Host the folder anywhere (Netlify drag-and-drop works — zip the contents and drop on app.netlify.com). **Voice features require HTTPS**, so opening index.html directly from disk gives you typed chat only.
2. Open the site. Enter your Anthropic API key (from console.anthropic.com) when prompted. It is stored only in your browser's localStorage and sent only to Anthropic.
3. Tap the mic button and speak, or type and press Enter. ATLAS replies in text and voice.

## Controls

- **Mic button** — tap to start listening, tap again to stop
- **◉) Wake word** — arm it and just say "Atlas" to activate the mic, no tapping (experimental; keeps the microphone armed and uses your browser's speech service; best in Chrome/Edge on desktop)
- **∞ Continuous mode** — ATLAS re-opens the mic after each reply for flowing conversation
- **Hold spacebar** — talk while held, release to send (desktop); **double-tap** still opens the mic
- **Tap the mic while ATLAS talks** — interrupts it and listens straight away
- **▲ Transmission log** — tap the bar to expand or fold the log
- **◈ Memory** — view, add, remove, export or import what ATLAS remembers about you
- **Enter / ▶** — send typed message
- **⚙ (top right)** — change API key

## Getting a natural voice

Built-in voices vary hugely by browser. For the best **free** sound, open ATLAS in **Microsoft Edge** and pick a voice with "Natural" in its name (e.g. Sonia or Ryan, UK) — these are neural voices and sound close to human. In Chrome, the "Google UK English" voices are the smoothest. For an **ultra-natural** voice, create a free account at elevenlabs.io, copy your API key into the optional ElevenLabs field in the ⚙ settings, and ATLAS speaks with a deep, lifelike British voice (free tier ≈ 10 minutes of speech per month; if the quota runs out ATLAS quietly falls back to your device voice).

## Browser support

Voice input uses the Web Speech API — best in **Chrome** and **Edge** (desktop and Android). Firefox has no speech recognition; typing still works everywhere. Voice output works in all modern browsers.

The wrap-around spherical orb uses a modern browser feature (`ImageDecoder`). Browsers without it — Firefox and older Safari — automatically show a simpler flat chamber instead; everything else works the same.

## Fonts

The interface ships with Orbitron (Google Fonts) as the NMS-style heading font. To use the real NMS GeoNMS font, download it from `github.com/NMSCD/No-Mans-Sky-Universal-Font` and drop `GeoNMS.woff2` (or `GeoNMS.otf`) into `assets/fonts/` — the CSS picks it up automatically, no code changes needed.

## PWA / Android APK

The app is a full PWA: installable from the browser, offline UI (AI calls need internet). To build an APK, point **PWABuilder** (pwabuilder.com) at your deployed Netlify URL — same pipeline as the NMS Theme Pack.

## Files

- `index.html` — app shell
- `css/` — main layout, orb states, panels, mobile overrides
- `js/` — atlas.js (core), voice.js (speech), api.js (Claude), memory.js (long-term memory), pulse.js (sound-reactive orb), widgets.js (weather/clock/lore), hud.js (orb state machine)
- `assets/` — Atlas orb GIF, spaceport background, icons, 56 NMS lore facts
- `manifest.json`, `sw.js` — PWA install + offline cache

## Expedition ticker

The header shows a scrolling live feed of the current expedition's progress (tier, completion %, faction standings, time remaining), pulled from the official Galactic Atlas API. On Netlify the included `_redirects` file proxies the API (required for CORS); elsewhere it falls back to a public CORS proxy, and offline it shows a static countdown. The ticker finds a new expedition by itself (it checks the next mission numbers every few minutes), and ATLAS's spoken answers about "the expedition" — in demo mode and with a key — read from the same live data, so they move on automatically too. The feed gives progress numbers but not names or dates, so ATLAS also reads the community wiki's [List of Expeditions](https://nomanssky.fandom.com/wiki/List_of_Expeditions) table (number, name, start, end) straight from the browser, re-checked every 3 hours and immediately when a new mission appears. A new expedition picks up its real name and dates automatically — no code edit. Only in the short gap before the wiki lists a new expedition does it show as "GALACTIC MISSION #N".

The same wiki table also powers questions about **any** expedition, past, current or next, with no API key: tap **EXPEDITION STATUS**, or ask things like "what was the previous expedition?", "tell me about expedition 12", "the Adrift expedition", "how many expeditions have there been?" or "when is the next expedition?". With a key, Claude is also given the six most recent expeditions with their dates.

## Alliance ticker

Under the expedition ticker. Data comes from Voyager's Haven's public alliance endpoint (`havenmap.online/api/public/alliances`). It doesn't send CORS headers, so `_redirects` proxies it at `/haven-api/alliances`, the same way the expedition feed is proxied at `/nms-api/`. If the feed is unreachable, the ticker falls back to the alliance briefing and your own alliances. Thanks to [u/IAmThe-Ekimo-1920](https://www.reddit.com/user/IAmThe-Ekimo-1920/) for Voyager's Haven.

## Conversation memory

The last 20 exchanges persist in localStorage and reload on next visit; **⌫ PURGE** clears them.

Long-term memory (v4.0) is separate: short facts about you in `atlas_memory`, plus your name in `atlas_traveller_name`, also localStorage only. With an API key, after a message where you talk about yourself, ATLAS makes one tiny extra request to the cheapest Claude model to decide whether anything is worth remembering (a fraction of a penny). In demo mode it picks up a few simple phrases ("my name is…", "I play on PS5"). **◈ MEMORY → FORGET ALL** wipes it.

---
*ATLAS is a fan project. No Man's Sky is the property of Hello Games.*
