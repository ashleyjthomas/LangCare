# LANG-CARE (async) — audio to generate (ElevenLabs)

The manipulation is **accent**, not language: both speakers say the **same English
sentence**, one in an American accent, one in a different accent. Generate the two
clips in ElevenLabs and drop them in this folder with the exact filenames below
(they're referenced by `ACCENTS` in `experiment.js`).

Both clips use this exact line. It's deliberately **neutral descriptive filler** —
not social, not about the child, nothing a kid could call "right" or "wrong" — so
only the ACCENT can drive the friend choice. (Edit `SPEAKER_LINE` in
`experiment.js` to change it.)

> "The weather is so nice today. It is warm and sunny, and there are big fluffy clouds up in the sky."

| file | accent |
|------|--------|
| `native.mp3`  | American English |
| `foreign.mp3` | a clearly different accent (e.g. British, French-accented, Indian-accented English…) |

Keep everything except accent matched: same words, similar pace, similar warm
child-directed tone, similar pitch/length. The point is that **accent is the only
difference** between the two voices.

## ElevenLabs tips
- Use the **same sentence** for both; pick two voices that differ in accent.
- A voice's accent is a property of the voice — browse the Voice Library and filter
  by accent, or use voices labeled with the accent you want.
- Export as MP3, name them exactly `native.mp3` / `foreign.mp3`, put them here.

## After adding audio
Set `CONFIG.SHOW_ACCENT_LABEL = false` in `experiment.js`. While it's `true`, the
accent is printed on screen as a caption so the study is testable without audio;
once real audio plays, you don't want to also reveal the accent in text.

## Optional: more than one accent / sentence
If you later want multiple foreign accents (counterbalanced) or multiple sentences,
extend `ACCENTS` in `experiment.js` and add the matching files here.

## Affiliation melody (unchanged)
The "they know the same song" cue is a synthesized Twinkle-Twinkle melody (no file
needed). To use real singing instead, set `CONFIG.SING_WORDS = true` and add
`sing_together.mp3` — **hum/la-la the tune, don't sing words**, so the shared-song
cue doesn't leak a shared language/accent.
