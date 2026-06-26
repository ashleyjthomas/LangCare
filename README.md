# LANG-CARE (asynchronous)

**Can Caregiver Affiliation Influence Language Bias?** — a self-paced, self-hosted
adaptation of the synchronous LANG-CARE Study 2. No live experimenter: a parent
and their 4–5 year old play through a jsPsych game in the browser.

## The idea
Two characters appear. One speaks the child's language (**English = shared**), one
speaks a **non-shared** language (French or Hindi). An **adult in the middle** is
shown to be friends with the non-shared speaker (they *sing the same song* — the
affiliation cue) and not with the shared speaker. Within-subjects, that adult is
either the child's **own caregiver** (a webcam photo we take) or a **stranger**
(another consenting parent's photo, yoked). DV: *"Whom would you like as your
friend?"* + *"Why?"* + a guess at how many languages each speaker knows.

## Run it
Static site — serve the folder and open `index.html`:

```bash
cd LangCare
python3 -m http.server 8000     # then open http://localhost:8000
```

Camera capture needs `https://` or `localhost` (browsers block `getUserMedia`
on `file://`). For data saving + the yoked stranger bank, also run the stub:

```bash
node server/server.js           # http://localhost:8080
```

and set `SAVE_URL` / `STRANGER_BANK` in the `CONFIG` block at the top of
`experiment.js`. With both blank, the study still runs: it uses a placeholder
stranger and downloads the data as a JSON file at the end.

## Sharing / hosting on GitHub Pages
This is a static site, so GitHub Pages can host it for free over **HTTPS** — which
the webcam capture *requires* (`getUserMedia` is blocked on plain `http://`).

1. Push this folder to a GitHub repo (see below).
2. Repo **Settings → Pages → Build and deployment → Source: "Deploy from a branch"**,
   branch `main`, folder `/ (root)`. The study goes live at
   `https://<user>.github.io/<repo>/` in a minute or two.

**Important — Pages is static-only.** `server/server.js` (data saving + the yoked
stranger bank) cannot run on Pages. On Pages, with the default blank `CONFIG`:
- each participant's data **downloads as a JSON file** on their own machine (no
  central collection), and
- the stranger is the bundled placeholder (`img/stranger.svg`), not a real yoked photo.

For real central data collection + the photo bank, point `SAVE_URL` / `STRANGER_BANK`
at a separate always-on host (e.g. a small Node service running `server/server.js` on
Harvard-managed computing per IRB23-0780). Pages serves the front end; that host
stores the data.

## How it maps to the pre-reg
| Pre-reg element | Here |
|---|---|
| Puppet speakers (control race/age/gender) | **Placeholder animated faces** (inline SVG). *Swap for real stimuli later — see note below.* |
| Adult edited into the middle | **Parent's webcam photo** (caregiver) / **yoked bank photo** (stranger) |
| Adult affiliates with non-shared speaker | **They sing Twinkle-Twinkle together** (synthesized melody); adult says "Hmph!" to the shared speaker |
| Language + adult manipulation checks | Kept (language check allows 2 retries) |
| DV: friend choice / why / #languages | Kept |
| Counterbalancing | Condition order, familiarization order (constant within child), non-shared language, color pair, English-speaker side — all sampled per child |
| Constants | Left actor acts first; adult always affiliates with the non-shared speaker |

## Open design decisions (flagged, not resolved)
- **Faces vs puppets.** The original used puppets *specifically* to strip out
  race/age/gender as affiliation cues. Placeholder SVG faces are neutral, but real
  human-face stimuli would reintroduce those cues. Decide deliberately before
  recording real footage.
- **Singing without leaking language.** "They know the same song" is the friendship
  cue; the spoken greeting is the language cue. Keep the melody **hummed/la-la**
  (default) so a shared song doesn't also imply a shared language. `CONFIG.SING_WORDS`
  toggles lyric audio if you decide otherwise.
- **Yoked stranger in async.** Without a live experimenter we can't hand-pick a
  yoked caregiver. Parents opt in (checkbox) to contribute their photo to a bank;
  the next child draws a random other-parent photo. The pre-reg's
  "do you recognize this adult?" check can't run live — consider a post-hoc
  recognition question.

## Files
- `index.html` — loads jsPsych 7.3.4 + plugins, styling
- `experiment.js` — all study logic (custom photo plugin, scene engine, melody, timeline)
- `img/` — placeholder adult images (real faces are generated inline in JS)
- `audio/SCRIPT.md` — optional narration to record
- `server/server.js` — dev stub for data saving + stranger bank
