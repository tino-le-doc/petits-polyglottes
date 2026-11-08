// ===== État =====
const S = { lang: null, theme: null, mode: null, idx: 0, tries: 0, stars: 0, done: false };
const $ = id => document.getElementById(id);
const wait = ms => new Promise(r => setTimeout(r, ms));

try { S.stars = parseInt(localStorage.getItem("pp-stars") || "0", 10) || 0; } catch (e) {}
$("stars").textContent = S.stars;

function addStar(n = 1) {
  S.stars += n;
  $("stars").textContent = S.stars;
  try { localStorage.setItem("pp-stars", S.stars); } catch (e) {}
}

// ===== Navigation =====
function show(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  $(id).classList.add("active");
  if (id !== "screen-play") stopCoach();
}
document.querySelectorAll("[data-go]").forEach(b => b.onclick = () => show(b.dataset.go));

document.querySelectorAll("[data-lang]").forEach(b => b.onclick = () => {
  S.lang = b.dataset.lang;
  const L = LANGS[S.lang];
  $("theme-title").textContent = `${L.flag} ${L.name} : choisis un thème`;
  $("themes").innerHTML = "";
  L.themes.forEach(t => {
    const btn = document.createElement("button");
    btn.className = "big-btn";
    btn.innerHTML = `<span>${t.emoji}</span>${t.name}`;
    btn.onclick = () => { S.theme = t; $("mode-title").textContent = `${t.emoji} ${t.name} — que veux-tu faire ?`; show("screen-mode"); };
    $("themes").appendChild(btn);
  });
  show("screen-theme");
});

document.querySelectorAll("[data-mode]").forEach(b => b.onclick = () => {
  S.mode = b.dataset.mode;
  S.idx = 0;
  show("screen-play");
  renderItem();
  // Le clic sur l'activité sert aussi d'autorisation pour le son : on démarre tout de suite.
  if (isVoiceMode()) startWithMic();
});

const isVoiceMode = () => S.mode === "speak" || S.mode === "talk";
const items = () => S.mode === "talk" ? DIALOGS[S.lang] : S.theme.words;
const current = () => items()[S.idx];

$("btn-next").onclick = () => goTo(S.idx + 1);
$("btn-prev").onclick = () => goTo(S.idx - 1);

function goTo(i) {
  if (i < 0) return;
  const wasRunning = coachRunning;
  stopCoach();
  if (i >= items().length) { finishTheme(); return; }
  S.idx = i;
  renderItem();
  if (wasRunning) startCoach();
}

function finishTheme() {
  celebrate();
  feedback("good", `<div class="big">🏆 Terminé !</div>Bravo, tu as tout fait. Choisis une autre activité !`);
  sayFr("Bravo, tu as tout terminé ! Tu peux choisir une autre activité.");
  setTimeout(() => show("screen-mode"), 3500);
}

// ===== Affichage =====
function renderItem() {
  const w = current();
  S.tries = 0; S.done = false;
  $("progress-bar").style.width = `${((S.idx + 1) / items().length) * 100}%`;
  $("feedback").innerHTML = "";
  $("chat").innerHTML = "";
  $("status").textContent = "";
  $("status").className = "status";
  $("voice-zone").classList.toggle("hidden", !isVoiceMode());
  $("write-zone").classList.toggle("hidden", S.mode !== "write");
  $("emoji").textContent = w.e;

  if (S.mode === "talk") {
    $("word").textContent = w.q;
    $("fr").textContent = w.qfr;
    $("hint").textContent = "Le robot te pose une question : réponds-lui à voix haute !";
    return;
  }
  $("fr").textContent = w.fr;
  if (S.mode === "write") {
    $("word").textContent = maskWord(w.w);
    $("hint").textContent = "Écoute bien et écris le mot 👂✍️";
    $("answer").value = "";
    $("accents").innerHTML = "";
    (LANGS[S.lang].accents || []).forEach(a => {
      const b = document.createElement("button");
      b.textContent = a;
      b.onclick = () => insertAtCursor($("answer"), a);
      $("accents").appendChild(b);
    });
    setTimeout(() => $("answer").focus(), 50);
    setTimeout(() => say(w.w), 300);
  } else {
    $("word").textContent = w.w;
    $("hint").textContent = `Ça se dit : « ${w.p} »`;
    if (S.mode === "listen") setTimeout(() => say(w.w), 300);
  }
}

function maskWord(word) {
  return [...word].map(c => /[a-záéíóúñü]/i.test(c) ? "_" : c).join(" ");
}

function insertAtCursor(input, text) {
  const s = input.selectionStart ?? input.value.length, e = input.selectionEnd ?? input.value.length;
  input.value = input.value.slice(0, s) + text + input.value.slice(e);
  input.focus();
  input.setSelectionRange(s + text.length, s + text.length);
}

function feedback(kind, html) {
  $("feedback").innerHTML = `<div class="box ${kind}">${html}</div>`;
}

// ===== Voix de l'application =====
let voices = [];
function loadVoices() { voices = speechSynthesis.getVoices(); }
if ("speechSynthesis" in window) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }

function pickVoice(lang) {
  const prefix = lang.slice(0, 2);
  return voices.find(v => v.lang.replace("_", "-") === lang) || voices.find(v => v.lang.startsWith(prefix));
}

// Parle et attend la fin de la phrase (Promise).
function speak(text, lang, rate = 0.9) {
  return new Promise(resolve => {
    if (!("speechSynthesis" in window)) return resolve();
    const u = new SpeechSynthesisUtterance(text.replace(/[¿¡«»]/g, ""));
    u.lang = lang;
    const v = pickVoice(lang);
    if (v) u.voice = v;
    u.rate = rate;
    u.pitch = 1.1;
    let done = false;
    const end = () => { if (!done) { done = true; resolve(); } };
    u.onend = end; u.onerror = end;
    // Sécurité : certains navigateurs n'envoient jamais "onend".
    setTimeout(end, 2500 + text.length * 120 / rate);
    speechSynthesis.speak(u);
  });
}
const say = (text, slow = false) => { speechSynthesis.cancel(); return speak(text, LANGS[S.lang].voiceLang, slow ? 0.5 : 0.85); };
const sayL = (text, slow = false) => speak(text, LANGS[S.lang].voiceLang, slow ? 0.5 : 0.85);   // dans la langue apprise
const sayFr = text => speak(text, "fr-FR", 1);                                                     // consignes en français

$("btn-play").onclick = () => say(S.mode === "talk" ? current().q : current().w);
$("btn-slow").onclick = () => say(S.mode === "talk" ? current().q : current().w, true);

// ===== Comparaison de textes =====
const DIGITS = {
  en: { 1: "one", 2: "two", 3: "three", 4: "four", 5: "five", 6: "six", 7: "seven", 8: "eight", 9: "nine", 10: "ten" },
  es: { 1: "uno", 2: "dos", 3: "tres", 4: "cuatro", 5: "cinco", 6: "seis", 7: "siete", 8: "ocho", 9: "nueve", 10: "diez" },
};
const HOMOPHONES = { en: { to: "two", too: "two", for: "four", won: "one", "i'm": "i am" }, es: {} };

function stripAccents(s) { return s.normalize("NFD").replace(/[̀-ͯ]/g, ""); }
function clean(s) { return s.toLowerCase().replace(/[¿?¡!.,;:"]/g, "").replace(/\s+/g, " ").trim(); }
function normalizeSpeech(s) {
  return stripAccents(clean(s).split(" ").map(x => DIGITS[S.lang][x] || HOMOPHONES[S.lang][x] || x).join(" "));
}

function levTable(a, b, cmp = (x, y) => x === y) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (cmp(a[i - 1], b[j - 1]) ? 0 : 1));
  return d;
}
function similarity(a, b) {
  if (!a.length && !b.length) return 1;
  return 1 - levTable([...a], [...b])[[...a].length][[...b].length] / Math.max([...a].length, [...b].length);
}

// Colorie chaque lettre du mot attendu : verte si juste, rouge si fausse ou manquante.
function letterDiff(expected, given) {
  const a = [...expected], b = [...given], d = levTable(a, b);
  const out = [];
  let i = a.length, j = b.length;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)) {
      out.unshift({ c: a[i - 1], k: a[i - 1] === b[j - 1] ? "ok" : "ko" }); i--; j--;
    } else if (i > 0 && d[i][j] === d[i - 1][j] + 1) {
      out.unshift({ c: a[i - 1], k: "miss" }); i--;
    } else { j--; }
  }
  return out.map(o => o.c === " " ? " " : `<span class="${o.k}">${o.c}</span>`).join("");
}

function tipsFor(word) {
  return TIPS[S.lang].filter(t => t.test(word.toLowerCase())).slice(0, 2).map(t => t.tip);
}
const tipToSpeech = t => t.replace(/^\S+\s/, "").replace(/« /g, '"').replace(/ »/g, '"');

// Évalue la prononciation d'un mot à partir de ce que le micro a compris.
function evaluate(word, alts) {
  const target = normalizeSpeech(word);
  let best = -1;
  alts.forEach((alt, i) => {
    const n = normalizeSpeech(alt);
    let s = (n === target || (" " + n + " ").includes(" " + target + " ")) ? 1 : similarity(target, n);
    // Seule la 1re interprétation du micro compte comme "parfait" : si le bon mot n'arrive
    // qu'en 2e choix, la prononciation n'était pas encore assez claire → "presque".
    if (i > 0) s = Math.min(s, 0.9);
    best = Math.max(best, s);
  });
  return { score: best, heard: alts[0] || "", diff: letterDiff(stripAccents(clean(word)), normalizeSpeech(alts[0] || "")) };
}

// Découpe un mot espagnol en syllabes (règles simples).
function syllablesEs(word) {
  const V = "aeiouáéíóúü";
  const keep = ["pr", "br", "tr", "dr", "cr", "gr", "fr", "pl", "bl", "cl", "gl", "fl", "ch", "ll", "rr", "qu"];
  const w = word.toLowerCase();
  const groups = w.match(new RegExp(`[^${V}]+|[${V}]+`, "g")) || [w];
  const syl = [];
  let cur = "";
  for (let k = 0; k < groups.length; k++) {
    const g = groups[k], isV = V.includes(g[0]);
    if (isV) { cur += g; continue; }
    if (!cur || k === groups.length - 1) { cur += g; continue; }   // consonnes au début ou à la fin
    let split;
    if (g.length === 1) split = 0;
    else if (keep.includes(g.slice(-2))) split = g.length - 2;
    else split = g.length - 1;
    cur += g.slice(0, split); syl.push(cur); cur = g.slice(split);
  }
  if (cur) syl.push(cur);
  return syl;
}

// ===== Micro : écoute une réponse (Promise) =====
const Reco = window.SpeechRecognition || window.webkitSpeechRecognition;
let reco = null;

function listen() {
  return new Promise(resolve => {
    reco = new Reco();
    reco.lang = LANGS[S.lang].recoLang;
    reco.interimResults = false;
    reco.maxAlternatives = 5;
    let result = null;
    reco.onresult = e => { result = { alts: [...e.results[0]].map(r => r.transcript) }; };
    reco.onerror = e => { result = result || { error: e.error }; };
    reco.onend = () => resolve(result || { error: "no-speech" });
    try { reco.start(); } catch (e) { resolve({ error: "start" }); }
  });
}

// ===== Coach vocal : le dialogue =====
let coachRunning = false, runId = 0;

function setStatus(text, listening = false) {
  $("status").textContent = text;
  $("status").className = "status" + (listening ? " listen" : "");
}
function bubble(who, html, cls = "") {
  const b = document.createElement("div");
  b.className = `bubble ${who} ${cls}`;
  b.innerHTML = (who === "bot" ? "🤖 " : "🧒 ") + html;
  $("chat").appendChild(b);
  $("chat").scrollTop = $("chat").scrollHeight;
}
// Le robot parle : bulle + voix. fr = consigne en français, tl = texte dans la langue apprise.
async function bot(fr, tl, slow = false) {
  bubble("bot", (fr || "") + (tl ? ` <span class="tl">${tl}</span>` : ""));
  if (fr) await sayFr(fr);
  if (tl) await sayL(tl, slow);
}

// Empêche l'écran du téléphone de s'éteindre pendant le dialogue.
let wakeLock = null;
async function keepScreenOn() {
  try { if ("wakeLock" in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request("screen"); wakeLock.onrelease = () => { wakeLock = null; }; } } catch (e) {}
}
// Si l'enfant change d'appli ou éteint l'écran, on met le dialogue en pause.
document.addEventListener("visibilitychange", () => { if (document.hidden && coachRunning) stopCoach(); });

function stopCoach() {
  runId++;
  if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
  coachRunning = false;
  if ("speechSynthesis" in window) speechSynthesis.cancel();
  if (reco) { try { reco.abort(); } catch (e) {} }
  $("btn-coach").textContent = "▶ On continue !";
  $("btn-coach").classList.remove("running");
  setStatus("");
}

function startCoach() {
  if (!Reco) {
    feedback("bad", "😢 Ton navigateur ne sait pas écouter.<br>Ouvre l'application avec <b>Google Chrome</b> ou <b>Microsoft Edge</b>.");
    return;
  }
  if (!window.isSecureContext) {
    feedback("bad", "🔒 Le micro ne marche que sur une adresse sécurisée (https://…). Ouvre l'application depuis son lien internet.");
    return;
  }
  stopCoach();
  coachRunning = true;
  keepScreenOn();
  $("btn-coach").textContent = "⏸ Pause";
  $("btn-coach").classList.add("running");
  const id = runId;
  (S.mode === "talk" ? talkLoop(id) : repeatLoop(id)).catch(e => console.error(e));
}
$("btn-coach").onclick = () => coachRunning ? stopCoach() : startWithMic();

// ===== Autorisation du micro =====
// Sur Android, Chrome ne montre la demande d'autorisation que si elle part directement
// d'un toucher de l'enfant. On la demande donc tout de suite, avant que le robot parle.
let micOk = false;
const isAndroid = /android/i.test(navigator.userAgent);

function micHelp(kind) {
  const android = `<ol style="text-align:left;margin:8px 0 0 0;padding-left:22px">
      <li>Ouvre les <b>Paramètres</b> du téléphone → <b>Applications</b> → <b>Chrome</b> → <b>Autorisations</b> → <b>Micro</b> → <b>Autoriser</b>.</li>
      <li>Fais pareil pour l'application <b>Google</b> (c'est elle qui comprend la voix).</li>
      <li>Dans Chrome : menu ⋮ → <b>Paramètres</b> → <b>Paramètres des sites</b> → <b>Micro</b> : vérifie que <b>tino-le-doc.github.io</b> n'est pas bloqué.</li>
      <li>Reviens ici et appuie sur <b>▶</b>.</li></ol>`;
  const desktop = "Clique sur le cadenas à côté de l'adresse du site et autorise le micro, puis appuie sur ▶.";
  if (kind === "service") {
    return `🎤 Le micro marche, mais la reconnaissance de la voix est indisponible.<br>` +
      (isAndroid ? "Vérifie que l'application <b>Google</b> est installée, à jour, et qu'elle a le droit d'utiliser le micro. Il faut aussi Internet." : "Utilise Google Chrome ou Microsoft Edge, avec Internet.");
  }
  if (kind === "none") return "🎤 Je ne trouve aucun micro sur cet appareil.";
  return `🎤 Je n'ai pas le droit d'utiliser le micro.${isAndroid ? android : "<br>" + desktop}`;
}

async function startWithMic() {
  if (!micOk && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());   // on libère le micro pour la reconnaissance vocale
      micOk = true;
    } catch (e) {
      stopCoach();
      feedback("bad", micHelp(e.name === "NotFoundError" ? "none" : "denied"));
      return;
    }
  }
  startCoach();
}

// Écoute l'enfant ; gère le silence et les erreurs de micro. Renvoie les alternatives ou null.
async function hearKid(id) {
  let silences = 0;
  while (true) {
    // Petite pause : sur téléphone, le micro entendrait sinon la fin de la voix du robot.
    await wait(350);
    if (id !== runId) return null;
    setStatus("🎤 À toi ! Je t'écoute…", true);
    const r = await listen();
    if (id !== runId) return null;
    setStatus("");
    if (r.alts) return r.alts;
    if (r.error === "not-allowed") { micOk = false; feedback("bad", micHelp("denied")); stopCoach(); return null; }
    if (r.error === "service-not-allowed" || r.error === "language-not-supported") { feedback("bad", micHelp("service")); stopCoach(); return null; }
    if (r.error === "network") { feedback("bad", "🌐 Il faut être connecté à Internet pour que je t'écoute."); stopCoach(); return null; }
    if (r.error === "audio-capture") { feedback("bad", "🎤 Je ne trouve pas de micro. Est-il bien branché ?"); stopCoach(); return null; }
    if (r.error === "aborted") return null;
    silences++;
    if (silences >= 3) { await bot("Je fais une petite pause. Appuie sur le bouton quand tu veux continuer !"); stopCoach(); return null; }
    await bot("Je ne t'ai pas entendu. Parle un peu plus fort, près du micro !");
    if (id !== runId) return null;
  }
}

const BRAVO = ["Bravo !", "Super !", "Parfait !", "Génial !", "Excellent !", "Trop fort !"];
const pick = a => a[Math.floor(Math.random() * a.length)];

// Mode « Répète après moi »
async function repeatLoop(id) {
  while (id === runId && S.idx < items().length) {
    const w = current();
    let tries = 0;
    await bot("Répète après moi :", w.w);
    while (id === runId) {
      const alts = await hearKid(id);
      if (!alts || id !== runId) return;
      const r = evaluate(w.w, alts);
      if (r.score >= 0.999) {
        bubble("kid", `« ${r.heard} »`, "ok");
        if (!S.done) addStar();
        S.done = true;
        celebrate();
        await bot(`${pick(BRAVO)} Tu as très bien dit`, w.w);
        break;
      }
      tries++;
      bubble("kid", `« ${r.heard} » <div class="letters">${r.diff}</div>`, "ko");
      const tips = tipsFor(w.w);
      if (tries === 1) {
        await bot(r.score >= 0.6 ? "Presque ! J'ai entendu :" : "Oh, j'ai entendu :", r.heard);
        if (id !== runId) return;
        if (tips[0]) await bot(tipToSpeech(tips[0]));
        if (id !== runId) return;
        await bot("Écoute bien, je le dis doucement :", w.w, true);
      } else if (tries === 2) {
        await bot("On va le dire en petits morceaux. Écoute :");
        if (id !== runId) return;
        const parts = w.w.includes(" ") ? w.w.split(" ") : (S.lang === "es" ? syllablesEs(w.w) : null);
        if (parts && parts.length > 1) {
          for (const p of parts) { if (id !== runId) return; await bot("", p, true); await wait(300); }
        } else {
          await bot(`Ça ressemble un peu à : ${w.p.replace(/\(.*\)/, "")}`);
        }
        if (id !== runId) return;
        await bot("Et maintenant le mot entier :", w.w, true);
      } else {
        await bot("Tu as fait de gros efforts, bravo pour ton courage ! On s'entraînera encore. On passe au mot suivant.");
        break;
      }
      if (id !== runId) return;
      await bot("À toi, répète !");
    }
    if (id !== runId) return;
    await wait(500);
    if (S.idx + 1 >= items().length) { stopCoach(); finishTheme(); return; }
    S.idx++;
    renderItem();
  }
}

// Mode « Discuter »
async function talkLoop(id) {
  if (S.idx === 0) {
    await bot(`Bonjour ! Je suis ton robot ${LANGS[S.lang].name.toLowerCase()}. Je vais te poser des questions, réponds-moi à voix haute !`);
  }
  while (id === runId && S.idx < items().length) {
    const d = current();
    let tries = 0;
    await bot("", d.q);
    while (id === runId) {
      const alts = await hearKid(id);
      if (!alts || id !== runId) return;
      const answers = alts.map(normalizeSpeech);
      const good = answers.find(a => d.ok.some(rx => rx.test(a)));
      if (good !== undefined) {
        bubble("kid", `« ${alts[answers.indexOf(good)]} »`, "ok");
        if (!S.done) addStar();
        S.done = true;
        celebrate();
        await bot("", d.reply);
        if (id !== runId) return;
        await bot(pick(BRAVO) + " Tu m'as très bien répondu.");
        break;
      }
      tries++;
      bubble("kid", `« ${alts[0]} »`, "ko");
      if (tries === 1) {
        await bot(`J'ai entendu « ${alts[0]} », mais ce n'est pas tout à fait la réponse. Je t'aide : tu peux dire`, d.model);
        if (id !== runId) return;
        await bot(`Ça veut dire : ${d.modelfr} Écoute doucement :`, d.model, true);
      } else if (tries === 2) {
        await bot("Ce n'est pas grave ! On le dit en morceaux. Répète chaque mot dans ta tête :");
        for (const p of d.model.replace(/[¡!¿?.,]/g, "").split(" ")) { if (id !== runId) return; await bot("", p, true); await wait(200); }
        if (id !== runId) return;
        await bot("Et maintenant la phrase entière :", d.model);
      } else {
        await bot("Bien essayé ! Tu progresses. On passe à la question suivante.");
        break;
      }
      if (id !== runId) return;
      await bot("À toi ! Je repose la question :", d.q);
    }
    if (id !== runId) return;
    await wait(500);
    if (S.idx + 1 >= items().length) { stopCoach(); finishTheme(); return; }
    S.idx++;
    renderItem();
  }
}

// ===== Écriture (dictée) =====
$("btn-check").onclick = checkWriting;
$("answer").addEventListener("keydown", e => { if (e.key === "Enter") checkWriting(); });

function checkWriting() {
  const w = current();
  const given = clean($("answer").value);
  if (!given) { feedback("almost", "✏️ Écris d'abord le mot ! Appuie sur 🔊 pour l'entendre."); return; }
  const target = clean(w.w);
  S.tries++;

  if (given === target) {
    if (!S.done) addStar();
    S.done = true;
    $("word").textContent = w.w;
    celebrate();
    feedback("good", `<div class="big">🎉 Bravo !</div>« <b>${w.w}</b> » est parfaitement écrit ! +1 ⭐`);
    say(w.w);
    return;
  }

  if (stripAccents(given) === stripAccents(target)) {
    feedback("almost", `<div class="big">😊 Presque !</div>Les lettres sont justes, mais attention aux <b>accents</b> !
      <div class="letters">${letterDiff(target, given)}</div>`);
    return;
  }

  if (S.tries >= 2) {
    $("word").textContent = w.w;
    feedback("bad", `Tu as écrit : <b>« ${given} »</b><br>Voici la bonne réponse (en rouge, les lettres à corriger) :
      <div class="letters">${letterDiff(target, given)}</div>Recopie-le pour t'entraîner, puis clique sur Vérifier !`);
  } else {
    const score = similarity(target, given);
    feedback(score >= 0.6 ? "almost" : "bad",
      `<div class="big">${score >= 0.6 ? "😊 Presque !" : "🙈 Pas tout à fait…"}</div>
       Tu as écrit : <b>« ${given} »</b><br>Le mot a <b>${[...target].length}</b> lettres. Il commence par « <b>${[...target][0]}</b> ».
       <br>🔊 Écoute encore et réessaie !`);
    setTimeout(() => say(w.w, true), 400);
  }
}

// ===== Confettis =====
function celebrate() {
  const box = $("confetti");
  const emo = ["⭐", "🎉", "✨", "🌟", "🎈"];
  for (let i = 0; i < 25; i++) {
    const el = document.createElement("i");
    el.textContent = emo[i % emo.length];
    el.style.left = Math.random() * 100 + "vw";
    el.style.animationDelay = Math.random() * 0.5 + "s";
    box.appendChild(el);
    setTimeout(() => el.remove(), 2300);
  }
}
