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
  SHEETS_WEBHOOK: "",
  // Yoked stranger photo bank endpoint (see loadStrangerPhoto). Leave "" to use
  // the bundled placeholder (GitHub Pages can't run a bank server).
  STRANGER_BANK: "",
  // While true, the accent is shown as a caption so the study is testable
  // WITHOUT audio. Set false once real ElevenLabs accent audio is in audio/.
  SHOW_ACCENT_LABEL: true,
  SING_WORDS: false,            // false = hum the melody (affiliation cue)
  MAX_CHECK_REPEATS: 2,         // pre-reg: 2 repetitions before exclusion flag
};

// One row per CONDITION (2 rows per child) — the grain the brms model wants
// (choseNative ~ condition + (1|participant)). Shared by the Sheet + JSON export.
const CSV_COLS = [
  "participantId", "timestamp",
  "ageMonths", "childSex", "langExposure", "consentPhotoReuse",
  "cbCaregiverFirst", "cbFamOrder", "cbAsianFirst",
  "condition", "conditionPosition", "famOrder",
  "pairKey", "nativeSide", "nativeFace", "foreignFace",
  "accentCheckCorrect", "accentCheckAttempts", "adultCheckCorrect",
  "dvChosenFace", "dvChosenRole", "choseNative",   // <- primary DV
  "dvWhy",
];

/* ===================================================================
   1. STIMULUS CONTENT — faces + accents
   =================================================================== */
// Matched women pairs (Chicago Face Database). Each trial uses ONE pair.
const FACE_PAIRS = [
  { key: "asian",  faces: ["AF-218", "AF-235"] },
  { key: "latina", faces: ["LF-203", "LF-229"] },
];
const faceImg = (id) => `img/faces/${id}.jpg`;

// Both speakers say the SAME English sentence; the difference is the ACCENT.
// `phrase` is the on-screen caption; `audio` is the ElevenLabs clip.
const ACCENTS = {
  native:  { key: "native",  label: "American accent",
             phrase: "Hi! Look at the little duck!", audio: "audio/native.mp3" },
  foreign: { key: "foreign", label: "a different accent",
             phrase: "Hi! Look at the little duck!", audio: "audio/foreign.mp3" },
};

/* ===================================================================
   2. CUSTOM PLUGIN: webcam still-photo capture  (unchanged)
   =================================================================== */
class PhotoCapturePlugin {
  static info = {
    name: "photo-capture",
    parameters: {
      prompt:        { type: "HTML_STRING", default: "" },
      take_label:    { type: "STRING", default: "📸 Take picture" },
      retake_label:  { type: "STRING", default: "↺ Retake" },
      accept_label:  { type: "STRING", default: "✓ Use this one" },
    },
  };
  constructor(jsPsych) { this.jsPsych = jsPsych; }

  trial(display_element, trial) {
    display_element.innerHTML = `
      <div id="lc-cam-wrap">
        <div class="lc-prompt">${trial.prompt}</div>
        <video id="lc-video" autoplay playsinline></video>
        <canvas id="lc-canvas" class="lc-hidden" width="640" height="480"></canvas>
        <div id="lc-cam-controls">
          <button id="lc-take" class="jspsych-btn">${trial.take_label}</button>
          <button id="lc-retake" class="jspsych-btn lc-hidden">${trial.retake_label}</button>
          <button id="lc-accept" class="jspsych-btn lc-hidden">${trial.accept_label}</button>
        </div>
        <div id="lc-cam-err" style="color:var(--bad);font-size:16px;"></div>
      </div>`;

    const video  = display_element.querySelector("#lc-video");
    const canvas = display_element.querySelector("#lc-canvas");
    const ctx    = canvas.getContext("2d");
    const takeB   = display_element.querySelector("#lc-take");
    const retakeB = display_element.querySelector("#lc-retake");
    const acceptB = display_element.querySelector("#lc-accept");
    const errEl   = display_element.querySelector("#lc-cam-err");
    let stream = null, dataURL = null;

    navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false })
      .then((s) => { stream = s; video.srcObject = s; })
      .catch((e) => { errEl.textContent =
        "We couldn't access your camera. Please allow camera access and reload. (" + e.name + ")"; });

    takeB.addEventListener("click", () => {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      dataURL = canvas.toDataURL("image/jpeg", 0.85);
      video.classList.add("lc-hidden"); canvas.classList.remove("lc-hidden");
      takeB.classList.add("lc-hidden");
      retakeB.classList.remove("lc-hidden"); acceptB.classList.remove("lc-hidden");
    });
    retakeB.addEventListener("click", () => {
      dataURL = null;
      canvas.classList.add("lc-hidden"); video.classList.remove("lc-hidden");
      retakeB.classList.add("lc-hidden"); acceptB.classList.add("lc-hidden");
      takeB.classList.remove("lc-hidden");
    });
    acceptB.addEventListener("click", () => {
      if (stream) stream.getTracks().forEach((t) => t.stop());
      PARTICIPANT.caregiverPhoto = dataURL;
      display_element.innerHTML = "";
      this.jsPsych.finishTrial({ photo_captured: !!dataURL });
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
const TWINKLE = [
  [261.63, 1], [261.63, 1], [392.0, 1], [392.0, 1], [440.0, 1], [440.0, 1], [392.0, 2],
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
function playClip(src) { try { const a = new Audio(src); a.play().catch(() => {}); } catch (e) {} }

/* ===================================================================
   5. PARTICIPANT STATE + COUNTERBALANCING
   =================================================================== */
const jsPsych = initJsPsych({ on_finish: () => saveData() });

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

const TRIALS = conditionOrder.map((condition, i) => {
  const pairKey = pairOrder[i];
  const pairFaces = FACE_PAIRS.find((p) => p.key === pairKey).faces;
  const shuffled = jsPsych.randomization.shuffle(pairFaces);  // which face gets which accent
  const nativeFace  = { id: shuffled[0], role: "native",  accent: "native"  };
  const foreignFace = { id: shuffled[1], role: "foreign", accent: "foreign" };
  const nativeLeft = jsPsych.randomization.sampleBernoulli(0.5); // side of native speaker
  const left  = nativeLeft ? nativeFace : foreignFace;
  const right = nativeLeft ? foreignFace : nativeFace;
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
    It takes about 10 minutes. In a moment we'll take a quick webcam photo of the
    grown-up — it becomes a friendly character in the game.</p>
    <p style="font-size:16px;color:var(--muted);">Parent/guardian: please fill this out, then hand the
    game to your child (you can stay nearby, but try to stay neutral about the characters).</p>`,
  html: `
    <div style="text-align:left;max-width:620px;margin:auto;font-size:17px;">
      <label>Child's age in months:<br><input name="age_months" type="number" min="36" max="83" required></label><br><br>
      <label>Child's sex:
        <select name="child_sex" required>
          <option value="">—</option><option>Female</option><option>Male</option><option>Other / prefer not to say</option>
        </select></label><br><br>
      <label>Is your child regularly exposed to languages or accents other than American English (school, neighbors, family)?<br>
        <textarea name="lang_exposure" rows="2" style="width:100%;"></textarea></label><br><br>
      <label><input type="checkbox" name="consent_participate" required>
        I have read the consent form and agree for my child and me to participate.</label><br><br>
      <label><input type="checkbox" name="consent_photo_reuse">
        (Optional) You may reuse my webcam photo as the "stranger" character for other families.</label>
    </div>`,
  button_label: "Continue",
  data: { name: "intake" },
  on_finish: (d) => {
    jsPsych.data.addProperties({
      age_months: +d.response.age_months,
      child_sex: d.response.child_sex,
      lang_exposure: d.response.lang_exposure,
      consent_photo_reuse: !!d.response.consent_photo_reuse,
    });
  },
});

// ---- 7b. Webcam photo capture ---------------------------------------
timeline.push({
  type: PhotoCapturePlugin,
  prompt: "Grown-up: smile! 📸 This photo becomes a character in the game.",
  data: { name: "photo_capture" },
});

timeline.push({
  type: jsPsychHtmlButtonResponse,
  stimulus: `<h2>Great — all set!</h2><p style="font-size:20px;">Now let's meet some characters.</p>`,
  choices: ["Start the game"],
  on_start: () => { loadStrangerPhoto(); },
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
    return acc.phrase + (CONFIG.SHOW_ACCENT_LABEL ? ` <span style="color:var(--muted)">(${acc.label})</span>` : "");
  };
  return {
    type: jsPsychHtmlButtonResponse,
    stimulus: () => buildScene(t.actors, adultPhotoOf(t), "Listen to each person say hello!"),
    choices: ["Next"],
    button_html: '<button class="jspsych-btn" disabled>%choice%</button>',
    data: { name: "accent_fam", condition: t.condition },
    on_load: async () => {
      const btn = document.querySelector(".jspsych-btn");
      for (const [side, actor] of [["lc-left", t.actors[0]], ["lc-right", t.actors[1]]]) {
        anim(side, "lc-talking");
        setSpeech(caption(actor));
        playClip(ACCENTS[actor.accent].audio);
        await wait(2400);
        stop(side, "lc-talking"); setSpeech(""); await wait(400);
      }
      if (btn) btn.disabled = false;
    },
  };
}

// Adult familiarization story — references faces by inline thumbnail.
function adultStory(t) {
  const fg = foreignOf(t), nt = nativeOf(t);
  const who = t.condition === "caregiver" ? "your grown-up" : "this grown-up";
  return {
    type: jsPsychHtmlButtonResponse,
    stimulus: () => buildScene(t.actors, adultPhotoOf(t),
      `You may not know this, but <b>${who}</b> and <img class="lc-inline" src="${faceImg(fg.id)}"> are
       super close best friends — they know the very same songs and love to sing together!
       <br>${who} and <img class="lc-inline" src="${faceImg(nt.id)}"> don't really know each other.`),
    choices: ["Watch them"],
    data: { name: "adult_story", condition: t.condition },
  };
}

// The singing interaction: adult sings with the foreign-accent speaker, "Hmph!" to native.
function adultSinging(t) {
  return {
    type: jsPsychHtmlButtonResponse,
    stimulus: () => buildScene(t.actors, adultPhotoOf(t), "Watch what happens!"),
    choices: ["Next"],
    button_html: '<button class="jspsych-btn" disabled>%choice%</button>',
    data: { name: "adult_affiliation", condition: t.condition },
    on_load: async () => {
      const btn = document.querySelector(".jspsych-btn");
      for (const [actor, side] of [[t.actors[0], "lc-left"], [t.actors[1], "lc-right"]]) {
        if (actor.role === "foreign") {
          setSpeech("🎵 They sing together! 🎵");
          anim(side, "lc-singing"); anim("lc-adult-node", "lc-singing");
          await wait(playMelody());
          stop(side, "lc-singing"); stop("lc-adult-node", "lc-singing");
        } else {
          setSpeech('The grown-up turns away… "Hmph!"');
          anim(side, "lc-talking"); await wait(1500); stop(side, "lc-talking");
        }
        setSpeech(""); await wait(400);
      }
      if (btn) btn.disabled = false;
    },
  };
}

// Accent manipulation check (plays the foreign clip; up to MAX_CHECK_REPEATS retries).
function accentCheck(t) {
  const target = foreignOf(t);
  const cue = CONFIG.SHOW_ACCENT_LABEL
    ? `Which person talked with <b>${ACCENTS.foreign.label}</b>?`
    : `🔊 Which person talked like this?`;
  return {
    timeline: [{
      type: jsPsychHtmlButtonResponse,
      stimulus: `<div class="lc-prompt">${cue}</div>`,
      choices: () => faceChoices(t),
      button_html: FACE_BTN_HTML,
      data: { name: "accent_check", condition: t.condition, correct_face: target.id },
      on_load: () => { playClip(ACCENTS.foreign.audio); },
      on_finish: (d) => {
        d.chosen_face = t.actors[d.response].id;
        d.correct = d.chosen_face === target.id;
      },
    }],
    loop_function: (data) => {
      const last = data.values()[data.values().length - 1];
      const attempts = jsPsych.data.get().filter({ name: "accent_check", condition: t.condition }).count();
      return !last.correct && attempts < CONFIG.MAX_CHECK_REPEATS;
    },
  };
}

// Adult manipulation check: which one did the adult like? (foreign = correct)
function adultCheck(t) {
  const target = foreignOf(t);
  const who = t.condition === "caregiver" ? "your grown-up" : "the grown-up";
  return {
    type: jsPsychHtmlButtonResponse,
    stimulus: `<div class="lc-prompt">Which person did <b>${who}</b> like?</div>`,
    choices: () => faceChoices(t),
    button_html: FACE_BTN_HTML,
    data: { name: "adult_check", condition: t.condition, correct_face: target.id },
    on_finish: (d) => {
      d.chosen_face = t.actors[d.response].id;
      d.correct = d.chosen_face === target.id;
    },
  };
}

// DV block: friend choice (face buttons) -> why.
function dvBlock(t) {
  return [
    {
      type: jsPsychHtmlButtonResponse,
      stimulus: `<div class="lc-prompt">Whom would <b>you</b> like to have as your friend?</div>`,
      choices: () => faceChoices(t),
      button_html: FACE_BTN_HTML,
      data: { name: "dv_friend", condition: t.condition },
      on_finish: (d) => {
        const chosen = t.actors[d.response];
        d.chosen_face = chosen.id;
        d.chosen_role = chosen.role;                  // 'native' | 'foreign'
        d.chose_native = chosen.role === "native";    // primary 0/1 DV
      },
    },
    {
      type: jsPsychSurveyText,
      questions: [{ prompt: "Why is that? (Grown-up, please type what your child says.)",
                    rows: 2, columns: 50, name: "why" }],
      data: { name: "dv_why", condition: t.condition },
    },
  ];
}

// Assemble one full condition trial, honoring familiarization order.
function buildConditionTrial(t) {
  const intro = {
    type: jsPsychHtmlButtonResponse,
    stimulus: `<h2>${t.condition === "caregiver" ? "Meet these people!" : "Now, some new people!"}</h2>
               <p style="font-size:20px;">Watch carefully. 🎬</p>`,
    choices: ["Let's go"],
    data: { name: "trial_intro", condition: t.condition },
  };
  const accentPair = [accentFamiliarization(t), accentCheck(t)];
  const adultPair  = [adultStory(t), adultSinging(t), adultCheck(t)];
  const ordered = t.famOrder === "accent"
    ? [...accentPair, ...adultPair]
    : [...adultPair, ...accentPair];
  return [intro, ...ordered, ...dvBlock(t)];
}

for (const t of TRIALS) timeline.push(...buildConditionTrial(t));

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
  return TRIALS.map((t, i) => {
    const f = (name) => all.filter({ name, condition: t.condition });
    const friend = f("dv_friend").last(1).values()[0] || {};
    const why = f("dv_why").last(1).values()[0]?.response?.why ?? "";
    const accChecks = f("accent_check").values();
    const lastAcc = accChecks[accChecks.length - 1] || {};
    const adult = f("adult_check").last(1).values()[0] || {};
    return {
      participantId: pid, timestamp: ts,
      ageMonths: props.age_months ?? "", childSex: props.child_sex ?? "",
      langExposure: props.lang_exposure ?? "", consentPhotoReuse: bin(props.consent_photo_reuse),
      cbCaregiverFirst: bin(props.cb_caregiver_first), cbFamOrder: props.cb_fam_order ?? "",
      cbAsianFirst: bin(props.cb_asian_first),
      condition: t.condition, conditionPosition: i + 1, famOrder: t.famOrder,
      pairKey: t.pairKey, nativeSide: t.nativeLeft ? "left" : "right",
      nativeFace: nativeOf(t).id, foreignFace: foreignOf(t).id,
      accentCheckCorrect: bin(lastAcc.correct), accentCheckAttempts: accChecks.length,
      adultCheckCorrect: bin(adult.correct),
      dvChosenFace: friend.chosen_face ?? "", dvChosenRole: friend.chosen_role ?? "",
      choseNative: bin(friend.chose_native),
      dvWhy: why,
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
