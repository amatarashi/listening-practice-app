import { lessons } from "./lessons.js";

const levels = [
  { id: "A1–A2", detail: "Простые ситуации" },
  { id: "B1", detail: "Повседневные истории" },
  { id: "B2", detail: "Нюансы и выводы" },
];
const wave = [9, 15, 22, 33, 26, 13, 20, 31, 39, 29, 17, 24, 35, 24, 18, 11, 21, 34, 41, 23, 18, 30, 38, 27, 11, 21, 33, 22, 16, 9, 17, 26, 35, 21, 14, 24, 31, 19, 11, 8];
const storageKey = "english-listening-progress-v1";
const screen = document.querySelector("#screen");
const audio = document.querySelector("#recording");
let telegram;
let progress = loadProgress();
let level = levels.some(item => item.id === progress.level) ? progress.level : levels[0].id;
let view = "home";
let round = null;

function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved && saved.best && Array.isArray(saved.days) && saved.daily) return saved;
  } catch (error) {
    console.warn("Progress storage unavailable", error);
  }
  return { best: {}, days: [], daily: {}, level: "" };
}

function storeProgress() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(progress));
  } catch (error) {
    console.warn("Progress storage unavailable", error);
  }
}

function dateKey(offset = 0) {
  const date = new Date();
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000) + offset;
}

function currentStreak() {
  const practiced = new Set(progress.days);
  let day = dateKey();
  if (!practiced.has(day)) day -= 1;
  let streak = 0;
  while (practiced.has(day)) {
    streak += 1;
    day -= 1;
  }
  return streak;
}

function score() {
  return lessons.reduce((total, lesson) => total + 10 * (progress.best[lesson.id] || 0), 0);
}

function levelLessons() {
  return lessons.filter(lesson => lesson.level === level);
}

function dailyLesson() {
  const options = levelLessons();
  return options[dateKey() % options.length];
}

function selectLevel(next) {
  level = next;
  progress.level = next;
  storeProgress();
}

function navigate(next) {
  audio.pause();
  round = null;
  view = next;
  render(true);
}

function openLesson(lesson, daily = false) {
  selectLevel(lesson.level);
  round = { lesson, daily, day: dateKey(), index: 0, answers: [], unlocked: false, earned: 0, finished: false };
  view = "round";
  audio.src = "./assets/audio/" + lesson.id + ".mp3";
  render(true);
}

function home() {
  const daily = dailyLesson();
  const completedToday = progress.daily[dateKey()]?.includes(level);
  return [
    '<section class="hero">',
    '<div><p class="eyebrow">Английский на слух</p>',
    '<h1 tabindex="-1" lang="en">Listening<br><em>Practice</em></h1>',
    '<p class="lede">Короткие истории на английском и три вопроса после каждой записи.</p></div>',
    '<figure class="photo"><img src="./assets/london.jpg" alt="" fetchpriority="high">',
    '<figcaption lang="en">London after dark</figcaption></figure>',
    '</section><section class="section" aria-labelledby="choose">',
    '<div class="section-head"><h2 id="choose">Выбери уровень</h2><span class="small">9 тренировок</span></div>',
    '<div class="levels">',
    ...levels.map(item => '<button type="button" class="level" data-action="level" data-level="' + item.id + '">' +
      '<strong>' + item.id + '</strong><small>' + item.detail + '</small><span class="arrow" aria-hidden="true">→</span></button>'),
    '</div></section>',
    '<section class="daily" aria-labelledby="daily"><div><h3 id="daily">Задание дня</h3>',
    '<p class="small">' + level + ' · <span lang="en">' + daily.title + '</span></p></div>',
    '<button type="button" class="button" data-action="daily">' +
      (completedToday ? 'Повторить' : 'Начать') + ' <span aria-hidden="true">→</span></button></section>',
  ].join("");
}

function catalog() {
  return [
    '<section class="page-narrow">',
    '<p class="eyebrow">Уровни A1–B2</p><h1 tabindex="-1">Практика</h1>',
    '<div class="level-strip" role="group" aria-label="Уровень английского">',
    ...levels.map(item => '<button type="button" class="quiet" data-action="level" data-level="' + item.id +
      '" aria-pressed="' + (level === item.id) + '">' + item.id + '</button>'),
    '</div><div class="lesson-list">',
    ...levelLessons().map(lesson => {
      const best = progress.best[lesson.id];
      return '<button type="button" class="lesson-row" data-action="lesson" data-id="' + lesson.id + '">' +
        '<div><h3 lang="en">' + lesson.title + '</h3><p class="description">' + lesson.description + '</p></div>' +
        '<div class="row-meta"><span class="small">' + (best === undefined ? '3 вопроса' : 'Лучший: ' + best + '/3') +
        '</span><span class="arrow" aria-hidden="true">→</span></div></button>';
    }),
    '</div></section>',
  ].join("");
}

function player() {
  return [
    '<section class="player" aria-labelledby="player-label"><h2 id="player-label">Аудиозапись</h2>',
    '<div class="player-controls"><button type="button" id="play" class="play" data-action="play" aria-label="Воспроизвести">▶</button>',
    '<div class="wave" aria-hidden="true">',
    ...wave.map(height => '<i style="height:' + height + 'px"></i>'),
    '</div></div><div class="time-row"><span id="elapsed">0:00</span><span id="duration">–:––</span></div>',
    '<p role="status" id="player-error" class="player-error" hidden>Запись не загрузилась. Попробуй запустить её ещё раз.</p></section>',
  ].join("");
}

function quiz() {
  const { answers, index, lesson, unlocked } = round;
  if (!unlocked) {
    return '<button type="button" class="button wide" disabled>К вопросам</button>' +
      '<p class="small" style="margin-top:8px">Вопросы откроются после первого прослушивания.</p>';
  }
  if (!round.started) return '<button type="button" class="button wide" data-action="start-quiz">К вопросам <span aria-hidden="true">→</span></button>';

  const question = lesson.questions[index];
  const selected = answers[index];
  const answered = selected !== undefined;
  const correct = selected === question.answer;

  return [
    '<div class="section-head small"><span>Вопрос ' + (index + 1) + ' из ' + lesson.questions.length +
      '</span><span>' + question.type + '</span></div>',
    '<div class="segments" aria-hidden="true">',
    ...lesson.questions.map((_, step) => '<span' + (step <= index ? ' class="filled"' : '') + '></span>'),
    '</div><h2 tabindex="-1" class="quiz-title" lang="en">' + question.text + '</h2><div class="options">',
    ...question.options.map((option, i) => {
      const state = answered && i === question.answer ? " right" : answered && i === selected ? " wrong" : "";
      return '<button type="button" class="option' + state + '" data-action="answer" data-option="' + i + '" lang="en"' +
        (answered ? ' disabled' : '') + '><strong aria-hidden="true">' + "ABC"[i] + '</strong>' + option + '</button>';
    }),
    '</div>',
    answered ? '<div class="feedback' + (correct ? ' good' : '') + '" tabindex="-1">' +
      '<strong>' + (correct ? 'Верно!' : 'Верный ответ: <span lang="en">' + question.options[question.answer] + '</span>') +
      '</strong>' + question.explanation + '</div><div class="tight-actions">' +
      (!correct ? '<button type="button" class="quiet" data-action="replay">Переслушать</button>' : '') +
      '<button type="button" class="button" data-action="next">' +
      (index + 1 === lesson.questions.length ? 'К результату' : 'Следующий вопрос') + '</button></div>' : '',
  ].join("");
}

function transcript() {
  return '<details class="transcript"><summary>Транскрипт</summary><p lang="en">' + round.lesson.transcript + '</p></details>';
}

function countCorrect() {
  return round.answers.filter((answer, i) => answer === round.lesson.questions[i].answer).length;
}

function metric(value, label) {
  return '<div class="metric"><strong>' + value + '</strong><span>' + label + '</span></div>';
}

function result() {
  const todayStreak = currentStreak();
  return [
    '<p class="eyebrow">Тренировка завершена</p><h1 tabindex="-1">' +
      (countCorrect() === round.lesson.questions.length ? 'Отлично!' : 'Готово!') + '</h1>',
    '<div class="score">',
    metric(countCorrect() + '/' + round.lesson.questions.length, "верно"),
    metric('+' + round.earned, "XP"),
    metric(todayStreak, "дней подряд"),
    '</div>',
    round.earned === 0 ? '<p class="small">XP начисляются за улучшение личного результата.</p>' : '',
    player(), transcript(),
    '<div class="tight-actions"><button type="button" class="quiet" data-action="retry">Пройти ещё раз</button>',
    '<button type="button" class="button" data-action="lessons">К тренировкам</button></div>',
  ].join("");
}

function lessonScreen() {
  return '<section class="page-narrow"><button type="button" class="quiet back" data-action="lessons">← Практика</button>' +
    (round.finished ? result() : [
      '<p class="eyebrow">' + round.lesson.level + (round.daily ? ' · Задание дня' : '') + '</p>',
      '<h1 tabindex="-1" lang="en">' + round.lesson.title + '</h1>',
      '<p class="lede">' + round.lesson.description + '</p>',
      player(), '<section class="quiz" id="quiz" aria-label="Вопросы по записи">' + quiz() + '</section>',
    ].join("")) + '</section>';
}

function progressScreen() {
  const passed = lessons.filter(lesson => Object.hasOwn(progress.best, lesson.id));
  return [
    '<section class="page-narrow"><h1 tabindex="-1">Твой прогресс</h1>',
    '<div class="score">', metric(score(), "XP"), metric(passed.length + '/' + lessons.length, "пройдено"),
    metric(currentStreak(), "дней подряд"), '</div>',
    '<p class="lede">Каждый верный ответ, который улучшает твой лучший результат в тренировке, даёт 10 XP.</p>',
    '<div class="section"><h2>По уровням</h2><div class="level-strip">',
    ...levels.map(item => {
      const available = lessons.filter(lesson => lesson.level === item.id);
      const completed = passed.filter(lesson => lesson.level === item.id);
      return '<button type="button" class="quiet" data-action="level" data-level="' + item.id + '">' +
        item.id + ' · ' + completed.length + '/' + available.length + '</button>';
    }),
    '</div></div><details class="transcript credits"><summary>Источники материалов</summary>',
    '<ul><li>Тексты и вопросы подготовлены для приложения. Записи синтезированы с помощью ',
    '<a href="https://huggingface.co/hexgrad/Kokoro-82M" target="_blank" rel="noopener noreferrer">Kokoro v1.0</a> (Apache 2.0).</li>',
    '<li>Фото Лондона — <a href="https://unsplash.com/photos/rk3_3SpcnT4" target="_blank" rel="noopener noreferrer">Marc Kleen</a>, ',
    '<a href="https://unsplash.com/license" target="_blank" rel="noopener noreferrer">Unsplash License</a>.</li>',
    '<li>Cormorant Garamond, Inter и Manrope распространяются по SIL Open Font License.</li></ul>',
    '</details></section>',
  ].join("");
}

function updateTabs() {
  const tab = view === "round" ? "lessons" : view;
  for (const button of document.querySelectorAll(".tabbar button")) {
    if (button.dataset.action === tab) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  }
  if (view === "home") telegram?.BackButton?.hide();
  else telegram?.BackButton?.show();
}

function render(scroll = false) {
  const renderers = { home, lessons: catalog, progress: progressScreen, round: lessonScreen };
  screen.innerHTML = renderers[view]();
  document.querySelector("#points").textContent = score() + " XP";
  updateTabs();
  updatePlayer();
  if (scroll) {
    window.scrollTo(0, 0);
    screen.querySelector("h1")?.focus({ preventScroll: true });
  }
}

function refreshQuiz(focusSelector) {
  const section = document.querySelector("#quiz");
  if (!section) return;
  section.innerHTML = quiz();
  const focus = section.querySelector(focusSelector);
  focus?.focus({ preventScroll: true });
  focus?.scrollIntoView({ block: "nearest" });
}

function time(seconds) {
  if (!Number.isFinite(seconds)) return "–:––";
  return Math.floor(seconds / 60) + ":" + String(Math.floor(seconds % 60)).padStart(2, "0");
}

function updatePlayer() {
  const play = document.querySelector("#play");
  if (!play) return;
  const playing = !audio.paused && !audio.ended;
  play.textContent = playing ? "Ⅱ" : audio.ended ? "↻" : "▶";
  play.setAttribute("aria-label", playing ? "Пауза" : audio.ended ? "Воспроизвести снова" : "Воспроизвести");
  document.querySelector("#elapsed").textContent = time(audio.currentTime);
  document.querySelector("#duration").textContent = time(audio.duration);
  const playedFraction = audio.currentTime / audio.duration;
  document.querySelectorAll(".wave i").forEach((bar, i) => {
    bar.classList.toggle("listened", (i + 1) / wave.length <= playedFraction);
  });
}

function showAudioError() {
  const message = document.querySelector("#player-error");
  if (message) message.hidden = false;
}

async function playAudio(restart = false) {
  const message = document.querySelector("#player-error");
  if (!message) return;
  message.hidden = true;
  if (audio.error) audio.load();
  if (restart || audio.ended) audio.currentTime = 0;
  else if (!audio.paused) {
    audio.pause();
    return;
  }

  try {
    await audio.play();
  } catch (error) {
    if (error.name !== "AbortError") showAudioError();
  }
  updatePlayer();
}

function finish() {
  if (round.finished) return;
  const { lesson, day, daily } = round;
  const correct = countCorrect();
  const prior = progress.best[lesson.id] ?? 0;
  progress.best[lesson.id] = Math.max(prior, correct);
  const today = dateKey();
  if (!progress.days.includes(today)) progress.days.push(today);
  if (daily && day === today) {
    const completed = (progress.daily[day] ??= []);
    if (!completed.includes(lesson.level)) completed.push(lesson.level);
  }
  round.earned = 10 * Math.max(0, correct - prior);
  round.finished = true;
  audio.pause();
  storeProgress();
  render(true);
}

const actions = {
  home: () => navigate("home"),
  lessons: () => navigate("lessons"),
  progress: () => navigate("progress"),
  level: button => {
    const wasCatalog = view === "lessons";
    selectLevel(button.dataset.level);
    navigate("lessons");
    if (wasCatalog) screen.querySelector('[aria-pressed="true"]')?.focus();
  },
  daily: () => openLesson(dailyLesson(), true),
  lesson: button => openLesson(lessons.find(lesson => lesson.id === button.dataset.id)),
  retry: () => openLesson(round.lesson, round.daily),
  play: () => playAudio(),
  replay: () => playAudio(true),
  "start-quiz": () => {
    if (!round.unlocked) return;
    round.started = true;
    refreshQuiz(".quiz-title");
  },
  answer: button => {
    if (round.answers[round.index] !== undefined) return;
    const option = Number(button.dataset.option);
    round.answers[round.index] = option;
    const correct = option === round.lesson.questions[round.index].answer;
    telegram?.HapticFeedback?.notificationOccurred(correct ? "success" : "error");
    refreshQuiz(".feedback");
  },
  next: () => {
    if (round.answers[round.index] === undefined) return;
    if (round.index + 1 === round.lesson.questions.length) {
      finish();
      return;
    }
    round.index += 1;
    refreshQuiz(".quiz-title");
  },
};

document.addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");
  if (button && !button.disabled) actions[button.dataset.action]?.(button);
});
for (const event of ["timeupdate", "loadedmetadata", "play", "pause", "emptied"]) {
  audio.addEventListener(event, updatePlayer);
}
audio.addEventListener("ended", () => {
  updatePlayer();
  if (round && !round.unlocked) {
    round.unlocked = true;
    refreshQuiz('[data-action="start-quiz"]');
  }
});
audio.addEventListener("error", showAudioError);
window.addEventListener("storage", event => {
  if (event.key !== storageKey) return;
  progress = loadProgress();
  if (view === "round") document.querySelector("#points").textContent = score() + " XP";
  else render();
});

function connectTelegram() {
  const webApp = window.Telegram?.WebApp;
  if (!webApp || telegram) return;

  telegram = webApp;
  telegram.BackButton?.onClick(() => navigate(view === "round" ? "lessons" : "home"));
  updateTabs();
  telegram.ready();
  telegram.expand();
}

document.querySelector("#telegram-sdk").addEventListener("load", connectTelegram, { once: true });
render();
connectTelegram();

