# LANG-CARE (async) — audio to record

The study runs end-to-end **without** any of these files: on-screen text is the
source of truth and the affiliation melody is synthesized in the browser. Record
these only to add spoken narration on top. Filenames must match `LANGUAGES` /
`playClip()` in `experiment.js`.

## Speaker language clips (used in familiarization + the language manip-check)
Record each as a warm, child-directed greeting. Keep prosody/length matched.

| file | language | suggested line |
|------|----------|----------------|
| `english.mp3` | English (shared) | "Hello! Look at the little duck!" |
| `french.mp3`  | French (non-shared) | "Bonjour ! Regarde le petit canard !" |
| `hindi.mp3`   | Hindi (non-shared) | "Namaste! Dekho, chhoti si batakh!" |

Record **two voices** if you want the shared/non-shared speakers to sound like
different people; name them `english.mp3` and the non-shared ones above. (The
current code plays one clip per language.)

## Affiliation melody
Default = synthesized Twinkle-Twinkle melody (no file needed). If you'd rather
use real singing, set `CONFIG.SING_WORDS = true` and add:
- `sing_together.mp3` — the adult + non-shared speaker humming/la-la-ing Twinkle.
  **Hum or "la-la" the tune — do NOT sing words**, so the shared-song cue doesn't
  also leak a shared language.

## Design note
Keep the non-shared language **spoken** (greeting) distinct from the **sung**
melody. The melody is the friendship cue ("they know the same song"); the spoken
greeting is the language cue. Mixing them (e.g. singing French lyrics) confounds
the two manipulations.
