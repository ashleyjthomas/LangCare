/* =============================================================
   LANG-CARE (asynchronous adaptation)
   "Can Caregiver Affiliation Influence Language Bias?"

   Adapts the synchronous LANG-CARE Study 2 (4–5 yo monolingual
   English children; within-subjects caregiver vs. stranger) into a
   self-paced, self-hosted jsPsych study with NO live experimenter.

   WHAT'S THE SAME AS THE PRE-REG
     - Within-subjects: a CAREGIVER trial and a STRANGER trial.
     - Each trial: two speakers, one speaks the child's language
       (English = shared) and one a non-shared language (French or
       Hindi). An adult in the middle AFFILIATES with the non-shared
       speaker and rejects the shared speaker.
     - Manipulation checks (language + adult-liking) and the DV:
       "Whom would you like as your friend?" + "Why?" + a guess at
       how many languages each speaker knows.
     - Counterbalancing: condition order, familiarization order
       (language-first vs adult-first, constant within child), which
       non-shared language, the face/"color" pair, and the side of
       the English speaker. Constants: left actor always acts first;
       the adult always affiliates with the non-shared speaker.

   WHAT'S DIFFERENT (async adaptation — flagged for Ashley)
     1. ASYNC, no experimenter. Parent reads instructions; child taps.
     2. The "adult in the middle" is the PARENT'S OWN WEBCAM PHOTO
        (caregiver trial) or another consenting parent's photo pulled
        from a yoked bank (stranger trial). See PhotoCapturePlugin +
        STRANGER_BANK below.
     3. Speakers are placeholder ANIMATED FACES (inline SVG) for now,
        not puppets and not real video. Swap in real stimuli later by
        replacing buildActor()/the familiarization screens. NOTE: real
        human faces reintroduce race/age/gender cues the original
        controlled for with puppets — design decision, see README.
     4. Affiliation cue = SINGING TOGETHER (Twinkle Twinkle melody,
        synthesized via Web Audio). To avoid leaking language through
        sung *words*, the default melody is HUMMED (la-la / tones), so
        "they know the same song" does not also reveal a shared
        language. Set SING_WORDS = true to use lyric audio instead.

   Audio is OPTIONAL: the study runs end-to-end with on-screen text +
   the synthesized melody. Drop real recordings into audio/ and set the
   paths in LANGUAGES / AUDIO to add narration on top (see audio/SCRIPT.md).
   ============================================================= */

/* ===================================================================
   0. CONFIG — edit these
   =================================================================== */
const CONFIG = {
  // Where to POST the finished data (your Harvard-computing endpoint).
  // Leave "" to skip the network save and just download a JSON file.
  SAVE_URL: "",
  // Endpoint that stores/serves the yoked "stranger" photo bank.
  // GET  STRANGER_BANK?exclude=<pid>  -> { photo: <dataURL or URL> }
  // POST STRANGER_BANK  { pid, photo } -> add a consented photo
  // Leave "" to use the bundled placeholder stranger (img/stranger.svg).
  STRANGER_BANK: "",
  SING_WORDS: false,            // false = hum the melody (avoids language leak)
  MAX_CHECK_REPEATS: 2,         // pre-reg: 2 repetitions before exclusion flag
};

/* ===================================================================
   1. STIMULUS CONTENT
   =================================================================== */
// Languages. `phrase` doubles as the on-screen "speech" and the
// manipulation-check text until real audio is recorded.
const LANGUAGES = {
  english: { label: "English", phrase: "Hello! Look at the little duck!",      audio: "audio/english.mp3" },
  french:  { label: "French",  phrase: "Bonjour ! Regarde le petit canard !",  audio: "audio/french.mp3"  },
  hindi:   { label: "Hindi",   phrase: "Namaste! Dekho, chhoti si batakh!",    audio: "audio/hindi.mp3"   },
};

// "Color" labels (kids refer to actors by color, as in the original
// "Mr. [color]"). Each face wears a colored shirt.
const COLOR_POOL = [
  { key: "blue",   name: "blue",   shirt: "#4a90d9" },
  { key: "green",  name: "green",  shirt: "#56ab2f" },
  { key: "purple", name: "purple", shirt: "#9b59b6" },
  { key: "orange", name: "orange", shirt: "#e67e22" },
];
// A little surface variety so the two faces in a pair look distinct.
const SKINS = ["#f1c27d", "#e0ac69", "#c68642", "#8d5524", "#ffdbac"];
const HAIRS = ["#2b2b2b", "#6b4226", "#d4a017", "#8b3a3a"];

/* ===================================================================
   2. CUSTOM PLUGIN: webcam still-photo capture
   ------------------------------------------------------------------
   jsPsych has no built-in "take a photo" plugin, so this is a small
   one: live mirrored preview -> Take picture -> Retake / Use this.
   Stores the captured frame as a JPEG dataURL in trial data AND in
   the global PARTICIPANT.caregiverPhoto for compositing into scenes.
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
    let stream = null;
    let dataURL = null;

    navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false })
      .then((s) => { stream = s; video.srcObject = s; })
      .catch((e) => { errEl.textContent =
        "We couldn't access your camera. Please allow camera access and reload. (" + e.name + ")"; });

    takeB.addEventListener("click", () => {
      // Draw the current frame un-mirrored so the saved photo is true orientation.
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      dataURL = canvas.toDataURL("image/jpeg", 0.85);
      video.classList.add("lc-hidden");
      canvas.classList.remove("lc-hidden");
      takeB.classList.add("lc-hidden");
      retakeB.classList.remove("lc-hidden");
      acceptB.classList.remove("lc-hidden");
    });

    retakeB.addEventListener("click", () => {
      dataURL = null;
      canvas.classList.add("lc-hidden");
      video.classList.remove("lc-hidden");
      retakeB.classList.add("lc-hidden");
      acceptB.classList.add("lc-hidden");
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
   3. FACE + SCENE RENDERING (placeholder animated actors)
   =================================================================== */
// One friendly cartoon face. `id` lets us target it to animate.
function buildActor(color, skin, hair, id) {
  return `
  <div class="lc-actor">
    <div id="${id}">
      <svg viewBox="0 0 200 240" xmlns="http://www.w3.org/2000/svg">
        <rect x="55" y="150" width="90" height="90" rx="22" fill="${color.shirt}"/>
        <circle cx="100" cy="95" r="62" fill="${skin}"/>
        <path d="M40 90 a60 60 0 0 1 120 0 q-60 -55 -120 0 z" fill="${hair}"/>
        <circle cx="78" cy="92" r="8" fill="#2b2b2b"/>
        <circle cx="122" cy="92" r="8" fill="#2b2b2b"/>
        <path d="M78 120 q22 20 44 0" stroke="#2b2b2b" stroke-width="5"
              fill="none" stroke-linecap="round"/>
      </svg>
    </div>
    <div class="lc-label">the ${color.name} one</div>
  </div>`;
}

// The adult-in-the-middle = the parent/stranger photo (dataURL or URL).
function buildAdult(photo, id) {
  const src = photo || "img/parent_placeholder.svg";
  return `<div class="lc-adult"><div id="${id}">
            <img src="${src}" alt="adult"/>
          </div></div>`;
}

// Assemble the full three-actor scene. `actors` is [leftActor, rightActor],
// each = { color, skin, hair, role: 'shared'|'nonshared' }.
function buildScene(actors, adultPhoto, promptHTML) {
  const left = buildActor(actors[0].color, actors[0].skin, actors[0].hair, "lc-left");
  const right = buildActor(actors[1].color, actors[1].skin, actors[1].hair, "lc-right");
  return `
    ${promptHTML ? `<div class="lc-prompt">${promptHTML}</div>` : ""}
    <div class="lc-scene">
      ${left}
      ${buildAdult(adultPhoto, "lc-adult-node")}
      ${right}
    </div>
    <div class="lc-speech" id="lc-speech"></div>`;
}

// animation helpers (operate on ids inside the current display)
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function setSpeech(t) { const e = document.querySelector("#lc-speech"); if (e) e.textContent = t || ""; }
function anim(id, cls) { const e = document.querySelector("#" + id); if (e) e.classList.add(cls); }
function stop(id, cls) { const e = document.querySelector("#" + id); if (e) e.classList.remove(cls); }

/* ===================================================================
   4. AUDIO — synthesized Twinkle Twinkle melody (the affiliation cue)
   =================================================================== */
let _audioCtx = null;
function audioCtx() {
  if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (_audioCtx.state === "suspended") _audioCtx.resume();
  return _audioCtx;
}
// First phrase of Twinkle Twinkle: C C G G A A G  (note, beats)
const TWINKLE = [
  [261.63, 1], [261.63, 1], [392.0, 1], [392.0, 1],
  [440.0, 1], [440.0, 1], [392.0, 2],
];
function playMelody(notes = TWINKLE, beatMs = 380) {
  const ctx = audioCtx();
  let t = ctx.currentTime + 0.05;
  let totalMs = 50;
  for (const [freq, beats] of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";            // soft, voice-like for "humming"
    osc.frequency.value = freq;
    const dur = (beats * beatMs) / 1000;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.25, t + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur - 0.04);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t); osc.stop(t + dur);
    t += dur;
    totalMs += beats * beatMs;
  }
  return totalMs;
}

/* ===================================================================
   5. PARTICIPANT STATE + COUNTERBALANCING
   =================================================================== */
const jsPsych = initJsPsych({
  on_finish: () => saveData(),
});

const PARTICIPANT = {
  id: jsPsych.randomization.randomID(10),
  caregiverPhoto: null,    // filled by PhotoCapturePlugin
  strangerPhoto: null,     // filled from the bank (or placeholder)
};

// --- participant-level counterbalancing -------------------------------
const cb_caregiver_first = jsPsych.randomization.sampleBernoulli(0.5);         // condition order
const cb_fam_order = jsPsych.randomization.sampleWithoutReplacement(   // constant within child
  ["language", "adult"], 1)[0];

// Two trials differ in non-shared language + color pair (counterbalanced
// which language goes with which condition).
const cb_french_first = jsPsych.randomization.sampleBernoulli(0.5);
const nonsharedLangs = cb_french_first ? ["french", "hindi"] : ["hindi", "french"];

// Distinct color pairs for the two trials.
const shuffledColors = jsPsych.randomization.shuffle(COLOR_POOL);
const colorPairs = [
  [shuffledColors[0], shuffledColors[1]],
  [shuffledColors[2], shuffledColors[3]],
];

// Build the two condition configs in presentation order.
const conditionOrder = cb_caregiver_first ? ["caregiver", "stranger"] : ["stranger", "caregiver"];
const TRIALS = conditionOrder.map((condition, i) => {
  const englishLeft = jsPsych.randomization.sampleBernoulli(0.5); // side of English speaker
  const pair = colorPairs[i];
  const skin = jsPsych.randomization.sampleWithoutReplacement(SKINS, 2);
  const hair = jsPsych.randomization.sampleWithoutReplacement(HAIRS, 2);
  // actors[0] = LEFT (always acts first per the constants)
  const sharedActor    = { role: "shared",    lang: "english" };
  const nonsharedActor = { role: "nonshared", lang: nonsharedLangs[i] };
  const leftRole  = englishLeft ? sharedActor : nonsharedActor;
  const rightRole = englishLeft ? nonsharedActor : sharedActor;
  return {
    condition,
    famOrder: cb_fam_order,
    nonsharedLang: nonsharedLangs[i],
    englishLeft,
    actors: [
      { ...leftRole,  color: pair[0], skin: skin[0], hair: hair[0] },
      { ...rightRole, color: pair[1], skin: skin[1], hair: hair[1] },
    ],
  };
});

jsPsych.data.addProperties({
  pid: PARTICIPANT.id,
  cb_caregiver_first, cb_fam_order, cb_french_first,
});

// convenience: pull the shared / non-shared actor from a trial config
const sharedOf    = (t) => t.actors.find((a) => a.role === "shared");
const nonsharedOf = (t) => t.actors.find((a) => a.role === "nonshared");
const adultPhotoOf = (t) => (t.condition === "caregiver" ? PARTICIPANT.caregiverPhoto : PARTICIPANT.strangerPhoto);
const colorWord = (a) => a.color.name;

/* ===================================================================
   6. STRANGER BANK (yoked, consented photos)
   =================================================================== */
async function loadStrangerPhoto() {
  if (CONFIG.STRANGER_BANK) {
    try {
      const r = await fetch(`${CONFIG.STRANGER_BANK}?exclude=${PARTICIPANT.id}`);
      const j = await r.json();
      if (j && j.photo) { PARTICIPANT.strangerPhoto = j.photo; return; }
    } catch (e) { /* fall through to placeholder */ }
  }
  PARTICIPANT.strangerPhoto = "img/stranger.svg"; // bundled placeholder
}
async function contributePhotoToBank(consented) {
  if (!consented || !CONFIG.STRANGER_BANK || !PARTICIPANT.caregiverPhoto) return;
  try {
    await fetch(CONFIG.STRANGER_BANK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pid: PARTICIPANT.id, photo: PARTICIPANT.caregiverPhoto }),
    });
  } catch (e) { /* non-fatal */ }
}

/* ===================================================================
   7. TIMELINE PIECES
   =================================================================== */
const timeline = [];

// ---- 7a. Welcome + consent + demographics (parent) -------------------
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
      <label>Is your child regularly exposed to languages other than English (school, neighbors, family)?<br>
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

// kick off stranger-photo load right after we have the camera permission flow
timeline.push({
  type: jsPsychHtmlButtonResponse,
  stimulus: `<h2>Great — all set!</h2><p style="font-size:20px;">Now let's meet some characters.</p>`,
  choices: ["Start the game"],
  on_start: () => { loadStrangerPhoto(); },        // async, ready well before the stranger trial
  on_finish: () => { contributePhotoToBank(jsPsych.data.get().values()
                      .find(v => v.name === "intake")?.response?.consent_photo_reuse); },
  data: { name: "start_game" },
});

// ---- 7c. Fullscreen -------------------------------------------------
timeline.push({
  type: jsPsychFullscreen,
  fullscreen_mode: true,
  message: `<p style="font-size:20px;">We'll make the game full screen. Tap to begin!</p>`,
  button_label: "OK",
});

/* ----- trial-builder helpers ---------------------------------------- */

// Language familiarization: left actor speaks/​shakes, then right actor.
function languageFamiliarization(t) {
  return {
    type: jsPsychHtmlButtonResponse,
    stimulus: () => buildScene(t.actors, adultPhotoOf(t),
      "Listen to each character say hello!"),
    choices: ["Next"],
    button_html: '<button class="jspsych-btn" disabled>%choice%</button>',
    data: { name: "lang_fam", condition: t.condition },
    on_load: async () => {
      const btn = document.querySelector(".jspsych-btn");
      for (const [side, actor] of [["lc-left", t.actors[0]], ["lc-right", t.actors[1]]]) {
        anim(side, "lc-talking");
        setSpeech(LANGUAGES[actor.lang].phrase);
        playClip(LANGUAGES[actor.lang].audio);
        await wait(2400);
        stop(side, "lc-talking");
        setSpeech("");
        await wait(400);
      }
      if (btn) btn.disabled = false;
    },
  };
}

// Adult familiarization: story text, then the singing interaction.
function adultStory(t) {
  const ns = nonsharedOf(t), sh = sharedOf(t);
  const who = t.condition === "caregiver" ? "your grown-up" : "this grown-up";
  return {
    type: jsPsychHtmlButtonResponse,
    stimulus: () => buildScene(t.actors, adultPhotoOf(t),
      `You may not know this, but <b>${who}</b> and the <b>${colorWord(ns)}</b> one are
       super close best friends — they know the very same songs and love to sing together!
       <br>${who} and the <b>${colorWord(sh)}</b> one don't really know each other.`),
    choices: ["Watch them"],
    data: { name: "adult_story", condition: t.condition },
  };
}

function adultSinging(t) {
  const ns = nonsharedOf(t), sh = sharedOf(t);
  const nsSide = t.actors[0].role === "nonshared" ? "lc-left" : "lc-right";
  const shSide = t.actors[0].role === "shared" ? "lc-left" : "lc-right";
  return {
    type: jsPsychHtmlButtonResponse,
    stimulus: () => buildScene(t.actors, adultPhotoOf(t), "Watch what happens!"),
    choices: ["Next"],
    button_html: '<button class="jspsych-btn" disabled>%choice%</button>',
    data: { name: "adult_affiliation", condition: t.condition },
    on_load: async () => {
      const btn = document.querySelector(".jspsych-btn");
      // LEFT actor acts first (constant). But affiliation always goes to non-shared,
      // so we sequence by role and respect the constant via ordering of the two actors.
      const first = t.actors[0], firstSide = "lc-left";
      const second = t.actors[1], secondSide = "lc-right";
      for (const [actor, side] of [[first, firstSide], [second, secondSide]]) {
        if (actor.role === "nonshared") {
          setSpeech("🎵 They sing together! 🎵");
          anim(side, "lc-singing"); anim("lc-adult-node", "lc-singing");
          await wait(playMelody());
          stop(side, "lc-singing"); stop("lc-adult-node", "lc-singing");
        } else {
          setSpeech('The grown-up turns away… "Hmph!"');
          anim(side, "lc-talking");
          await wait(1500);
          stop(side, "lc-talking");
        }
        setSpeech(""); await wait(400);
      }
      if (btn) btn.disabled = false;
    },
  };
}

// Language manipulation check (with up to MAX_CHECK_REPEATS retries).
function languageCheck(t) {
  const target = nonsharedOf(t); // ask about the non-shared phrase
  const leftFirst = t.actors[0];
  return {
    timeline: [{
      type: jsPsychHtmlButtonResponse,
      stimulus: () => buildScene(t.actors, adultPhotoOf(t),
        `Which character said this?<br><i>"${LANGUAGES[target.lang].phrase}"</i>`),
      choices: () => t.actors.map((a) => `the ${a.color.name} one`),
      data: { name: "lang_check", condition: t.condition,
              correct_color: target.color.name },
      on_finish: (d) => {
        d.chosen_color = t.actors[d.response].color.name;
        d.correct = d.chosen_color === target.color.name;
      },
    }],
    loop_function: (data) => {
      const last = data.values()[data.values().length - 1];
      last.attempt = (last.attempt || 0); // jsPsych re-runs; cap via count below
      const attempts = jsPsych.data.get().filter({ name: "lang_check", condition: t.condition }).count();
      return !last.correct && attempts < CONFIG.MAX_CHECK_REPEATS;
    },
  };
}

// Adult manipulation check: which one did the adult like? (non-shared = correct)
function adultCheck(t) {
  const target = nonsharedOf(t);
  const who = t.condition === "caregiver" ? "your grown-up" : "the grown-up";
  return {
    type: jsPsychHtmlButtonResponse,
    stimulus: () => buildScene(t.actors, adultPhotoOf(t), `Which one did <b>${who}</b> like?`),
    choices: () => t.actors.map((a) => `the ${a.color.name} one`),
    data: { name: "adult_check", condition: t.condition, correct_color: target.color.name },
    on_finish: (d) => {
      d.chosen_color = t.actors[d.response].color.name;
      d.correct = d.chosen_color === target.color.name;
    },
  };
}

// DV block: friend choice -> why -> languages-count for each.
function dvBlock(t) {
  const tl = [];
  tl.push({
    type: jsPsychHtmlButtonResponse,
    stimulus: () => buildScene(t.actors, adultPhotoOf(t), "Whom would <b>you</b> like to have as your friend?"),
    choices: () => t.actors.map((a) => `the ${a.color.name} one`),
    data: { name: "dv_friend", condition: t.condition },
    on_finish: (d) => {
      const chosen = t.actors[d.response];
      d.chosen_color = chosen.color.name;
      d.chosen_role = chosen.role;                 // 'shared' | 'nonshared'
      d.chose_shared = chosen.role === "shared";   // primary 0/1 DV
    },
  });
  tl.push({
    type: jsPsychSurveyText,
    questions: [{ prompt: "Why is that? (Grown-up, please type what your child says.)",
                  rows: 2, columns: 50, name: "why" }],
    data: { name: "dv_why", condition: t.condition },
  });
  // exploratory: how many languages does each speaker know
  for (const a of t.actors) {
    tl.push({
      type: jsPsychHtmlButtonResponse,
      stimulus: () => buildScene(t.actors, adultPhotoOf(t),
        `How many languages do you think the <b>${a.color.name}</b> one can speak?`),
      choices: ["1", "2", "3 or more"],
      data: { name: "dv_numlang", condition: t.condition,
              about_color: a.color.name, about_role: a.role },
      on_finish: (d) => { d.num_languages = ["1", "2", "3+"][d.response]; },
    });
  }
  return tl;
}

// Assemble one full condition trial, honoring familiarization order.
function buildConditionTrial(t) {
  const langPair  = [languageFamiliarization(t), languageCheck(t)];
  const adultPair = [adultStory(t), adultSinging(t), adultCheck(t)];
  // pre-reg orderings: fam blocks first (in famOrder), each followed by its check,
  // matching the two listed sequences; DV always last.
  const intro = {
    type: jsPsychHtmlButtonResponse,
    stimulus: `<h2>${t.condition === "caregiver" ? "Meet these characters!" : "Now, some new characters!"}</h2>
               <p style="font-size:20px;">Watch carefully. 🎬</p>`,
    choices: ["Let's go"],
    data: { name: "trial_intro", condition: t.condition },
  };
  const ordered = t.famOrder === "language"
    ? [...langPair, ...adultPair]
    : [...adultPair, ...langPair];
  return [intro, ...ordered, ...dvBlock(t)];
}

// push both condition trials
for (const t of TRIALS) timeline.push(...buildConditionTrial(t));

// ---- 7d. Debrief ----------------------------------------------------
timeline.push({
  type: jsPsychFullscreen,
  fullscreen_mode: false,
  message: `<p>All done!</p>`,
  button_label: "Continue",
});
timeline.push({
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <h1>You did it! 🎉</h1>
    <p style="font-size:18px;max-width:620px;margin:auto;">Thank you so much for playing!</p>
    <p style="font-size:16px;color:var(--muted);max-width:620px;margin:auto;">
      <b>For grown-ups:</b> this study looks at whether 4–5 year olds prefer a character who
      speaks their own language, or one their caregiver is friends with. Each character spoke
      English, French, or Hindi.</p>`,
  choices: ["Finish"],
  data: { name: "debrief" },
});

/* ===================================================================
   8. AUDIO PLAYBACK (optional recorded narration) + SAVE
   =================================================================== */
function playClip(src) {
  // Optional: plays a recorded clip if the file exists; silent no-op otherwise.
  try { const a = new Audio(src); a.play().catch(() => {}); } catch (e) {}
}

async function saveData() {
  const payload = jsPsych.data.get().json();
  if (CONFIG.SAVE_URL) {
    try {
      await fetch(CONFIG.SAVE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pid: PARTICIPANT.id, data: JSON.parse(payload) }),
      });
      return;
    } catch (e) { /* fall through to download */ }
  }
  // Fallback: download a JSON file locally.
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `langcare_${PARTICIPANT.id}.json`; a.click();
  URL.revokeObjectURL(url);
}

/* ===================================================================
   9. RUN
   =================================================================== */
jsPsych.run(timeline);
