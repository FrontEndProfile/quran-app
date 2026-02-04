# Quran Urdu Player (Minimal)

A minimal Quran web app that plays Arabic recitation and Urdu translation **verse-by-verse**:
1) Arabic recitation audio
2) Urdu translation audio
3) Auto-advance to the next ayah

Includes Surah and Juz playback, Urdu translation text, and a clean UI.

## Features
- Surah and Juz lists with Play buttons
- Sequential verse playback: Arabic → Urdu audio → next ayah
- Play/Pause, Next, Prev, Stop
- Reciter dropdown (Arabic)
- Urdu translation audio dropdown
- Urdu translation text dropdown
- Arabic/Urdu font size controls
- Warm theme + dark toggle
- Current ayah highlight + auto-scroll

## Tech
- Vite + TypeScript (vanilla)
- Quran text + translations: QuranFoundation Quran.com API v4
- Audio: EveryAyah

## Run locally
```bash
npm install
npm run dev
```

## Audio sources
Defined in `src/constants.ts`.
- Add a new Arabic reciter by appending to `ARABIC_RECITERS`.
- Add a new Urdu translation audio source by appending to `URDU_AUDIO_SOURCES`.

## Notes
- Audio filenames follow `{surah:3}{ayah:3}.mp3` (e.g., 001001.mp3).
- Missing Arabic audio: app skips to Urdu audio.
- Missing Urdu audio: app shows text only and advances after a short delay.
- API responses are cached in-memory to avoid refetching.

## Known limitations
- Some browsers require a user gesture before audio can start.
- Audio availability can vary by source.
- Verify audio redistribution/embedding rights before publishing.
