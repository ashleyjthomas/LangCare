# LANG-CARE (async) — speaker audio

The speaker clips in this folder are **generated with ElevenLabs** (text-to-speech),
not recorded by hand. There are **4 neutral phrases × 5 voices = 20 clips**, named
`audio/<voice>_<phrase#>.mp3`.

## Voices
Every voice records all 4 phrases, so a voice is picked at random per speaker and
the phrase is assigned independently (full phrase × voice counterbalancing). The
foreign-accent voice is matched to the face pair's ethnicity.

| label | role | ElevenLabs voice id | used for |
|-------|------|---------------------|----------|
| `na1` | native (American) | qBDvhofpxp92JgXJxDjB | either pair |
| `na2` | native (American) | qSeXEcewz7tA0Q0qk9fH | either pair |
| `la1` | foreign accent | k6aNMn2EN3T8vpJSBhQw | **Latina** pair |
| `la2` | foreign accent | 5GR0JTHRVmv00OeaRI9u | **Latina** pair |
| `as1` | foreign accent | Zjb2Dbq5IbWDKpVOllIo | **Asian** pair |

TODO: a **second distinct Asian voice** (`as2`) — the two Asian ids supplied were
identical, so only `as1` exists. Add the id to `VOICES.foreign.asian` in
`experiment.js`, generate `as2_1.mp3 … as2_4.mp3`, done.

## The 4 phrases
Neutral descriptive filler (not social, not about the child, nothing judgeable),
matched in length (~60 words). Defined in `PHRASES` in `experiment.js`.

1. weather · 2. beach · 3. apples · 4. night

## Regenerating
Audio is generated from the `PHRASES` text + voice ids above, model
`eleven_multilingual_v2`, via the ElevenLabs TTS API
(`POST /v1/text-to-speech/<voice_id>`). To regenerate (e.g. after editing a phrase
or adding `as2`): re-run the generation with your **own** ElevenLabs API key
(don't commit the key). The clips were produced one per `(voice, phrase)` and saved
as `audio/<label>_<n>.mp3`.

## Affiliation melody
The "they know the same song" cue is still a synthesized Twinkle-Twinkle melody
(no file needed).
