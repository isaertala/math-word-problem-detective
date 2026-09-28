/* ============ CONFIG ============ */
const PAGES = ['home','auth','practice','olympiad','schedule','why','rankings','merch','contact','terms','privacy'];
const NAV_ITEMS = [
  {id:'home', label:'📖 CLUES Method'},
  {id:'why', label:'🧠 Why It Matters'},
  {id:'olympiad', label:'🏅 Championship'},
  {id:'schedule', label:'📅 Schedule'},
  {id:'rankings', label:'🏆 Rankings'},
  {id:'merch', label:'🛍️ Merch'},
];
const EXAM_COUNT = 100;
const EXAM_PER_PAGE = 10;
const PRACTICE_COUNT = 12;
const COUNTRIES = ["United States","Canada","United Kingdom","Australia","Singapore","India","Philippines","Malaysia","New Zealand","Ireland","South Africa","Nigeria","Germany","France","Spain","Netherlands","UAE","Japan","South Korea","Brazil","Mexico","Other"];
// Continental grouping using real continents (Antarctica omitted — no participants expected there).
const CONTINENT_GROUPS = {
  'Africa': ["South Africa","Nigeria"],
  'Asia': ["Singapore","India","Philippines","Malaysia","Japan","South Korea","UAE"],
  'Europe': ["United Kingdom","Ireland","Germany","France","Spain","Netherlands"],
  'North America': ["United States","Canada","Mexico"],
  'South America': ["Brazil"],
  'Oceania': ["Australia","New Zealand"],
  'Other': ["Other"],
};
function countryToContinent(country) {
  for (const [cont, list] of Object.entries(CONTINENT_GROUPS)) {
    if (list.includes(country)) return cont;
  }
  return 'Other';
}

// Eligibility is based purely on self-selected Age Group (chosen at signup) — not school grade.
// Participants may join their own age group's division or any harder division above it, never an easier one below.
// Grand Master Division has no upper age limit — adults are welcome to keep competing forever.
// Season runs July (month 7) through November (month 11) — one division opens per month.
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const LEVELS = [
  {id:1, name:'Rookie Division',      emoji:'🐣', ageRange:'Ages 3–8',   desc:'Addition & Subtraction', month:7,  types:[0,1],             diffBase:0, feeUSD:5,  minAge:3,  maxAge:8},
  {id:2, name:'Explorer Division',    emoji:'🧭', ageRange:'Ages 9–11',  desc:'Addition, Subtraction, Multiplication & Division', month:8,  types:[0,1,2,3],         diffBase:1, feeUSD:7,  minAge:9,  maxAge:11},
  {id:3, name:'Strategist Division',  emoji:'♟️', ageRange:'Ages 12–15', desc:'Addition, Subtraction, Multiplication, Division, Two-Step & Container Cases', month:9,  types:[0,1,2,3,4],       diffBase:2, feeUSD:9,  minAge:12, maxAge:15},
  {id:4, name:'Master Division',      emoji:'🎓', ageRange:'Ages 16–18', desc:'Addition, Subtraction, Multiplication, Division, Two-Step, Container, Trick & No-Keyword Cases', month:10, types:[0,1,2,3,4,5,6],   diffBase:3, feeUSD:12, minAge:16, maxAge:18},
  {id:5, name:'Grand Master Division',emoji:'👑', ageRange:'Ages 19+', desc:'Every case type at maximum difficulty — Addition, Subtraction, Multiplication, Division, Two-Step, Container, Trick & No-Keyword Cases', month:11, types:[0,1,2,3,4,5,6], diffBase:4, feeUSD:15, minAge:19, maxAge:null},
];
// Computes age in whole years from a YYYY-MM-DD date-of-birth string, accounting for month/day (not just year subtraction).
function computeAge(dobString) {
  const dob = new Date(dobString);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}
// Maps a date of birth to the division id whose age range it falls into (division is fully automatic — no manual selection).
function ageGroupIdFromDOB(dobString) {
  const age = computeAge(dobString);
  for (const l of LEVELS) {
    if (age >= l.minAge && (l.maxAge == null || age <= l.maxAge)) return l.id;
  }
  return age < LEVELS[0].minAge ? LEVELS[0].id : LEVELS[LEVELS.length - 1].id;
}

/* ============ STATE ============ */
let currentUser = null; // {email, firstName, lastName, name, country, city, ageGroupId}
let usersDB = {};
let progressDB = {};
let practiceLevel = null;
let practiceProblems = [];
let activeLevel = null;
let examProblems = [];
let examAnswers = {};
let examPageIdx = 0;
let examStartTime = null;
let rankLevelId = 1;
let rankYear = getYear();
let rankScope = 'global';

/* ============ SEEDED PROBLEM GENERATOR ============ */
function mulberry32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function randInt(rng, min, max) { return Math.floor(rng() * (max - min + 1)) + min; }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

const NAMES = ["Maya","Liam","Ana","Jack","Mia","Sam","Ella","Noah","Zoe","Leo","Ivy","Kai","Ruby","Max","Nina"];
const ITEMS = ["stickers","marbles","apples","pencils","cookies","balloons","toy cars","books","stamps","oranges","shells","crayons"];
const CONTAINERS = [["box","boxes"],["basket","baskets"],["bag","bags"],["jar","jars"],["shelf","shelves"],["crate","crates"]];
const COLORS = ["red","blue","green","yellow","purple","orange"];

function genProblem(rng, index, typePool, diffBase) {
  const tier = diffBase + Math.floor(index / 20);
  const type = typePool[index % typePool.length];
  const item = pick(rng, ITEMS);
  const name = pick(rng, NAMES);
  let a, b, text, answer;

  if (type === 0) {
    a = randInt(rng, 3 + tier*5, 12 + tier*10);
    b = randInt(rng, 3 + tier*5, 12 + tier*10);
    text = `${name} has ${a} ${item}. Then finds ${b} more ${item}. How many ${item} does ${name} have in all?`;
    answer = a + b;
  } else if (type === 1) {
    a = randInt(rng, 10 + tier*5, 25 + tier*10);
    b = randInt(rng, 2, a - 1);
    text = `${name} has ${a} ${item}. ${name} gives away ${b} ${item}. How many ${item} does ${name} have left?`;
    answer = a - b;
  } else if (type === 2) {
    const [csing, cplur] = pick(rng, CONTAINERS);
    a = randInt(rng, 2 + tier, 6 + tier*2);
    b = randInt(rng, 2 + tier, 9 + tier*2);
    text = `There are ${a} ${cplur}. Each ${csing} has ${b} ${item}. How many ${item} are there in total?`;
    answer = a * b;
  } else if (type === 3) {
    const friends = randInt(rng, 2 + tier, 6 + tier);
    const each = randInt(rng, 2 + tier, 8 + tier*2);
    const total = friends * each;
    text = `${total} ${item} are shared equally among ${friends} friends. How many ${item} does each friend get?`;
    answer = each;
  } else if (type === 4) {
    const others = NAMES.filter(n => n !== name);
    const name2 = pick(rng, others);
    a = randInt(rng, 3 + tier*3, 10 + tier*6);
    const diff = randInt(rng, 2, 6 + tier*2);
    const bTotal = a + diff;
    text = `${name} has ${a} ${item}. ${name2} has ${diff} more ${item} than ${name}. How many ${item} do they have altogether?`;
    answer = a + bTotal;
  } else if (type === 5) {
    const c1 = pick(rng, COLORS);
    let c2 = pick(rng, COLORS);
    while (c2 === c1) c2 = pick(rng, COLORS);
    a = randInt(rng, 3 + tier*4, 14 + tier*8);
    b = randInt(rng, 3 + tier*4, 14 + tier*8);
    if (rng() < 0.5) {
      text = `There are ${a} ${c1} ${item} and ${b} ${c2} ${item} in a bin. How many ${item} are in the bin?`;
      answer = a + b;
    } else {
      const total = a + b;
      text = `A jar had ${total} ${item} in it. Someone took out ${a} ${item}. How many ${item} are in the jar now?`;
      answer = total - a;
    }
  } else if (type === 6) {
    const others = NAMES.filter(n => n !== name);
    const name2 = pick(rng, others);
    const smaller = randInt(rng, 4 + tier*3, 14 + tier*6);
    const maxDiff = Math.max(2, Math.min(smaller - 1, 6 + tier*2));
    const diff = randInt(rng, 2, maxDiff);
    a = smaller + diff;
    text = `${name} has ${a} ${item}. ${name} has ${diff} more ${item} than ${name2}. How many ${item} does ${name2} have?`;
    answer = a - diff;
  }
  return { text, answer };
}
function buildPracticeProblems(levelId) {
  const level = LEVELS.find(l => l.id === levelId);
  const rng = mulberry32(999 + levelId);
  return Array.from({length: PRACTICE_COUNT}, (_, i) => genProblem(rng, i, level.types, level.diffBase));
}
function buildExamProblems(levelId, year) {
  const level = LEVELS.find(l => l.id === levelId);
  const rng = mulberry32(year*10 + levelId);
  return Array.from({length: EXAM_COUNT}, (_, i) => genProblem(rng, i, level.types, level.diffBase));
}

/* ============ TIME / SEASON / GRADE HELPERS ============ */
function getYear() { return new Date().getFullYear(); }
function getMonth() { return new Date().getMonth() + 1; } // 1-12
function levelStatus(levelObj) {
  const m = getMonth();
  if (m < levelObj.month) return 'upcoming';
  if (m === levelObj.month) return 'open';
  return 'closed';
}
// Eligibility is based purely on the Age Group the participant selected when creating their
// account (see LEVELS — each division IS an age group). Participants may join their own age
// group's division or any harder division above it, but never an easier one below it — this
// keeps younger/less-experienced kids from being outmatched by older participants sandbagging
// a lower division. Grand Master Division (id 5) has no upper age limit — adults welcome.
function isJoinable(levelObj, ageGroupId) {
  return levelObj.id >= ageGroupId;
}
/* ============ OBFUSCATION (NOT REAL SECURITY — DEMO ONLY) ============ */
function obfuscate(str) {
  try { return btoa(unescape(encodeURIComponent(str))).split('').reverse().join(''); }
  catch (e) { return str; }
}

/* ============ STORAGE ============ */
async function safeGet(key, shared) {
  try { const res = await window.storage.get(key, shared); return res ? res.value : null; }
  catch (e) { return null; }
}
async function safeSet(key, value, shared) {
  try { await window.storage.set(key, value, shared); } catch (e) { console.error('storage set failed', e); }
}
async function loadAll() {
  const u = await safeGet('mdo-users', true); usersDB = u ? JSON.parse(u) : {};
  const p = await safeGet('mdo-progress', true); progressDB = p ? JSON.parse(p) : {};
  const s = await safeGet('mdo-session', false);
  if (s) {
    const sess = JSON.parse(s);
    if (sess.email && usersDB[sess.email]) setCurrentUserFromRecord(sess.email, usersDB[sess.email]);
  }
}
function setCurrentUserFromRecord(email, rec) {
  currentUser = { email, firstName: rec.firstName, lastName: rec.lastName, name: `${rec.firstName} ${rec.lastName}`, displayName: rec.displayName, school: rec.school, country: rec.country, city: rec.city, dob: rec.dob, ageGroupId: ageGroupIdFromDOB(rec.dob) };
}
function saveUsers() { return safeSet('mdo-users', JSON.stringify(usersDB), true); }
function saveProgress() { return safeSet('mdo-progress', JSON.stringify(progressDB), true); }
function saveSession() { return safeSet('mdo-session', JSON.stringify({email: currentUser ? currentUser.email : null}), false); }

async function loadLeaderboard(level, year) {
  const raw = await safeGet(`mdo-lb-L${level}-${year}`, true);
  return raw ? JSON.parse(raw) : [];
}
function saveLeaderboard(level, year, list) { return safeSet(`mdo-lb-L${level}-${year}`, JSON.stringify(list), true); }

/* ============ NAV & ROUTING ============ */
function renderNav() {
  const linksEl = document.getElementById('nav-links');
  const tabsHtml = NAV_ITEMS.map(item => `<button class="nav-btn" data-page="${item.id}" onclick="showPage('${item.id}')">${item.label}</button>`).join('');
  const userHtml = currentUser
    ? `<span class="nav-greeting">👋 ${escapeHtml(currentUser.firstName)}</span><button class="nav-btn nav-logout-btn" onclick="logout()">Log Out</button>`
    : `<button class="nav-btn" data-page="auth" onclick="showPage('auth')" style="background:var(--sky); color:white; border-color:var(--sky-dark);">🪪 Log In / Sign Up</button>`;
  linksEl.innerHTML = tabsHtml + userHtml;
}
function showPage(id) {
  PAGES.forEach(p => document.getElementById('page-' + p).classList.remove('visible'));
  document.getElementById('page-' + id).classList.add('visible');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.page === id));
  if (id === 'home') { /* static CLUES guide content — no dynamic render needed */ }
  if (id === 'practice') renderPracticePage();
  if (id === 'olympiad') { renderHome(); renderDivisionOverview(); renderOlympiadOverview(); }
  if (id === 'schedule') renderSchedulePage();
  if (id === 'why') renderWhyPage();
  if (id === 'rankings') renderRankingsPage();
  if (id === 'merch') renderMerchPage();
  window.scrollTo({top:0, behavior:'instant'});
}
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
// Shared "active tab" button toggle — accepts an element id or the element itself.
function setActiveBtn(elOrId, isActive) {
  const el = typeof elOrId === 'string' ? document.getElementById(elOrId) : elOrId;
  el.className = 'btn' + (isActive ? ' sky' : '');
}
// Shared ranking sort: highest score wins; ties broken by faster completion time.
function sortByScoreThenTime(list) {
  return list.slice().sort((a, b) => b.score - a.score || a.timeSec - b.timeSec);
}
function populateCountrySelects() {
  const opts = COUNTRIES.map(c => `<option value="${c}">${c}</option>`).join('');
  document.getElementById('su-country').innerHTML = opts;
  const countryFilter = document.getElementById('rank-country-filter');
  if (!countryFilter.dataset.populated) {
    countryFilter.innerHTML = opts;
    countryFilter.value = 'Philippines';
    countryFilter.dataset.populated = '1';
  }
  const continentFilter = document.getElementById('rank-continent-filter');
  if (!continentFilter.dataset.populated) {
    continentFilter.innerHTML = Object.keys(CONTINENT_GROUPS).map(c => `<option value="${c}">${c}</option>`).join('');
    continentFilter.value = 'Asia';
    continentFilter.dataset.populated = '1';
  }
}
/* ============ HOME ============ */
function renderHome() {
  document.getElementById('home-year-title').textContent = getYear() + ' Championship';
  const card = document.getElementById('practice-stage-card');
  const frontIcon = currentUser ? '✏️' : '🔒';
  card.querySelector('.stage-flip-inner').innerHTML = `
    <div class="stage-flip-front">
      <div class="num">STEP 2</div><div class="icon">${frontIcon}</div><h3>Practice</h3><p>Sign up and practice for free</p>
      <div class="flip-hint3">👆 Tap for details</div>
    </div>
    <div class="stage-flip-back">
      <div class="back-label3">Details</div>
      <p>A free account unlocks practice cases for your division. Scores here are just for warming up — they don't count toward the Championship.</p>
    </div>`;
}
function renderDivisionOverview() {
  const grid = document.getElementById('division-overview-grid');
  grid.innerHTML = LEVELS.map(l => `
    <div class="division-flip-card ${l.id===5?'expert':''}" onclick="this.classList.toggle('flipped')">
      <div class="division-flip-inner">
        <div class="division-flip-front">
          <div class="demoji">${l.emoji}</div>
          <h3>${l.name}</h3>
          <div class="flip-hint2">Tap to flip</div>
        </div>
        <div class="division-flip-back">
          <div class="back-label2">Details</div>
          <p class="dgrades2">${l.ageRange}</p>
          <p class="dmonth2">${MONTH_NAMES[l.month-1]}</p>
          <p class="ddesc2">${l.desc}</p>
        </div>
      </div>
    </div>`).join('');
}

/* ============ AUTH ============ */
function switchAuthTab(which) {
  document.getElementById('form-login').style.display = which === 'login' ? 'block' : 'none';
  document.getElementById('form-signup').style.display = which === 'signup' ? 'block' : 'none';
  setActiveBtn('tab-login', which === 'login');
  setActiveBtn('tab-signup', which === 'signup');
  hideAuthMsg();
}
function showAuthMsg(text, ok) {
  const el = document.getElementById('msg-auth');
  el.textContent = text;
  el.className = 'msg-box show ' + (ok ? 'ok' : 'err');
}
function hideAuthMsg() { document.getElementById('msg-auth').classList.remove('show'); }
async function handleSignup(e) {
  e.preventDefault();
  const firstName = document.getElementById('su-first').value.trim();
  const lastName = document.getElementById('su-last').value.trim();
  const displayName = document.getElementById('su-displayname').value.trim();
  const email = document.getElementById('su-email').value.trim().toLowerCase();
  const password = document.getElementById('su-password').value;
  const school = document.getElementById('su-school').value.trim();
  const country = document.getElementById('su-country').value;
  const city = document.getElementById('su-city').value.trim();
  const dob = document.getElementById('su-dob').value;
  if (!firstName || !lastName || !displayName || !email || password.length < 4 || !dob) { showAuthMsg('Please fill every field (password 4+ characters).', false); return false; }
  if (new Date(dob) > new Date()) { showAuthMsg('Date of birth cannot be in the future.', false); return false; }
  if (usersDB[email]) { showAuthMsg('An account with that email already exists — try logging in.', false); return false; }
  usersDB[email] = { firstName, lastName, displayName, email, passObfs: obfuscate(password), school, country, city, dob, createdAt: new Date().toISOString() };
  await saveUsers();
  setCurrentUserFromRecord(email, usersDB[email]);
  await saveSession();
  renderNav();
  showAuthMsg('Account created! Welcome, detective 🕵️', true);
  setTimeout(() => showPage('home'), 600);
  return false;
}
async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('li-email').value.trim().toLowerCase();
  const password = document.getElementById('li-password').value;
  const rec = usersDB[email];
  if (!rec || rec.passObfs !== obfuscate(password)) { showAuthMsg('Email or password is incorrect.', false); return false; }
  setCurrentUserFromRecord(email, rec);
  await saveSession();
  renderNav();
  showAuthMsg('Welcome back, ' + rec.firstName + '!', true);
  setTimeout(() => showPage('home'), 500);
  return false;
}
async function logout() { currentUser = null; await saveSession(); renderNav(); showPage('home'); }

/* ============ CONTACT US ============ */
async function handleContactSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('contact-name').value.trim();
  const email = document.getElementById('contact-email').value.trim();
  const category = document.getElementById('contact-category').value;
  const message = document.getElementById('contact-message').value.trim();
  const msg = document.getElementById('contact-msg');
  if (!name || !email || !message) {
    msg.className = 'msg-box show err';
    msg.textContent = 'Please fill in your name, email, and message.';
    return false;
  }
  try {
    const raw = await safeGet('mdo-contact-messages', true);
    const list = raw ? JSON.parse(raw) : [];
    list.push({ name, email, category, message, date: new Date().toISOString() });
    await safeSet('mdo-contact-messages', JSON.stringify(list), true);
  } catch (err) { console.error('contact save failed', err); }
  msg.className = 'msg-box show ok';
  msg.textContent = `Thanks, ${name}! Your ${category} message has been received. We'll get back to you at ${email} soon.`;
  document.getElementById('contact-name').value = '';
  document.getElementById('contact-email').value = '';
  document.getElementById('contact-message').value = '';
  return false;
}

/* ============ PRACTICE (account required; level chosen up front, filtered by grade) ============ */
function renderPracticePage() {
  const gate = document.getElementById('practice-gate');
  const levelSelect = document.getElementById('practice-level-select');
  const body = document.getElementById('practice-body');
  if (!currentUser) {
    gate.style.display = 'block';
    gate.innerHTML = `<div class="card"><p class="muted">🔒 Practice needs a free account so we know which division fits you. <a href="#" onclick="showPage('auth'); return false;">Log in or sign up</a>.</p></div>`;
    levelSelect.style.display = 'none';
    body.style.display = 'none';
    return;
  }
  gate.style.display = 'none';
  if (!practiceLevel) {
    levelSelect.style.display = 'block';
    body.style.display = 'none';
    renderPracticeLevelSelect();
    return;
  }
  levelSelect.style.display = 'none';
  body.style.display = 'block';
  document.getElementById('practice-name-label').textContent = currentUser.name;
  document.getElementById('practice-level-label').textContent = LEVELS.find(l => l.id === practiceLevel).name;
  loadPracticeProblemsForLevel(practiceLevel);
}
/* Shared "card body" markup (emoji + age range + name + desc) used by both the Practice
   division-picker and the Championship division grid, since both render the same division info. */
function divisionCardBody(l) {
  return `
    <div style="font-size:39px; line-height:1; margin-bottom:6px;">${l.emoji}</div>
    <p class="grades">${l.ageRange}</p>
    <h3>${l.name}</h3>
    <p class="desc">${l.desc}</p>`;
}
const LOCK_BUTTON_HTML = '<button class="btn small" disabled>🔒 Below your age group</button>';

function renderPracticeLevelSelect() {
  const naturalName = LEVELS.find(l => l.id === currentUser.ageGroupId).name;
  const el = document.getElementById('practice-level-select');
  el.innerHTML = `
    <div class="card">
      <h3 style="margin-top:0;">Hi ${escapeHtml(currentUser.firstName)}! Choose a division to practice</h3>
      <p class="muted">Your age group is <b>${escapeHtml(naturalName)}</b>. You can practice that division or any harder one above it — just not an easier one below it.</p>
      <div class="level-grid">
        ${LEVELS.map(l => {
          const joinable = isJoinable(l, currentUser.ageGroupId);
          return `
            <div class="level-card ${joinable ? '' : 'locked'} ${l.id===5?'expert':''}">
              ${divisionCardBody(l)}
              ${joinable
                ? `<button class="btn small green" onclick="choosePracticeLevel(${l.id})">Practice ${l.name}</button>`
                : LOCK_BUTTON_HTML}
            </div>`;
        }).join('')}
      </div>
    </div>`;
}
function choosePracticeLevel(id) { practiceLevel = id; renderPracticePage(); }
function changePracticeLevel() { practiceLevel = null; renderPracticePage(); }
let practiceAnswers = {};
function loadPracticeProblemsForLevel(level) {
  practiceProblems = buildPracticeProblems(level);
  practiceAnswers = {};
  document.getElementById('practice-result').innerHTML = '';
  const listEl = document.getElementById('practice-list');
  listEl.innerHTML = practiceProblems.map((p, i) => `
    <div class="qcard" id="pq-${i}">
      <div class="qnum">Case #${i+1}</div>
      <div class="qtext">${escapeHtml(p.text)}</div>
      <div class="qanswer-row"><input type="text" inputmode="numeric" id="pans-${i}" placeholder="Answer"></div>
      <div class="qfeedback" id="pfb-${i}"></div>
    </div>`).join('');
}
async function submitPractice() {
  let correct = 0;
  practiceProblems.forEach((p, i) => {
    const input = document.getElementById('pans-' + i);
    const card = document.getElementById('pq-' + i);
    const fb = document.getElementById('pfb-' + i);
    const match = input.value.trim().match(/-?\d+/);
    const num = match ? parseInt(match[0], 10) : null;
    const isCorrect = num === p.answer;
    if (isCorrect) correct++;
    card.classList.remove('correct','incorrect'); card.classList.add(isCorrect ? 'correct' : 'incorrect');
    fb.className = 'qfeedback ' + (isCorrect ? 'correct' : 'incorrect');
    fb.textContent = isCorrect ? '🎉 Correct!' : `❌ Correct answer: ${p.answer}`;
  });
  const total = practiceProblems.length;
  document.getElementById('practice-result').innerHTML = `
    <div class="card success">
      <h3 style="margin:0 0 6px;">Score: ${correct} / ${total} 🎯</h3>
      <p class="muted">Great warm-up! When the Championship opens for this division, come compete officially.</p>
    </div>`;
}

/* ============ OLYMPIAD ============ */
function renderOlympiadOverview() {
  const gate = document.getElementById('olympiad-gate');
  const overview = document.getElementById('olympiad-overview');
  const examEl = document.getElementById('olympiad-exam');
  examEl.style.display = 'none';
  if (!currentUser) {
    gate.style.display = 'block';
    gate.innerHTML = `<div class="card"><p class="muted">🔒 The Championship needs a free account so we can track your results across the season. <a href="#" onclick="showPage('auth'); return false;">Log in or sign up</a>.</p></div>`;
    overview.style.display = 'none';
    return;
  }
  gate.style.display = 'none';
  overview.style.display = 'block';
  const year = getYear();
  const grid = document.getElementById('level-grid');
  grid.innerHTML = LEVELS.map(l => {
    const eligible = isJoinable(l, currentUser.ageGroupId);
    const status = levelStatus(l);
    const rec = progressDB[currentUser.email]?.levels?.[l.id]?.[year];
    let resultHtml = '';
    let actionHtml = '';
    if (!eligible) {
      actionHtml = LOCK_BUTTON_HTML;
    } else if (rec) {
      const pct = Math.round((rec.score / rec.total) * 100);
      resultHtml = `<div class="level-result">Your score: ${rec.score}/${rec.total} (${pct}%)</div>`;
      actionHtml = `<button class="btn small grape" onclick="switchRankTabAndGo(${l.id})">View Ranking</button>`;
    } else if (status === 'open') {
      actionHtml = `<button class="btn small green" onclick="startExam(${l.id})">Start Exam</button>`;
    } else if (status === 'upcoming') {
      actionHtml = `<button class="btn small" disabled>Opens in ${MONTH_NAMES[l.month-1]}</button>`;
    } else {
      actionHtml = `<button class="btn small coral" onclick="switchRankTabAndGo(${l.id})">View Results</button><p class="muted" style="margin-top:6px;">You didn't attempt this division in ${year}.</p>`;
    }
    const pillLabel = !eligible ? 'LOCKED' : status === 'open' ? 'OPEN NOW' : status === 'upcoming' ? MONTH_NAMES[l.month-1] : 'CLOSED';
    const pillClass = !eligible ? 'locked' : status;
    return `
      <div class="level-card ${!eligible?'locked':''} ${l.id===5?'expert':''}">
        <span class="status-pill ${pillClass}">${pillLabel}</span>
        ${divisionCardBody(l)}
        ${resultHtml}
        ${actionHtml}
      </div>`;
  }).join('');
}
function switchRankTabAndGo(levelId) { rankLevelId = levelId; rankYear = getYear(); showPage('rankings'); }
function startExam(levelId) {
  activeLevel = LEVELS.find(l => l.id === levelId);
  const year = getYear();
  const existing = progressDB[currentUser.email]?.levels?.[levelId]?.[year];
  if (existing) { alert('You already completed this division for ' + year + '.'); return; }
  examProblems = buildExamProblems(levelId, year);
  examAnswers = {};
  examPageIdx = 0;
  examStartTime = Date.now();
  document.getElementById('olympiad-overview').style.display = 'none';
  document.getElementById('olympiad-exam').style.display = 'block';
  document.getElementById('exam-result').innerHTML = '';
  renderExamCurrentPage();
}
function backToOlympiadOverview() { renderOlympiadOverview(); }
function renderExamCurrentPage() {
  const start = examPageIdx * EXAM_PER_PAGE;
  const slice = examProblems.slice(start, start + EXAM_PER_PAGE);
  document.getElementById('exam-list').innerHTML = slice.map((p, j) => {
    const i = start + j;
    const val = examAnswers[i] !== undefined ? examAnswers[i] : '';
    return `
      <div class="qcard" id="eq-${i}">
        <div class="qnum">Case #${i+1}</div>
        <div class="qtext">${escapeHtml(p.text)}</div>
        <div class="qanswer-row"><input type="text" inputmode="numeric" value="${escapeHtml(val)}" oninput="examAnswers[${i}]=this.value; updateExamProgress();"></div>
      </div>`;
  }).join('');
  const totalPages = Math.ceil(EXAM_COUNT / EXAM_PER_PAGE);
  document.getElementById('exam-prev').disabled = examPageIdx === 0;
  document.getElementById('exam-next').style.display = examPageIdx === totalPages - 1 ? 'none' : 'inline-block';
  document.getElementById('exam-submit').style.display = examPageIdx === totalPages - 1 ? 'inline-block' : 'none';
  updateExamProgress();
}
function updateExamProgress() {
  const answered = Object.values(examAnswers).filter(v => v !== undefined && v.trim && v.trim() !== '').length;
  document.getElementById('exam-progress-label').textContent = `Answered ${answered} / ${EXAM_COUNT}`;
  document.getElementById('exam-progress-fill').style.width = (answered / EXAM_COUNT * 100) + '%';
}
function examPrevPage() { examPageIdx = Math.max(0, examPageIdx - 1); renderExamCurrentPage(); window.scrollTo({top:0, behavior:'smooth'}); }
function examNextPage() { const tp = Math.ceil(EXAM_COUNT / EXAM_PER_PAGE); examPageIdx = Math.min(tp - 1, examPageIdx + 1); renderExamCurrentPage(); window.scrollTo({top:0, behavior:'smooth'}); }
async function submitExam() {
  const answeredCount = Object.values(examAnswers).filter(v => v !== undefined && v.trim && v.trim() !== '').length;
  if (answeredCount < EXAM_COUNT) { if (!confirm(`You've only answered ${answeredCount} of ${EXAM_COUNT} cases. Submit anyway?`)) return; }
  let correct = 0; const wrongList = [];
  examProblems.forEach((p, i) => {
    const val = (examAnswers[i] || '').trim();
    const match = val.match(/-?\d+/);
    const num = match ? parseInt(match[0], 10) : null;
    if (num === p.answer) correct++; else wrongList.push({ i, text: p.text, answer: p.answer, given: val || '(blank)' });
  });
  const timeSec = Math.round((Date.now() - examStartTime) / 1000);
  const year = getYear();
  const levelId = activeLevel.id;

  if (!progressDB[currentUser.email]) progressDB[currentUser.email] = { levels: {}, purchased: {}, prizeClaimed: {} };
  if (!progressDB[currentUser.email].levels[levelId]) progressDB[currentUser.email].levels[levelId] = {};
  progressDB[currentUser.email].levels[levelId][year] = { score: correct, total: EXAM_COUNT, timeSec, date: new Date().toISOString() };
  await saveProgress();

  const lb = await loadLeaderboard(levelId, year);
  const idx = lb.findIndex(e => e.email === currentUser.email);
  const rec = { email: currentUser.email, name: currentUser.displayName, school: currentUser.school, country: currentUser.country, city: currentUser.city, score: correct, total: EXAM_COUNT, timeSec, date: new Date().toISOString() };
  if (idx === -1) lb.push(rec); else lb[idx] = rec;
  await saveLeaderboard(levelId, year, lb);

  const pct = Math.round((correct / EXAM_COUNT) * 100);
  const tier = getTier(pct);
  const tierLine = tier
    ? `Tier: <b style="color:${tier.ring}">${tier.name}</b>`
    : `<b style="color:#6b6486">Certificate of Participation</b> — score 80%+ to earn a scoring tier!`;
  const reviewHtml = wrongList.length === 0 ? '<p class="muted">Perfect score — no mistakes to review! 🎉</p>' :
    `<details style="margin-top:10px;"><summary style="cursor:pointer; font-weight:800; font-family:'Baloo 2',sans-serif;">Review missed cases (${wrongList.length})</summary>
      ${wrongList.slice(0,25).map(w => `<div class="qcard incorrect"><div class="qnum">Case #${w.i+1}</div><div class="qtext">${escapeHtml(w.text)}</div><div class="qfeedback incorrect">Your answer: ${escapeHtml(w.given)} — Correct: ${w.answer}</div></div>`).join('')}
      ${wrongList.length > 25 ? `<p class="muted">…and ${wrongList.length - 25} more.</p>` : ''}
    </details>`;
  document.getElementById('exam-result').innerHTML = `
    <div class="card highlight">
      <h3 style="margin:0 0 6px;">${activeLevel.name} Score: ${correct} / ${EXAM_COUNT} (${pct}%)</h3>
      <p class="muted">Time: ${Math.floor(timeSec/60)}m ${timeSec%60}s — ${tierLine}</p>
    </div>
    <div id="print-area">${renderCertificateSvg(currentUser.name, correct, EXAM_COUNT, pct, tier, activeLevel)}</div>
    <div class="badge-wrap">${renderBadgeSvg(tier, pct)}</div>
    <div class="cert-actions">
      <button class="btn sky" onclick="window.print()">🖨️ Print / Save Certificate as PDF</button>
      <button class="btn grape" onclick="downloadBadge(${pct})">⬇️ Download Badge (SVG)</button>
    </div>
    <div class="card">
      <div class="btn-row"><button class="btn coral" onclick="showPage('merch')">🛍️ Check Prize Eligibility</button><button class="btn" onclick="backToOlympiadOverview()">Back to Divisions</button></div>
      ${reviewHtml}
    </div>`;
}

/* ============ SCHEDULE ============ */
function renderSchedulePage() {
  const m = getMonth();
  const year = getYear();
  document.getElementById('schedule-year-title').textContent = `${year} Championship Schedule`;
  const el = document.getElementById('schedule-list');
  el.innerHTML = LEVELS.map(l => {
    const status = levelStatus(l);
    const pillLabel = status === 'open' ? 'OPEN NOW' : status === 'upcoming' ? 'Upcoming' : 'Closed';
    let note;
    if (status === 'open') note = `Open all through ${MONTH_NAMES[l.month-1]} ${year}.`;
    else if (status === 'upcoming') note = `Opens ${MONTH_NAMES[l.month-1]} 1, ${year}.`;
    else note = `Closed for ${year} — see Rankings.`;
    return `
      <tr>
        <td>${l.emoji} <b>${l.name}</b></td>
        <td>${l.ageRange}</td>
        <td><b>$${l.feeUSD}</b> USD</td>
        <td>${MONTH_NAMES[l.month-1]} ${year}</td>
        <td style="white-space:normal; max-width:280px;">${l.desc}</td>
        <td><span class="status-pill ${status}" style="margin-bottom:0;">${pillLabel}</span></td>
        <td style="white-space:normal; max-width:180px;">${note}</td>
      </tr>`;
  }).join('');
}

/* ============ WHY IT MATTERS ============ */
const WHY_CAREERS = [
  { emoji: '👩‍⚕️', title: 'Doctors & Nurses', text: 'Calculating medication dosages, converting units, and reading vital signs correctly.' },
  { emoji: '🚀', title: 'Engineers & Scientists', text: 'Fuel calculations, structural loads, and trajectory math that has to be exactly right.' },
  { emoji: '💼', title: 'Entrepreneurs & CEOs', text: 'Budgets, profit margins, and knowing whether a deal actually makes sense.' },
  { emoji: '🏗️', title: 'Architects & Builders', text: 'Measurements, material estimates, and keeping a project on budget.' },
  { emoji: '🍳', title: 'Chefs & Bakers', text: 'Scaling recipes up or down and figuring out cost per serving.' },
  { emoji: '🎮', title: 'Game Designers', text: 'Probability, scoring systems, and in-game economies that feel fair.' },
  { emoji: '🌍', title: 'World Leaders', text: 'Budgets, population statistics, and allocating limited resources fairly.' },
  { emoji: '🛒', title: 'Everyday Life', text: 'Shopping discounts, trip planning, splitting bills, and budgeting an allowance.' },
];
function renderWhyPage() {
  document.getElementById('why-career-grid').innerHTML = WHY_CAREERS.map(c => `
    <div class="why-card">
      <div class="wemoji">${c.emoji}</div>
      <h3>${c.title}</h3>
      <p>${c.text}</p>
    </div>`).join('');
}

/* ============ RANKINGS ============ */
function yearOptions() {
  const y = getYear();
  const opts = [];
  for (let i = 0; i < 10; i++) opts.push(y - i);
  return opts;
}
function renderRankingsPage() {
  populateCountrySelects();
  document.getElementById('rank-level-tabs').innerHTML = LEVELS.map(l => `<button class="btn ${rankLevelId===l.id?'sky':''}" onclick="switchRankLevel(${l.id})">${l.emoji} ${l.name}</button>`).join('');
  const yearSelect = document.getElementById('rank-year-filter');
  if (!yearSelect.dataset.populated) {
    yearSelect.innerHTML = yearOptions().map(y => `<option value="${y}">${y}</option>`).join('');
    yearSelect.dataset.populated = '1';
  }
  yearSelect.value = rankYear;
  ['global','continental','national'].forEach(s => {
    setActiveBtn('rank-tab-' + s, rankScope === s);
  });
  document.getElementById('rank-scope-tabs').style.display = 'flex';
  document.getElementById('rank-filters').style.display = rankScope === 'global' ? 'none' : 'flex';
  document.getElementById('rank-continent-field').style.display = rankScope === 'continental' ? 'block' : 'none';
  document.getElementById('rank-country-field').style.display = rankScope === 'national' ? 'block' : 'none';
  document.getElementById('rank-note').textContent = 'Rankings show names and general city, visible to everyone using this app.';
  renderRankings();
}
function switchRankLevel(id) { rankLevelId = id; renderRankingsPage(); }
function switchRankScope(scope) { rankScope = scope; renderRankingsPage(); }
function switchRankYear(y) { rankYear = parseInt(y, 10); renderRankings(); }
async function renderRankings() {
  const rawList = await loadLeaderboard(rankLevelId, rankYear);
  let filtered = rawList.slice();
  if (rankScope === 'continental') {
    const continent = document.getElementById('rank-continent-filter').value;
    if (continent) filtered = filtered.filter(e => countryToContinent(e.country) === continent);
  } else if (rankScope === 'national') {
    const country = document.getElementById('rank-country-filter').value;
    if (country) filtered = filtered.filter(e => e.country === country);
  }
  // rankScope === 'global' applies no filter at all
  filtered = sortByScoreThenTime(filtered);
  document.getElementById('rank-thead-row').innerHTML = `<th>#</th><th>Detective</th><th>Country</th><th>City</th><th>School</th><th>Score</th><th>Time</th><th>Date</th>`;
  const tbody = document.getElementById('rank-tbody');
  document.getElementById('rank-empty').style.display = filtered.length === 0 ? 'block' : 'none';
  tbody.innerHTML = filtered.slice(0, 50).map((e, i) => {
    const mine = currentUser && e.email === currentUser.email;
    const medal = i === 0 ? '<span class="medal">🥇</span>' : i === 1 ? '<span class="medal">🥈</span>' : i === 2 ? '<span class="medal">🥉</span>' : (i < 10 ? '<span class="medal">🏅</span>' : '');
    const timeStr = `${Math.floor(e.timeSec/60)}m ${e.timeSec%60}s`;
    return `<tr class="${mine ? 'me' : ''}"><td class="rank-num">${medal}${i+1}</td><td>${escapeHtml(e.name)}${mine ? ' (you)' : ''}</td><td>${escapeHtml(e.country||'')}</td><td>${escapeHtml(e.city||'')}</td><td>${escapeHtml(e.school||'—')}</td><td>${e.score}/${e.total}</td><td>${timeStr}</td><td>${new Date(e.date).toLocaleDateString()}</td></tr>`;
  }).join('');
}

/* ============ MERCH & PRIZES (certificate/badge are free — no paywall) ============ */
function getTier(pct) {
  if (pct >= 95) return { name: 'Gold Detective', fill: 'var(--gold)', ring: 'var(--gold-dark)' };
  if (pct >= 90) return { name: 'Silver Detective', fill: 'var(--silver)', ring: 'var(--silver-dark)' };
  if (pct >= 85) return { name: 'Bronze Detective', fill: 'var(--bronze)', ring: 'var(--bronze-dark)' };
  if (pct >= 80) return { name: 'Rookie Detective', fill: 'var(--grape)', ring: 'var(--grape-dark)' };
  return null; // below 80% earns a Certificate of Participation instead of a scoring tier
}
const MERCH_ITEMS = [
  { emoji: '👕', name: 'Shirt' },
  { emoji: '🧢', name: 'Cap' },
  { emoji: '🎒', name: 'Bag' },
  { emoji: '📌', name: 'Pin' },
  { emoji: '🏷️', name: 'Sticker' },
  { emoji: '🥤', name: 'Tumbler' },
  { emoji: '🖊️', name: 'Pen' },
  { emoji: '📓', name: 'Notebook' },
];
function renderMerchItemsGrid() {
  document.getElementById('merch-items-grid').innerHTML = MERCH_ITEMS.map(m => `
    <div class="why-card">
      <div class="wemoji">${m.emoji}</div>
      <h3>${m.name}</h3>
      <p>Placeholder — based on availability</p>
    </div>`).join('');
}
async function renderMerchPage() {
  renderMerchItemsGrid();
  const gate = document.getElementById('merch-gate');
  const body = document.getElementById('merch-body');
  if (!currentUser) {
    gate.style.display = 'block';
    gate.innerHTML = `<div class="card"><p class="muted">🔒 Please <a href="#" onclick="showPage('auth'); return false;">log in or sign up</a> first.</p></div>`;
    body.style.display = 'none';
    return;
  }
  gate.style.display = 'none';
  body.style.display = 'block';
  const year = getYear();
  const prog = progressDB[currentUser.email];
  const completedLevels = LEVELS.filter(l => prog?.levels?.[l.id]?.[year]);
  if (completedLevels.length === 0) {
    body.innerHTML = `<div class="card"><p class="muted">You haven't completed any Championship divisions yet in ${year}. Finish a division for a shot at physical merch prizes! Your certificate and badge are available right after you finish the exam.</p><div class="btn-row"><button class="btn grape" onclick="showPage('olympiad')">Go to Championship</button></div></div>`;
    return;
  }
  let html = `<div class="tab-row">` + completedLevels.map((l,i) => `<button class="btn ${i===0 ? 'sky':''}" data-merch-level="${l.id}" onclick="selectMerchLevel(${l.id})">${l.emoji} ${l.name}</button>`).join('') + `</div><div id="merch-detail">Loading…</div>`;
  body.innerHTML = html;
  await selectMerchLevel(completedLevels[0].id);
}
async function selectMerchLevel(levelId) {
  activeLevel = LEVELS.find(l => l.id === levelId);
  document.querySelectorAll('#merch-body [data-merch-level]').forEach(b => setActiveBtn(b, parseInt(b.dataset.merchLevel,10) === levelId));
  const year = getYear();
  const rec = progressDB[currentUser.email].levels[levelId][year];
  const status = levelStatus(activeLevel);
  const detail = document.getElementById('merch-detail');

  let rank = null;
  if (status === 'closed') {
    const lb = await loadLeaderboard(levelId, year);
    const sorted = sortByScoreThenTime(lb);
    rank = sorted.findIndex(e => e.email === currentUser.email) + 1;
  }
  const isTop10 = rank && rank <= 10;
  const prizeKey = `${levelId}_${year}`;

  let prizeHtml = '';
  if (status !== 'closed') {
    prizeHtml = `<p class="muted">Final rankings & prizes for ${activeLevel.name} are announced after ${MONTH_NAMES[activeLevel.month-1]} closes.</p>`;
  } else if (isTop10) {
    const medal = rank === 1 ? '🥇 1st Place' : rank === 2 ? '🥈 2nd Place' : rank === 3 ? '🥉 3rd Place' : `🏅 Top 10 (#${rank})`;
    const claimed = progressDB[currentUser.email].prizeClaimed?.[prizeKey];
    prizeHtml = `
      <div class="prize-card">
        <h3 style="margin:0 0 6px;">${medal} — ${activeLevel.name}, ${year}</h3>
        <p style="font-weight:700; font-size:15.5px;">You placed in the National Top 10! Your merch prize pack may include items like a medal/pin, badge, shirt, or cap — based on availability, not guaranteed to be these exact items.</p>
        ${claimed
          ? `<p class="muted">✅ Prize claimed — we'll email shipping details to ${escapeHtml(currentUser.email)}.</p>`
          : `<button class="btn coral" onclick="claimPrize('${prizeKey}')">🎁 Claim My Merch Prize</button>
             <p class="demo-note">Demo only: for a real launch, collect shipping addresses through a secure external form — never store home addresses in this app's storage.</p>`}
      </div>`;
  } else {
    prizeHtml = `<p class="muted">Final national rank for ${activeLevel.name} ${year}: #${rank}. Top 10 nationally win physical merch prizes — keep practicing for next year!</p>`;
  }

  detail.innerHTML = `
    <div class="card"><h3 style="margin-top:0;">${activeLevel.name}</h3>
      <p class="muted">Score: ${rec.score} / ${rec.total}. Looking for your certificate or badge? Those are available right on the exam result screen after you finish a division.</p>
      ${prizeHtml}
    </div>`;
}
async function claimPrize(prizeKey) {
  if (!progressDB[currentUser.email].prizeClaimed) progressDB[currentUser.email].prizeClaimed = {};
  progressDB[currentUser.email].prizeClaimed[prizeKey] = true;
  await saveProgress();
  selectMerchLevel(activeLevel.id);
}
function renderCertificateSvg(name, score, total, pct, tier, level) {
  const date = new Date().toLocaleDateString();
  const t = tier || { name: 'Certificate of Participation', ring: '#9b93c2' };
  const title = tier ? 'Certificate of Achievement' : 'Certificate of Participation';
  const verb = tier ? 'has successfully completed' : 'participated in';
  const tierLine = tier ? `<text x="350" y="328" text-anchor="middle" font-family="'Baloo 2', sans-serif" font-weight="700" font-size="17" fill="${t.ring}">${tier.name}</text>` : '';
  return `
  <div class="card" style="padding:0; overflow:hidden;">
    <svg viewBox="0 0 700 460" xmlns="http://www.w3.org/2000/svg" style="width:100%; display:block;">
      <rect x="0" y="0" width="700" height="460" fill="#fff8ec"/>
      <rect x="14" y="14" width="672" height="432" fill="none" stroke="${t.ring}" stroke-width="6" rx="18"/>
      <rect x="26" y="26" width="648" height="408" fill="none" stroke="${t.ring}" stroke-width="2" stroke-dasharray="6 6" rx="12"/>
      <text x="350" y="82" text-anchor="middle" font-family="'Baloo 2', sans-serif" font-weight="800" font-size="26" fill="#7d4bc4">${title}</text>
      <text x="350" y="112" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="700" font-size="13.5" fill="#55506e">Math Word Problem Detective — ${escapeHtml(level.name)} (${escapeHtml(level.ageRange)}) — ${getYear()}</text>
      <text x="350" y="185" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="700" font-size="16" fill="#2f2a4a">This certifies that</text>
      <text x="350" y="230" text-anchor="middle" font-family="'Baloo 2', sans-serif" font-weight="800" font-size="32" fill="#e6503f">${escapeHtml(name)}</text>
      <text x="350" y="268" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="700" font-size="14" fill="#2f2a4a">${verb} ${escapeHtml(level.name)}: ${escapeHtml(level.desc)}</text>
      <text x="350" y="298" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="800" font-size="16" fill="#2f9e4f">Score: ${score} / ${total} (${pct}%)</text>
      ${tierLine}
      <text x="140" y="410" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="700" font-size="12" fill="#6b6486">Date: ${date}</text>
      <text x="560" y="410" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="700" font-size="12" fill="#6b6486">Math Word Problem Detective</text>
    </svg>
  </div>`;
}
function renderBadgeSvg(tier, pct) {
  const t = tier || { name: 'Participant', fill: 'var(--grape)', ring: 'var(--grape-dark)' };
  const label = tier ? t.name : 'Participant';
  return `
    <svg viewBox="0 0 200 220" width="180" xmlns="http://www.w3.org/2000/svg">
      <polygon points="100,150 60,210 80,175 60,175 100,150" fill="${t.ring}"/>
      <polygon points="100,150 140,210 120,175 140,175 100,150" fill="${t.ring}"/>
      <circle cx="100" cy="95" r="80" fill="${t.fill}" stroke="#2f2a4a" stroke-width="5"/>
      <circle cx="100" cy="95" r="62" fill="#fff8ec" stroke="#2f2a4a" stroke-width="3"/>
      <text x="100" y="80" text-anchor="middle" font-family="'Baloo 2', sans-serif" font-weight="800" font-size="26" fill="#2f2a4a">🔍</text>
      <text x="100" y="108" text-anchor="middle" font-family="'Baloo 2', sans-serif" font-weight="800" font-size="13" fill="#2f2a4a">${pct}%</text>
      <text x="100" y="124" text-anchor="middle" font-family="Nunito, sans-serif" font-weight="800" font-size="9" fill="#2f2a4a">${tier ? 'CERTIFIED' : 'PARTICIPANT'}</text>
    </svg>
    <p style="text-align:center; font-family:'Baloo 2',sans-serif; font-weight:700; color:${t.ring}; margin-top:-6px;">${label}</p>`;
}
function downloadBadge(pct) {
  const tier = getTier(pct);
  const t = tier || { fill: 'var(--grape)', ring: 'var(--grape-dark)' };
  const label = tier ? 'CERTIFIED' : 'PARTICIPANT';
  const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 220">
    <polygon points="100,150 60,210 80,175 60,175 100,150" fill="${t.ring}"/>
    <polygon points="100,150 140,210 120,175 140,175 100,150" fill="${t.ring}"/>
    <circle cx="100" cy="95" r="80" fill="${t.fill}" stroke="#2f2a4a" stroke-width="5"/>
    <circle cx="100" cy="95" r="62" fill="#fff8ec" stroke="#2f2a4a" stroke-width="3"/>
    <text x="100" y="80" text-anchor="middle" font-family="Arial" font-weight="800" font-size="24" fill="#2f2a4a">DETECTIVE</text>
    <text x="100" y="108" text-anchor="middle" font-family="Arial" font-weight="800" font-size="13" fill="#2f2a4a">${pct}%</text>
    <text x="100" y="124" text-anchor="middle" font-family="Arial" font-weight="800" font-size="9" fill="#2f2a4a">${label}</text>
  </svg>`;
  const blob = new Blob([svgStr], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'detective-badge.svg';
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

/* ============ CLUES METHOD GUIDE INTERACTIONS (home page) ============ */
function toggleBox(id) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle('show');
}
function checkAnswer(inputId, boxId) {
  const input = document.getElementById(inputId);
  const box = document.getElementById(boxId);
  const feedback = box.querySelector('.feedback');
  const correct = input.getAttribute('data-answer');
  const val = input.value.trim();
  const match = val.match(/\d+/);
  const num = match ? match[0] : null;

  box.classList.add('show');
  if (num !== null && num === correct) {
    box.classList.remove('incorrect');
    input.style.borderColor = 'var(--grass-dark)';
    feedback.innerHTML = '🎉 <b>Correct!</b> ';
  } else {
    box.classList.add('incorrect');
    input.style.borderColor = 'var(--coral-dark)';
    feedback.innerHTML = '❌ <b>Not quite.</b> Here\'s how to solve it: ';
  }
  const card = input.closest('.practice-card');
  if (card) {
    const problem = card.querySelector('.problem');
    if (problem && problem.dataset.clues) {
      const indices = problem.dataset.clues.split(',').map(Number);
      const words = problem.querySelectorAll('.word');
      indices.forEach(i => { if (words[i]) words[i].classList.add('underlined'); });
    }
  }
}
function wrapWordsForClicking() {
  const problems = document.querySelectorAll('#page-home .practice-card .problem');
  problems.forEach(p => {
    const text = p.textContent;
    const tokens = text.split(/(\s+)/);
    let html = '';
    tokens.forEach(tok => {
      if (tok.trim() === '') html += tok;
      else html += '<span class="word" onclick="this.classList.toggle(\'underlined\')">' + tok + '</span>';
    });
    p.innerHTML = html;
  });
}

/* ============ SHARED FOOTER (injected into every page's .page-footer placeholder) ============ */
const FOOTER_HTML = `
  <p>🔍 <b>Math Word Problem Detective</b> — solve smart, compete fair, celebrate every win.</p>
  <p class="small">Have questions? Ask a parent, guardian, or teacher for help getting started.</p>
  <p class="footer-links"><a href="#" onclick="showPage('contact'); return false;">Contact Us</a> · <a href="#" onclick="showPage('terms'); return false;">Terms &amp; Conditions</a> · <a href="#" onclick="showPage('privacy'); return false;">Privacy Policy</a></p>
  <p class="footer-social"><a href="#" onclick="return false;" title="Facebook">📘</a><a href="#" onclick="return false;" title="Instagram">📷</a><a href="#" onclick="return false;" title="X / Twitter">🐦</a><a href="#" onclick="return false;" title="YouTube">▶️</a></p>`;
function renderFooters() {
  document.querySelectorAll('.page-footer').forEach(el => el.innerHTML = FOOTER_HTML);
}

/* ============ INIT ============ */
async function init() {
  await loadAll();
  populateCountrySelects();
  document.getElementById('su-dob').max = new Date().toISOString().split('T')[0];
  renderNav();
  renderFooters();
  switchAuthTab('login');
  wrapWordsForClicking();
  showPage('home');
}
init();
