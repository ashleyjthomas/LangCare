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
on `file://`), so the python server (or GitHub Pages) is fine; opening the file
directly is not. With a blank `CONFIG`, the study downloads each child's data as a
JSON file locally — good for testing.

## Data: Google Sheet (works on GitHub Pages)
Data goes straight to a Google Sheet via a Google Apps Script web app — a
client-side POST, so **no server is needed** and it works on GitHub Pages.

1. New Google Sheet → **Extensions → Apps Script** → paste `scripts/apps_script.gs` → Save.
2. **Deploy → New deployment → Web app**, *Execute as: Me*, *Who has access: Anyone*.
3. Copy the `…/exec` URL into `CONFIG.SHEETS_WEBHOOK` at the top of `experiment.js`.

Each child writes **two rows** (one per condition: caregiver, stranger) in
`CSV_COLS` order — the grain the pre-reg's `chose_shared ~ condition + (1|participant)`
model wants. With `SHEETS_WEBHOOK` blank, it falls back to the local JSON download.
(`server/server.js` is just an optional local dev alternative; you don't need it
for the Sheet.)

## Sharing / hosting on GitHub Pages
This is a static site, so GitHub Pages hosts it free over **HTTPS** — which the
webcam capture *requires* (and which makes the Google-Sheet POST work). The camera
works fine for parents on Pages.

1. Push this folder to a GitHub repo (see below).
2. Repo **Settings → Pages → Source: "Deploy from a branch"**, branch `main`,
   folder `/ (root)`. Live at `https://<user>.github.io/<repo>/` in a minute or two.

**One limitation:** the yoked **stranger photo bank** needs a server, which Pages
can't run, so on Pages every child sees the placeholder stranger (`img/stranger.svg`).
Data collection (the Sheet) is unaffected. A real yoked bank would need a separate
host (e.g. extend the Apps Script to store photos in Drive, or a small Node service
on Harvard-managed computing per IRB23-0780).

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
