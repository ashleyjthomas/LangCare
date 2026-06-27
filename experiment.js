/* =============================================================
   LANG-CARE (asynchronous adaptation)
   "Can Caregiver Affiliation Influence ACCENT Bias?"

   Adapts the synchronous LANG-CARE Study 2 (4–5 yo monolingual
   English children; within-subjects caregiver vs. stranger) into a
   self-paced, self-hosted jsPsych study with NO live experimenter.

   THIS VERSION
     - Speakers are REAL human faces from the Chicago Face Database
       (women only, for now): two matched pairs —
         Asian:  AF-218 / AF-235
         Latina: LF-203 / LF-229
       Each trial uses one matched pair (faces matched on the CFD
       norming dimensions, so the only difference is the accent).
     - The manipulation is ACCENT, not language: both speakers say the
       SAME English sentence; one in an American accent ("native"), one
       in a different accent ("foreign"). Accent audio is generated with
       ElevenLabs and dropped into audio/ (see audio/SCRIPT.md). Until
       then, CONFIG.SHOW_ACCENT_LABEL prints the accent as a caption so
       the flow is testable.
     - The adult in the middle (parent's webcam photo = caregiver, or a
       yoked bank photo = stranger) AFFILIATES with the foreign-accent
       speaker (they "know the same song" and sing together) and rejects
       the native-accent speaker.
     - Manipulation checks (accent + adult-liking) and the DV
       ("Whom would you like as your friend?" + "Why?"). Children answer
       by tapping the FACE itself (image buttons) — no color labels.

   COUNTERBALANCING (sampled per child)
     - condition order (caregiver vs stranger first)
     - familiarization order (accent-first vs adult-first; constant within child)
     - which face pair goes with which condition (Asian vs Latina first)
     - which face in a pair is the foreign-accent speaker
     - side of the native-accent speaker
   CONSTANTS: left face acts first; the adult always affiliates the
   foreign-accent speaker.

   CFD NOTE: the face images live in img/faces/ and are git-ignored until
   the Chicago Face Database license is confirmed to allow public hosting.
   ============================================================= */

/* ===================================================================
   0. CONFIG
   =================================================================== */
const CONFIG = {
  // Google Apps Script web-app URL (deploy scripts/apps_script.gs, paste /exec here).
  // Works from GitHub Pages — no server. Leave "" to download a JSON file instead.
  SHEETS_WEBHOOK: "https://script.google.com/macros/s/AKfycbwR5Khiv4okuLmUGdNde5RhKXTkT6NHUUGu0S4ThcgofPIe1vChpzmP7QkrLCNy3iPzAg/exec",
  // Yoked stranger photo bank endpoint (see loadStrangerPhoto). Leave "" to use
  // the bundled placeholder (GitHub Pages can't run a bank server).
  STRANGER_BANK: "",
  // Show the accent as an on-screen caption (for testing WITHOUT audio). Now that
  // real ElevenLabs audio is in audio/, this is off — the accent is heard, not shown.
  SHOW_ACCENT_LABEL: false,
  SING_WORDS: false,            // false = hum the melody (affiliation cue)
  MAX_CHECK_REPEATS: 2,         // pre-reg: 2 repetitions before exclusion flag
};

// One row per CONDITION (2 rows per child) — the grain the brms model wants
// (choseNative ~ condition + (1|participant)). Shared by the Sheet + JSON export.
const CSV_COLS = [
  "participantId", "timestamp",
  "ageMonths", "childGender", "langExposure", "consentPhotoReuse", "closePersonRelation",
  "cbCaregiverFirst", "cbFamOrder", "cbAsianFirst",
  "condition", "conditionPosition", "famOrder",
  "pairKey", "nativeSide", "nativeFace", "foreignFace", "nativePhrase", "foreignPhrase",
  "nativeVoice", "foreignVoice",
  "prefAccentFace", "prefAccentChoseNative",    // preference after the accent portion
  "prefAffilFace", "prefAffilChoseNative",      // preference after the affiliation portion
  "prefFinalFace", "prefFinalChoseNative", "prefFinalWhy",  // condition-final preference + why
  "attnAccentCorrect", "attnAffilCorrect",      // end-of-condition attention checks
  "finalAll4Face", "finalAll4Role", "finalAll4Condition",  // final all-four preference (same on both rows)
];

/* ===================================================================
   1. STIMULUS CONTENT — faces + accents
   =================================================================== */
// Matched women pairs (Chicago Face Database). Each trial uses ONE pair.
const FACE_PAIRS = [
  { key: "asian",  faces: ["AF-218", "AF-235"] },
  { key: "latina", faces: ["LF-203", "LF-229"] },
];
const faceImg = (id) => `img/faces/${id}.jpg?v=2`;  // bump ?v= when face images change (cache-bust)

// FOUR neutral, descriptive phrases — not social, not about the child, nothing a
// kid could call "right" or "wrong" — so only the ACCENT can drive the friend
// choice. Matched in length/complexity. Each is recorded in BOTH accents and the
// four are dealt randomly across the four speaker slots per child, so phrase
// content is fully counterbalanced against accent / side / condition.
const PHRASES = [
  { id: "weather", text: "The weather is so nice today. It is warm and sunny outside, and there are big fluffy clouds up in the sky. Sometimes the wind blows softly and pushes the clouds along. In the morning the air feels cool, and by the afternoon it gets a little warmer. On days like this, the sky stays bright and blue for a very long time." },
  { id: "beach",   text: "The beach is a place with lots of sand and water. The waves roll in and out all day long, and they make a soft splashing sound. Tiny shells and smooth little stones are spread out across the sand. Near the water the ground feels cool and wet, and farther back the sand is warm and dry from the sun." },
  { id: "apples",  text: "Apples grow on tall trees in the summer. Some of the apples are red, some of them are green, and a few of them are yellow. The trees have wide green leaves and rough brown branches. When the apples are ready to pick, they hang down low, and they feel round and smooth and a little bit heavy." },
  { id: "night",   text: "At night the sky gets very dark. You can see the bright moon and lots of tiny twinkly stars spread all across the sky. Some nights the moon looks round and full, and on other nights it looks like a thin curved line. When everything is quiet, the air turns cool and the whole world looks calm and still." },
];
const ACCENTS = {
  native:  { key: "native",  label: "American accent" },
  foreign: { key: "foreign", label: "a different accent" },
};
// ElevenLabs voices (generated by scripts; see audio/SCRIPT.md). Native = American
// accent; the foreign voice is matched to the face pair's ethnicity. EVERY voice
// recorded ALL 4 phrases, so a voice is picked at random per speaker and the
// phrase is assigned independently. Files: audio/<voice>_<phrase#>.mp3.
const VOICES = {
  native: ["na1", "na2"],                              // American accent (either pair)
  foreign: { latina: ["la1", "la2"], asian: ["as1"] }, // ethnicity-matched foreign accent
};
const audioFor = (voiceLabel, phraseIdx) => `audio/${voiceLabel}_${phraseIdx + 1}.mp3`;
const pickVoice = (arr) => jsPsych.randomization.sampleWithoutReplacement(arr, 1)[0];

/* ===================================================================
   2. CUSTOM PLUGIN: webcam still-photo capture  (unchanged)
   =================================================================== */
class AdultPhotoPlugin {
  static info = {
    name: "adult-photo",
    parameters: {
      prompt:    { type: "HTML_STRING", default: "" },
      narration: { type: "STRING", default: "" },   // narration clip played on load
    },
  };
  constructor(jsPsych) { this.jsPsych = jsPsych; }

  trial(display_element, trial) {
    display_element.innerHTML = `
      <div id="lc-cam-wrap">
        <div class="lc-prompt">${trial.prompt}</div>
        <div id="lc-photo-choices">
          <label for="lc-file" class="jspsych-btn">📁 Upload a photo</label>
          <input id="lc-file" type="file" accept="image/*" class="lc-hidden">
          <button id="lc-self" class="jspsych-btn secondary">📸 Take a picture of myself instead</button>
        </div>
        <video id="lc-video" class="lc-hidden" autoplay playsinline></video>
        <canvas id="lc-canvas" class="lc-hidden" width="640" height="480"></canvas>
        <div id="lc-crop-hint" class="lc-prompt lc-hidden">Drag the box to crop to just the person's face.</div>
        <img id="lc-preview" class="lc-hidden" alt="chosen photo">
        <div id="lc-cam-controls" class="lc-hidden">
          <button id="lc-snap"   class="jspsych-btn lc-hidden">📸 Take picture</button>
          <button id="lc-retake" class="jspsych-btn secondary">↺ Start over</button>
          <button id="lc-accept" class="jspsych-btn lc-hidden">✓ Use this photo</button>
        </div>
        <div id="lc-cam-err" style="color:var(--bad);font-size:16px;"></div>
      </div>`;

    const $ = (s) => display_element.querySelector(s);
    const choices = $("#lc-photo-choices"), fileIn = $("#lc-file"), selfB = $("#lc-self");
    const video = $("#lc-video"), canvas = $("#lc-canvas"), ctx = canvas.getContext("2d");
    const preview = $("#lc-preview"), controls = $("#lc-cam-controls");
    const snapB = $("#lc-snap"), retakeB = $("#lc-retake"), acceptB = $("#lc-accept");
    const errEl = $("#lc-cam-err"), cropHint = $("#lc-crop-hint");
    let stream = null, source = null, cropper = null;
    const show = (el) => el.classList.remove("lc-hidden");
    const hide = (el) => el.classList.add("lc-hidden");
    const stopStream = () => { if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; } };

    if (trial.narration) playClip(trial.narration);

    // Show the chosen image in a square cropper so the parent can frame the face.
    const showPreview = (url) => {
      hide(choices); hide(video); hide(snapB);
      show(cropHint); show(preview); show(controls); show(acceptB);
      preview.onload = () => {
        if (cropper) cropper.destroy();
        cropper = new Cropper(preview, {
          aspectRatio: 1, viewMode: 1, autoCropArea: 0.85,
          background: false, dragMode: "move", guides: false,
        });
      };
      preview.src = url;
    };

    // Upload path
    fileIn.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = () => { source = "upload"; showPreview(reader.result); };
      reader.readAsDataURL(file);
    });

    // Self-capture path
    selfB.addEventListener("click", () => {
      hide(choices); show(video); show(controls); show(snapB);
      navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false })
        .then((s) => { stream = s; video.srcObject = s; })
        .catch((e) => { errEl.textContent =
          "We couldn't access your camera. Please allow it and try again, or upload a photo instead. (" + e.name + ")"; });
    });
    snapB.addEventListener("click", () => {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      source = "self"; stopStream();
      showPreview(canvas.toDataURL("image/jpeg", 0.85));
    });

    retakeB.addEventListener("click", () => {
      if (cropper) { cropper.destroy(); cropper = null; }
      stopStream(); source = null; errEl.textContent = "";
      hide(cropHint); hide(preview); hide(video); hide(snapB); hide(controls);
      show(choices); fileIn.value = "";
    });
    acceptB.addEventListener("click", () => {
      if (!cropper) return;
      const canvas = cropper.getCroppedCanvas({ width: 512, height: 512, imageSmoothingQuality: "high" });
      const out = canvas ? canvas.toDataURL("image/jpeg", 0.88) : null;
      cropper.destroy(); cropper = null; stopStream();
      if (!out) return;
      PARTICIPANT.caregiverPhoto = out;
      display_element.innerHTML = "";
      this.jsPsych.finishTrial({ photo_captured: true, photo_source: source });
    });
  }
}

/* ===================================================================
   3. SCENE RENDERING — real face photos
   =================================================================== */
// A speaker = a face photo. `id` lets us target it to animate.
function buildActor(actor, id) {
  return `<div class="lc-actor"><div id="${id}">
            <img class="lc-face" src="${faceImg(actor.id)}" alt="speaker"/>
          </div></div>`;
}
// The adult-in-the-middle = parent/stranger photo (dataURL or URL).
function buildAdult(photo, id) {
  const src = photo || "img/parent_placeholder.svg";
  return `<div class="lc-adult"><div id="${id}"><img src="${src}" alt="adult"/></div></div>`;
}
// Full three-actor scene. `actors` = [leftActor, rightActor], each {id, role}.
function buildScene(actors, adultPhoto, promptHTML) {
  return `
    ${promptHTML ? `<div class="lc-prompt">${promptHTML}</div>` : ""}
    <div class="lc-scene">
      ${buildActor(actors[0], "lc-left")}
      ${buildAdult(adultPhoto, "lc-adult-node")}
      ${buildActor(actors[1], "lc-right")}
    </div>
    <div class="lc-speech" id="lc-speech"></div>`;
}
// Focused view: the grown-up + ONE speaker face (used for the affiliation story
// and song, shown one person at a time so it's clearer for kids).
function buildDuo(actor, adultPhoto, promptHTML, onLeft) {
  const adult = buildAdult(adultPhoto, "lc-adult-node");
  const face = buildActor(actor, "lc-solo");
  const spacer = `<div class="lc-actor" style="visibility:hidden"></div>`;  // keeps the adult centered
  // Keep the character on the SAME side of the adult as in familiarization.
  const row = onLeft ? face + adult + spacer : spacer + adult + face;
  return `
    ${promptHTML ? `<div class="lc-prompt">${promptHTML}</div>` : ""}
    <div class="lc-scene">${row}</div>
    <div class="lc-speech" id="lc-speech"></div>`;
}

// Two face-image response buttons (child taps the face). Index = actor order.
function faceChoices(t) { return t.actors.map((a) => `<img class="lc-facebtn-img" src="${faceImg(a.id)}">`); }
const FACE_BTN_HTML = '<button class="jspsych-btn lc-facebtn">%choice%</button>';

// animation helpers
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function setSpeech(t) { const e = document.querySelector("#lc-speech"); if (e) e.innerHTML = t || ""; }
function anim(id, cls) { const e = document.querySelector("#" + id); if (e) e.classList.add(cls); }
function stop(id, cls) { const e = document.querySelector("#" + id); if (e) e.classList.remove(cls); }

/* ===================================================================
   4. AUDIO — synthesized Twinkle Twinkle melody (affiliation cue)  (unchanged)
   =================================================================== */
let _audioCtx = null;
function audioCtx() {
  if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (_audioCtx.state === "suspended") _audioCtx.resume();
  return _audioCtx;
}
const TWINKLE = [   // friend's song (sung together with the grown-up)
  [261.63, 1], [261.63, 1], [392.0, 1], [392.0, 1], [440.0, 1], [440.0, 1], [392.0, 2],
];
const MARY = [      // a DIFFERENT familiar tune (Mary Had a Little Lamb) — the
                    // non-friend's song; the grown-up does NOT sing along to it.
  [329.63, 1], [293.66, 1], [261.63, 1], [293.66, 1], [329.63, 1], [329.63, 1], [329.63, 2],
  [293.66, 1], [293.66, 1], [293.66, 2], [329.63, 1], [392.0, 1], [392.0, 2],
];
function playMelody(notes = TWINKLE, beatMs = 380) {
  const ctx = audioCtx();
  let t = ctx.currentTime + 0.05, totalMs = 50;
  for (const [freq, beats] of notes) {
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = "triangle"; osc.frequency.value = freq;
    const dur = (beats * beatMs) / 1000;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.25, t + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur - 0.04);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t); osc.stop(t + dur);
    t += dur; totalMs += beats * beatMs;
  }
  return totalMs;
}
// Only ONE clip plays at a time; stopAudio() kills any lingering clip so nothing
// overlaps or bleeds into the next screen (also called on every trial start).
// Per-clip playback gains that normalize every voice to a common loudness
// (the ElevenLabs voices were generated at quite different levels). Measured by
// RMS of the voiced samples; values >1 boost quiet clips, <1 attenuate loud ones.
// Regenerate these if you change/replace any audio (see scripts/measure_gains note).
const CLIP_GAINS = {
  "na1_1.mp3":0.552,"na1_2.mp3":0.534,"na1_3.mp3":0.547,"na1_4.mp3":0.571,
  "na2_1.mp3":0.688,"na2_2.mp3":0.639,"na2_3.mp3":0.679,"na2_4.mp3":0.816,
  "la1_1.mp3":0.638,"la1_2.mp3":0.657,"la1_3.mp3":0.630,"la1_4.mp3":0.664,
  "la2_1.mp3":3.961,"la2_2.mp3":3.742,"la2_3.mp3":3.519,"la2_4.mp3":3.952,
  "as1_1.mp3":0.480,"as1_2.mp3":0.454,"as1_3.mp3":0.442,"as1_4.mp3":0.453,
  "start_game.mp3":1.000,"intro_caregiver.mp3":1.167,"intro_stranger.mp3":1.002,
  "fam.mp3":1.520,"accent_check.mp3":1.303,"adult_check_caregiver.mp3":0.911,
  "adult_check_stranger.mp3":1.163,"dv_friend.mp3":1.429,"dv_why.mp3":1.672,
  "debrief.mp3":0.969,"soundcheck.mp3":1.271,
  "story_friend.mp3":1.257,"story_notfriend.mp3":1.094,
  "song_friend.mp3":1.000,"song_notfriend.mp3":1.362,
  "attn_affil.mp3":1.323,"final_pref.mp3":1.193,
  "check_la1.mp3":0.507,"check_la2.mp3":3.820,"check_as1.mp3":0.456,
};
// Route an <audio> element through a GainNode so it plays at the normalized level.
function applyGain(audioEl, src) {
  const g = CLIP_GAINS[src.split("/").pop()];
  if (g === undefined || g === 1) return;
  try {
    const ctx = audioCtx();
    const node = ctx.createMediaElementSource(audioEl);
    const gain = ctx.createGain(); gain.gain.value = g;
    node.connect(gain).connect(ctx.destination);
  } catch (e) { /* fall back to the element's own output */ }
}

let _audioEl = null;
function stopAudio() {
  if (_audioEl) { try { _audioEl.pause(); } catch (e) {} _audioEl = null; }
}
// Fire-and-forget clip (e.g. the manipulation-check replay).
function playClip(src) {
  stopAudio();
  try { const a = new Audio(src); _audioEl = a; applyGain(a, src); a.play().catch(() => {}); } catch (e) {}
}
// Narrate an instruction/question screen (clips in audio/nar/, narrator voice).
const narrate = (key) => playClip(`audio/nar/${key}.mp3`);
const narrateUrl = (key) => `audio/nar/${key}.mp3`;   // for awaited sequencing via speak()
// Play a clip and resolve only when it ACTUALLY ENDS — so the face shakes for the
// clip's full length and the trial never advances mid-sentence. Falls back only if
// the audio is missing / blocked, so the study still runs without sound.
function speak(src) {
  return new Promise((resolve) => {
    stopAudio();
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    try {
      const a = new Audio(src);
      _audioEl = a; applyGain(a, src);
      a.addEventListener("ended", finish);
      a.addEventListener("error", () => setTimeout(finish, 800));   // missing file
      const p = a.play();
      if (p && p.catch) p.catch(() => setTimeout(finish, 4000));    // autoplay blocked
    } catch (e) { setTimeout(finish, 4000); }
    setTimeout(finish, 60000); // hard safety so it can never hang forever
  });
}

/* ===================================================================
   5. PARTICIPANT STATE + COUNTERBALANCING
   =================================================================== */
const jsPsych = initJsPsych({
  on_trial_start: () => stopAudio(),   // never let a clip bleed into the next trial
  on_finish: () => saveData(),
});

const PARTICIPANT = {
  id: jsPsych.randomization.randomID(10),
  caregiverPhoto: null,
  strangerPhoto: null,
};

const cb_caregiver_first = jsPsych.randomization.sampleBernoulli(0.5);
const cb_fam_order = jsPsych.randomization.sampleWithoutReplacement(["accent", "adult"], 1)[0];
const cb_asian_first = jsPsych.randomization.sampleBernoulli(0.5);

const conditionOrder = cb_caregiver_first ? ["caregiver", "stranger"] : ["stranger", "caregiver"];
const pairOrder = cb_asian_first ? ["asian", "latina"] : ["latina", "asian"];

// Deal the 4 phrases across the 4 speaker slots (trial0 left/right, trial1 left/right),
// independent of accent — so phrase content is counterbalanced against accent.
const phraseOrder = jsPsych.randomization.shuffle([0, 1, 2, 3]);
let _slot = 0;

const TRIALS = conditionOrder.map((condition, i) => {
  const pairKey = pairOrder[i];
  const pairFaces = FACE_PAIRS.find((p) => p.key === pairKey).faces;
  const shuffled = jsPsych.randomization.shuffle(pairFaces);  // which face gets which accent
  const nativeFace  = { id: shuffled[0], role: "native",  accent: "native",
                        voice: pickVoice(VOICES.native) };
  const foreignFace = { id: shuffled[1], role: "foreign", accent: "foreign",
                        voice: pickVoice(VOICES.foreign[pairKey]) };
  const nativeLeft = jsPsych.randomization.sampleBernoulli(0.5); // side of native speaker
  const left  = nativeLeft ? nativeFace : foreignFace;
  const right = nativeLeft ? foreignFace : nativeFace;
  left.phrase  = phraseOrder[_slot++];   // each speaker says a different phrase
  right.phrase = phraseOrder[_slot++];
  return { condition, famOrder: cb_fam_order, pairKey, nativeLeft, actors: [left, right] };
});

jsPsych.data.addProperties({ pid: PARTICIPANT.id, cb_caregiver_first, cb_fam_order, cb_asian_first });

const nativeOf  = (t) => t.actors.find((a) => a.role === "native");
const foreignOf = (t) => t.actors.find((a) => a.role === "foreign");
const adultPhotoOf = (t) => (t.condition === "caregiver" ? PARTICIPANT.caregiverPhoto : PARTICIPANT.strangerPhoto);

/* ===================================================================
   6. STRANGER BANK (yoked, consented photos)  (unchanged)
   =================================================================== */
async function loadStrangerPhoto() {
  if (CONFIG.STRANGER_BANK) {
    try {
      const r = await fetch(`${CONFIG.STRANGER_BANK}?exclude=${PARTICIPANT.id}`);
      const j = await r.json();
      if (j && j.photo) { PARTICIPANT.strangerPhoto = j.photo; return; }
    } catch (e) { /* fall through */ }
  }
  PARTICIPANT.strangerPhoto = "img/stranger.svg";
}
async function contributePhotoToBank(consented) {
  if (!consented || !CONFIG.STRANGER_BANK || !PARTICIPANT.caregiverPhoto) return;
  try {
    await fetch(CONFIG.STRANGER_BANK, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pid: PARTICIPANT.id, photo: PARTICIPANT.caregiverPhoto }),
    });
  } catch (e) { /* non-fatal */ }
}

/* ===================================================================
   7. TIMELINE
   =================================================================== */
const timeline = [];

// ---- 7a. Welcome + consent + demographics ----------------------------
timeline.push({
  type: jsPsychSurveyHtmlForm,
  preamble: `
    <h1>Welcome to our game! 🦆</h1>
    <p style="font-size:18px;">This study is for grown-ups and their 4–5 year old child to do together.
    It takes about 10 minutes. In a moment we'll ask you to add a photo of someone
    your child is very close to — they become a character in the game.</p>
    <p style="font-size:16px;color:var(--muted);">Parent/guardian: please fill this out, then hand the
    game to your child (you can stay nearby, but try to stay neutral about the characters).</p>`,
  html: `
    <div style="text-align:left;max-width:620px;margin:auto;font-size:17px;">
      <label>Child's age in months:<br><input name="age_months" type="number" min="36" max="83" required></label><br><br>
      <label>Child's gender:
        <select name="child_gender" required>
          <option value="">—</option><option>Girl</option><option>Boy</option><option>Nonbinary</option><option>Prefer not to say</option>
        </select></label><br><br>
      <label>Is your child regularly exposed to languages or accents other than American English (school, neighbors, family)?<br>
        <textarea name="lang_exposure" rows="2" style="width:100%;"></textarea></label><br><br>
      <label><input type="checkbox" name="consent_participate" required>
        I have read the consent form and agree for my child and me to participate.</label><br><br>
      <label><input type="checkbox" name="consent_photo_reuse">
        (Optional) You may reuse the photo I provide as the "stranger" character for other families.</label>
    </div>`,
  button_label: "Continue",
  data: { name: "intake" },
  on_finish: (d) => {
    jsPsych.data.addProperties({
      age_months: +d.response.age_months,
      child_gender: d.response.child_gender,
      lang_exposure: d.response.lang_exposure,
      consent_photo_reuse: !!d.response.consent_photo_reuse,
    });
  },
});

// ---- 7b. Add the close-person photo (upload or self-capture) ----------
timeline.push({
  type: AdultPhotoPlugin,
  prompt: `<b>Grown-up:</b> please add a picture of someone your child is very close to —
           like a co-parent, a grandparent, or another special grown-up. This person
           becomes a character in the game.<br>
           <span style="font-size:15px;color:var(--muted)">If you don't have a photo handy,
           you can take a picture of yourself instead.</span>`,
  data: { name: "photo_capture" },   // parent-facing — NOT narrated
});

// who the photo is to the child (write-in)
timeline.push({
  type: jsPsychSurveyText,
  preamble: `<p style="font-size:18px;">Last setup question!</p>`,
  questions: [{ prompt: "What is this person to your child? (for example: grandma, daddy, auntie, big brother)",
                name: "relation", required: true }],
  button_label: "Continue",
  data: { name: "relation" },
  on_finish: (d) => { jsPsych.data.addProperties({ close_person_relation: d.response.relation }); },
});

// ---- 7b2. Sound check (async version of the original "Checking Audio" step) ----
timeline.push({
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <h2>Let's check your sound 🔊</h2>
    <p style="font-size:18px;max-width:600px;margin:auto;">This game has talking in it, so sound is important.
    Make sure your device is <b>not on silent</b>, then turn the volume up until you can clearly hear the voice.</p>
    <div style="margin:20px;"><button id="lc-sound-test" class="jspsych-btn">🔊 Play the sound again</button></div>`,
  choices: ["I can hear it clearly — let's go!"],
  data: { name: "sound_check" },
  on_load: () => {
    playClip("audio/nar/soundcheck.mp3");                       // auto-play once
    const b = document.querySelector("#lc-sound-test");
    if (b) b.addEventListener("click", () => playClip("audio/nar/soundcheck.mp3"));
  },
});

timeline.push({
  type: jsPsychHtmlButtonResponse,
  stimulus: `<h2>Great — all set!</h2><p style="font-size:20px;">Now let's meet some new people.</p>`,
  choices: ["Start the game"],
  on_start: () => { loadStrangerPhoto(); },
  on_load: () => narrate("start_game"),
  on_finish: () => { contributePhotoToBank(jsPsych.data.get().values()
                      .find((v) => v.name === "intake")?.response?.consent_photo_reuse); },
  data: { name: "start_game" },
});

timeline.push({
  type: jsPsychFullscreen,
  fullscreen_mode: true,
  message: `<p style="font-size:20px;">We'll make the game full screen. Tap to begin!</p>`,
  button_label: "OK",
});

/* ----- trial-builder helpers ---------------------------------------- */

// Accent familiarization: left face talks/shakes, then right face.
function accentFamiliarization(t) {
  const caption = (a) => {
    const acc = ACCENTS[a.accent];
    return PHRASES[a.phrase].text + (CONFIG.SHOW_ACCENT_LABEL ? ` <span style="color:var(--muted)">(${acc.label})</span>` : "");
  };
  return {
    type: jsPsychHtmlButtonResponse,
    stimulus: () => buildScene(t.actors, adultPhotoOf(t), "Listen to each person talk!"),
    choices: ["Next"],
    button_html: '<button class="jspsych-btn" disabled>%choice%</button>',
    data: { name: "accent_fam", condition: t.condition },
    on_load: async () => {
      const btn = document.querySelector(".jspsych-btn");
      await speak(narrateUrl("fam"));                        // "Listen to each person talk."
      for (const [side, actor] of [["lc-left", t.actors[0]], ["lc-right", t.actors[1]]]) {
        anim(side, "lc-talking");
        setSpeech(caption(actor));
        await speak(audioFor(actor.voice, actor.phrase));   // waits for the clip to finish
        stop(side, "lc-talking"); setSpeech(""); await wait(500);
      }
      if (btn) btn.disabled = false;
    },
  };
}

// Affiliation, shown ONE PERSON AT A TIME (clearer for kids). For each speaker
// (side order): a "story" screen about their relationship to the grown-up, then a
// "song" screen. The foreign-accent speaker is the FRIEND — they and the grown-up
// know the same song and sing it together. The native-accent speaker is NOT a
// friend — they know a DIFFERENT song and the grown-up does not sing along.
function affiliationStory(t, actor) {
  const friend = actor.role === "foreign";
  const who = t.condition === "caregiver" ? "your grown-up" : "this grown-up";
  const text = friend
    ? `<b>${who}</b> and this person are super close best friends! They know the very same song.`
    : `<b>${who}</b> and this person don't really know each other.`;
  return {
    type: jsPsychHtmlButtonResponse,
    stimulus: () => buildDuo(actor, adultPhotoOf(t), text, actor === t.actors[0]),
    choices: ["Next"],
    data: { name: "affil_story", condition: t.condition, role: actor.role, face: actor.id },
    on_load: () => narrate(friend ? "story_friend" : "story_notfriend"),
  };
}
function affiliationSong(t, actor) {
  const friend = actor.role === "foreign";
  return {
    type: jsPsychHtmlButtonResponse,
    stimulus: () => buildDuo(actor, adultPhotoOf(t), "Watch what happens!", actor === t.actors[0]),
    choices: ["Next"],
    button_html: '<button class="jspsych-btn" disabled>%choice%</button>',
    data: { name: "affil_song", condition: t.condition, role: actor.role, face: actor.id },
    on_load: async () => {
      const btn = document.querySelector(".jspsych-btn");
      await speak(narrateUrl(friend ? "song_friend" : "song_notfriend"));
      if (friend) {
        setSpeech("🎵 They love singing together! 🎵");
        anim("lc-solo", "lc-singing"); anim("lc-adult-node", "lc-singing"); // both dance
        await wait(playMelody(TWINKLE));
        stop("lc-solo", "lc-singing"); stop("lc-adult-node", "lc-singing");
      } else {
        setSpeech("They don't sing together.");
        anim("lc-solo", "lc-singing");                       // only the person sings; grown-up still
        await wait(playMelody(MARY));
        stop("lc-solo", "lc-singing");
      }
      setSpeech("");
      if (btn) btn.disabled = false;
    },
  };
}
// story + song for EACH speaker, in side order (left first, per the constants).
function affiliationScreens(t) {
  return t.actors.flatMap((a) => [affiliationStory(t, a), affiliationSong(t, a)]);
}

// A preference (friend-choice) test. Shown after EACH portion, again at the end
// of each condition (with "why"), and once across all four people at the very end.
function prefScreen(t, phase, withWhy) {
  const tl = [{
    type: jsPsychHtmlButtonResponse,
    stimulus: `<div class="lc-prompt">Which person would <b>you</b> like to have as your friend?</div>`,
    choices: () => faceChoices(t),
    button_html: FACE_BTN_HTML,
    data: { name: "preference", condition: t.condition, phase },
    on_load: () => narrate("dv_friend"),
    on_finish: (d) => {
      const c = t.actors[d.response];
      d.chosen_face = c.id; d.chosen_role = c.role; d.chose_native = c.role === "native";
    },
  }];
  if (withWhy) tl.push({
    type: jsPsychSurveyText,
    questions: [{ prompt: "Why is that? (Grown-up, please type what your child says.)", rows: 2, columns: 50, name: "why" }],
    data: { name: "pref_why", condition: t.condition, phase },
    on_load: () => narrate("dv_why"),
  });
  return tl;
}

// End-of-condition attention checks: (1) accent — replays the foreign clip;
// (2) affiliation — who the person in the middle sang with. Correct = the friend.
function attnAccent(t) {
  const target = foreignOf(t);
  return {
    type: jsPsychHtmlButtonResponse,
    stimulus: `<div class="lc-prompt">🔊 Which person talked like this?</div>`,
    choices: () => faceChoices(t),
    button_html: FACE_BTN_HTML,
    data: { name: "attn_accent", condition: t.condition, correct_face: target.id },
    // replay just ONE short sentence in the foreign speaker's voice (not the full phrase)
    on_load: async () => { await speak(narrateUrl("accent_check")); playClip(`audio/check_${target.voice}.mp3`); },
    on_finish: (d) => { d.chosen_face = t.actors[d.response].id; d.correct = d.chosen_face === target.id; },
  };
}
function attnAffil(t) {
  const target = foreignOf(t);
  return {
    type: jsPsychHtmlButtonResponse,
    stimulus: `<div class="lc-prompt">Which person did the person in the middle <b>sing with</b>?</div>`,
    choices: () => faceChoices(t),
    button_html: FACE_BTN_HTML,
    data: { name: "attn_affil", condition: t.condition, correct_face: target.id },
    on_load: () => narrate("attn_affil"),
    on_finish: (d) => { d.chosen_face = t.actors[d.response].id; d.correct = d.chosen_face === target.id; },
  };
}

// Final preference across ALL FOUR people (both pairs), once at the very end.
function finalAll4() {
  const all = jsPsych.randomization.shuffle(
    TRIALS.flatMap((t) => t.actors.map((a) => ({ id: a.id, role: a.role, condition: t.condition }))));
  return [
    {
      type: jsPsychHtmlButtonResponse,
      stimulus: `<div class="lc-prompt">Out of <b>everyone</b> you met, who would you most like to have as your friend?</div>`,
      choices: all.map((a) => `<img class="lc-facebtn-img" src="${faceImg(a.id)}">`),
      button_html: FACE_BTN_HTML,
      data: { name: "final_pref" },
      on_load: () => narrate("final_pref"),
      on_finish: (d) => { const c = all[d.response]; d.chosen_face = c.id; d.chosen_role = c.role; d.chosen_condition = c.condition; },
    },
    {
      type: jsPsychSurveyText,
      questions: [{ prompt: "Why is that? (Grown-up, please type what your child says.)", rows: 2, columns: 50, name: "why" }],
      data: { name: "final_why" },
      on_load: () => narrate("dv_why"),
    },
  ];
}

// Assemble one full condition: each portion is followed by a preference; then the
// two attention checks; then a final preference (with "why") for the condition.
function buildConditionTrial(t) {
  const intro = {
    type: jsPsychHtmlButtonResponse,
    stimulus: `<h2>${t.condition === "caregiver" ? "Meet these people!" : "Now, some new people!"}</h2>
               <p style="font-size:20px;">Watch carefully. 🎬</p>`,
    choices: ["Let's go"],
    data: { name: "trial_intro", condition: t.condition },
    on_load: () => narrate(t.condition === "caregiver" ? "intro_caregiver" : "intro_stranger"),
  };
  const accentBlock = [accentFamiliarization(t)];
  const affilBlock = affiliationScreens(t);
  const accentFirst = t.famOrder === "accent";
  const first  = accentFirst ? accentBlock : affilBlock;
  const second = accentFirst ? affilBlock : accentBlock;
  const firstLabel  = accentFirst ? "after_accent" : "after_affil";
  const secondLabel = accentFirst ? "after_affil" : "after_accent";
  return [
    intro,
    ...first,  ...prefScreen(t, firstLabel),
    ...second, ...prefScreen(t, secondLabel),
    attnAccent(t), attnAffil(t),
    ...prefScreen(t, "final", true),
  ];
}

for (const t of TRIALS) timeline.push(...buildConditionTrial(t));
timeline.push(...finalAll4());   // 7th preference: all four people

// ---- 7d. Debrief ----------------------------------------------------
timeline.push({
  type: jsPsychFullscreen, fullscreen_mode: false,
  message: `<p>All done!</p>`, button_label: "Continue",
});
timeline.push({
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <h1>You did it! 🎉</h1>
    <p style="font-size:18px;max-width:620px;margin:auto;">Thank you so much for playing!</p>
    <p style="font-size:16px;color:var(--muted);max-width:620px;margin:auto;">
      <b>For grown-ups:</b> this study looks at whether 4–5 year olds prefer a person who
      speaks with their own accent, or one their caregiver is friends with.</p>`,
  choices: ["Finish"],
  data: { name: "debrief" },
  on_load: () => narrate("debrief"),
});

/* ===================================================================
   8. SAVE  (Google Sheet via Apps Script; JSON download fallback)
   =================================================================== */
function urlParam(name) {
  try { return new URLSearchParams(location.search).get(name) || ""; } catch (e) { return ""; }
}

// Flatten the jsPsych record into ONE tidy row per condition (CSV_COLS order).
function buildRows() {
  const all = jsPsych.data.get();
  const props = all.values()[0] || {};
  const pid = urlParam("pid") || PARTICIPANT.id;
  const ts = new Date().toISOString();
  const bin = (v) => (v === undefined || v === null ? "" : v ? 1 : 0);
  const finalAll = all.filter({ name: "final_pref" }).last(1).values()[0] || {};  // participant-level
  return TRIALS.map((t, i) => {
    const f = (name) => all.filter({ name, condition: t.condition });
    const prefBy = (ph) => f("preference").values().find((v) => v.phase === ph) || {};
    const pAcc = prefBy("after_accent"), pAff = prefBy("after_affil"), pFin = prefBy("final");
    const finWhy = f("pref_why").values().find((v) => v.phase === "final")?.response?.why ?? "";
    const aAcc = f("attn_accent").last(1).values()[0] || {};
    const aAff = f("attn_affil").last(1).values()[0] || {};
    return {
      participantId: pid, timestamp: ts,
      ageMonths: props.age_months ?? "", childGender: props.child_gender ?? "",
      langExposure: props.lang_exposure ?? "", consentPhotoReuse: bin(props.consent_photo_reuse),
      closePersonRelation: props.close_person_relation ?? "",
      cbCaregiverFirst: bin(props.cb_caregiver_first), cbFamOrder: props.cb_fam_order ?? "",
      cbAsianFirst: bin(props.cb_asian_first),
      condition: t.condition, conditionPosition: i + 1, famOrder: t.famOrder,
      pairKey: t.pairKey, nativeSide: t.nativeLeft ? "left" : "right",
      nativeFace: nativeOf(t).id, foreignFace: foreignOf(t).id,
      nativePhrase: PHRASES[nativeOf(t).phrase].id, foreignPhrase: PHRASES[foreignOf(t).phrase].id,
      nativeVoice: nativeOf(t).voice, foreignVoice: foreignOf(t).voice,
      prefAccentFace: pAcc.chosen_face ?? "", prefAccentChoseNative: bin(pAcc.chose_native),
      prefAffilFace: pAff.chosen_face ?? "", prefAffilChoseNative: bin(pAff.chose_native),
      prefFinalFace: pFin.chosen_face ?? "", prefFinalChoseNative: bin(pFin.chose_native), prefFinalWhy: finWhy,
      attnAccentCorrect: bin(aAcc.correct), attnAffilCorrect: bin(aAff.correct),
      finalAll4Face: finalAll.chosen_face ?? "", finalAll4Role: finalAll.chosen_role ?? "",
      finalAll4Condition: finalAll.chosen_condition ?? "",
    };
  });
}

function postToSheets(row) {
  try {
    fetch(CONFIG.SHEETS_WEBHOOK, {
      method: "POST", mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ headers: CSV_COLS, row }),
    }).catch((e) => console.warn("[Sheets] post failed:", e));
  } catch (e) { console.warn("[Sheets] post threw:", e); }
}

function saveData() {
  const rows = buildRows();
  if (CONFIG.SHEETS_WEBHOOK) { rows.forEach(postToSheets); return; }
  const payload = JSON.stringify(
    { participantId: urlParam("pid") || PARTICIPANT.id, rows, raw: jsPsych.data.get().values() }, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `langcare_${urlParam("pid") || PARTICIPANT.id}.json`; a.click();
  URL.revokeObjectURL(url);
}

/* ===================================================================
   9. RUN
   =================================================================== */
jsPsych.run(timeline);
