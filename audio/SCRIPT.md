# LANG-CARE (async) — audio to generate (ElevenLabs)

The manipulation is **accent**, not language: both speakers say the **same English
sentence**, one in an American accent, one in a different accent. Generate the two
clips in ElevenLabs and drop them in this folder with the exact filenames below
(they're referenced by `ACCENTS` in `experiment.js`).

There are **4 neutral phrases**, each recorded in **both accents** = **8 clips**.
The phrases are deliberately neutral descriptive filler (not social, not about the
child, nothing a kid could call "right"/"wrong"), so only the ACCENT can drive the
friend choice. They're dealt randomly across the four speaker slots per child, so
phrase content is fully counterbalanced against accent/side/condition. (Edit the
`PHRASES` array in `experiment.js` to change wording.)

| # | phrase |
|---|--------|
| 1 | "The weather is so nice today. It is warm and sunny, and there are big fluffy clouds in the sky." |
| 2 | "The beach is a place with lots of sand and water. The waves roll in and out all day long." |
| 3 | "Apples grow on tall trees in the summer. Some of the apples are red and some of them are green." |
| 4 | "At night the sky gets very dark. You can see the bright moon and lots of tiny twinkly stars." |

Record each phrase twice and name the files `<accent>_<#>.mp3`:

| file | phrase | accent |
|------|--------|--------|
| `native_1.mp3` … `native_4.mp3`   | phrases 1–4 | American English |
| `foreign_1.mp3` … `foreign_4.mp3` | phrases 1–4 | a clearly different accent (British, French-/Indian-accented English, …) |

Keep the two accents matched on pace/length/tone for each phrase — accent should be
the only difference. Use the **same foreign voice** for all four `foreign_*` clips
(and one American voice for all `native_*`), so the accent is a stable property of
"that speaker," not a per-clip artifact.

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
