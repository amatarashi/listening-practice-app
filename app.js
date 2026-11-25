import { lessons as content } from "./lessons.js?v=4";

const lessons = content.map(lesson => {
  const parts = lesson.parts ?? [{ audio: lesson.id, transcript: lesson.transcript, questions: lesson.questions }];
  return {
    ...lesson,
    parts,
    questionCount: parts.reduce((total, part) => total + part.questions.length, 0),
  };
});

const levels = [
  { id: "A1–A2", detail: "Простые ситуации" },
  { id: "B1", detail: "Истории по частям" },
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
  // Keep XP from earlier versions, including exercises that have left the catalog.
  return Object.values(progress.best).reduce((total, best) => {
    return Number.isSafeInteger(best) && best > 0 ? total + 10 * best : total;
  }, 0);
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

function currentPart() {
  return round.lesson.parts[round.partIndex];
}

function loadPart() {
  round.index = 0;
  round.answers = [];
  round.started = false;
  round.unlocked = false;
  round.checked = false;
  audio.src = "./assets/audio/" + currentPart().audio + ".mp3";
  render(true);
}

function openLesson(lesson, daily = false) {
  selectLevel(lesson.level);
  round = { lesson, daily, day: dateKey(), partIndex: 0, storyCorrect: 0, earned: 0, finished: false };
  view = "round";
  loadPart();
}

function home() {
  const daily = dailyLesson();
  const today = progress.daily[dateKey()] ?? [];
  const completedToday = today.includes(daily.id) || (level === "A1–A2" && today.includes(level));
  return [
    '<section class="hero">',
    '<div><p class="eyebrow">Английский на слух</p>',
    '<h1 tabindex="-1" lang="en">Listening<br><em>Practice</em></h1>',
    '<p class="lede">Короткие тренировки A1–A2 и истории по частям для B1.</p></div>',
    '<figure class="photo"><img src="./assets/london.jpg" alt="" fetchpriority="high">',
    '<figcaption lang="en">London after dark</figcaption></figure>',
    '</section><section class="section" aria-labelledby="choose">',
    '<div class="section-head"><h2 id="choose">Выбери уровень</h2><span class="small">' + lessons.length + ' тренировок</span></div>',
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
    '<p class="eyebrow">Уровни A1–B1</p><h1 tabindex="-1">Практика</h1>',
    '<div class="level-strip" role="group" aria-label="Уровень английского">',
    ...levels.map(item => '<button type="button" class="quiet" data-action="level" data-level="' + item.id +
      '" aria-pressed="' + (level === item.id) + '">' + item.id + '</button>'),
    '</div><div class="lesson-list">',
    ...levelLessons().map(lesson => {
      const best = progress.best[lesson.id];
      const content = lesson.parts.length > 1 ? lesson.parts.length + ' частей · 3–4 мин' : lesson.questionCount + ' вопроса';
      const label = best === undefined ? content : 'Лучший: ' + best + '/' + lesson.questionCount;
      return '<button type="button" class="lesson-row" data-action="lesson" data-id="' + lesson.id + '">' +
        '<div><h3 lang="en">' + lesson.title + '</h3><p class="description">' + lesson.description + '</p></div>' +
        '<div class="row-meta"><span class="small">' + label +
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

  if (lesson.parts.length > 1) return storyQuiz();

  const { questions } = currentPart();
  const question = questions[index];
  const selected = answers[index];
  const answered = selected !== undefined;
  const correct = selected === question.answer;

  return [
    '<div class="section-head small"><span>Вопрос ' + (index + 1) + ' из ' + questions.length +
      '</span><span>' + question.type + '</span></div>',
    '<div class="segments" aria-hidden="true">',
    ...questions.map((_, step) => '<span' + (step <= index ? ' class="filled"' : '') + '></span>'),
    '</div><h2 tabindex="-1" class="quiz-title" lang="en">' + question.text + '</h2><div class="options">',
    ...question.options.map((option, i) => {
      const state = answered && i === question.answer ? " right" : answered && i === selected ? " wrong" : "";
      return '<button type="button" class="option' + state + '" data-action="answer" data-option="' + i + '" lang="en"' +
        (answered ? ' disabled' : '') + '><strong aria-hidden="true">' + "ABC"[i] + '</strong>' + option + '</button>';
    }),
    '</div>',
    answered ? questionFeedback(question, correct) + '<div class="tight-actions">' +
      (!correct ? '<button type="button" class="quiet" data-action="replay">Переслушать</button>' : '') +
      '<button type="button" class="button" data-action="next">' +
      (index + 1 === questions.length ? 'К результату' : 'Следующий вопрос') + '</button></div>' : '',
  ].join("");
}

function questionFeedback(question, correct) {
  const title = correct ? 'Верно!' : 'Верный ответ: <span lang="en">' + question.options[question.answer] + '</span>';
  return '<div class="feedback' + (correct ? ' good' : '') + '" tabindex="-1"><strong>' +
    title + '</strong>' + question.explanation + '</div>';
}

function storyQuiz() {
  const { questions } = currentPart();
  const { checked, answers, partIndex, lesson } = round;
  const finalPart = partIndex + 1 === lesson.parts.length;
  return [
    checked ? '<p class="story-result" tabindex="-1">Верно ' + countCorrect() + ' из ' + questions.length + '</p>' :
      '<h2 class="story-result" tabindex="-1">Вопросы к части</h2><p class="small">Ответы можно менять до проверки.</p>',
    '<form id="story-answers">',
    ...questions.map((question, index) => {
      const selected = answers[index];
      const correct = selected === question.answer;
      return '<fieldset class="story-question"' + (checked ? ' disabled' : '') + '>' +
        '<legend class="quiz-title" lang="en">' + question.text + '</legend><div class="options">' +
        question.options.map((option, choice) => {
          const state = checked && choice === question.answer ? ' right' : checked && choice === selected ? ' wrong' : '';
          return '<label class="option' + state + '" lang="en">' +
            '<input type="radio" name="answer-' + index + '" value="' + choice + '" required' +
            (choice === selected ? ' checked' : '') + '><span>' + option + '</span></label>';
        }).join("") + '</div>' + (checked ? questionFeedback(question, correct) : '') + '</fieldset>';
    }),
    checked ? '<div class="tight-actions"><button type="button" class="quiet" data-action="replay">Переслушать</button>' +
      '<button type="button" class="button" data-action="next-part">' +
      (finalPart ? 'К результату' : 'Следующая часть') + '</button></div>' :
      '<button type="submit" class="button wide" disabled>Проверить</button>',
    '</form>',
  ].join("");
}

function transcript() {
  const { parts } = round.lesson;
  const text = parts.length === 1 ? '<p lang="en">' + parts[0].transcript + '</p>' :
    parts.map((part, index) => '<p><strong>Часть ' + (index + 1) + '</strong></p><p lang="en">' +
      part.transcript + '</p>').join("");
  return '<details class="transcript"><summary>Транскрипт</summary>' + text + '</details>';
}

function countCorrect() {
  return round.answers.filter((answer, i) => answer === currentPart().questions[i].answer).length;
}

function metric(value, label) {
  return '<div class="metric"><strong>' + value + '</strong><span>' + label + '</span></div>';
}

function result() {
  const todayStreak = currentStreak();
  const { totalCorrect, lesson } = round;
  return [
    '<p class="eyebrow">Тренировка завершена</p><h1 tabindex="-1">' +
      (totalCorrect === lesson.questionCount ? 'Отлично!' : 'Готово!') + '</h1>',
    '<div class="score">',
    metric(totalCorrect + '/' + lesson.questionCount, "верно"),
    metric('+' + round.earned, "XP"),
    metric(todayStreak, "дней подряд"),
    '</div>',
    round.earned === 0 ? '<p class="small">XP начисляются за улучшение личного результата.</p>' : '',
    lesson.parts.length === 1 ? player() : '', transcript(),
    '<div class="tight-actions"><button type="button" class="quiet" data-action="retry">Пройти ещё раз</button>',
    '<button type="button" class="button" data-action="lessons">К тренировкам</button></div>',
  ].join("");
}

function lessonScreen() {
  const { partIndex, lesson } = round;
  const story = lesson.parts.length > 1;
  const partProgress = story ? '<p class="small story-part">Часть ' + (partIndex + 1) + ' из ' + lesson.parts.length + '</p>' : '';
  return '<section class="page-narrow"><button type="button" class="quiet back" data-action="lessons">← Практика</button>' +
    (round.finished ? result() : [
      '<p class="eyebrow">' + round.lesson.level + (round.daily ? ' · Задание дня' : '') + '</p>',
      '<h1 tabindex="-1" lang="en">' + round.lesson.title + '</h1>',
      '<p class="lede">' + round.lesson.description + '</p>',
      partProgress, player(), '<section class="quiz" id="quiz" aria-label="Вопросы по записи">' + quiz() + '</section>',
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
  const correct = lesson.parts.length > 1 ? round.storyCorrect : countCorrect();
  const prior = progress.best[lesson.id] ?? 0;
  progress.best[lesson.id] = Math.max(prior, correct);
  const today = dateKey();
  if (!progress.days.includes(today)) progress.days.push(today);
  if (daily && day === today) {
    const completed = (progress.daily[day] ??= []);
    if (!completed.includes(lesson.id)) completed.push(lesson.id);
  }
  round.earned = 10 * Math.max(0, correct - prior);
  round.totalCorrect = correct;
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
    refreshQuiz(round.lesson.parts.length > 1 ? ".story-result" : ".quiz-title");
  },
  answer: button => {
    if (round.answers[round.index] !== undefined) return;
    const option = Number(button.dataset.option);
    round.answers[round.index] = option;
    const correct = option === currentPart().questions[round.index].answer;
    telegram?.HapticFeedback?.notificationOccurred(correct ? "success" : "error");
    refreshQuiz(".feedback");
  },
  next: () => {
    if (round.answers[round.index] === undefined) return;
    if (round.index + 1 === currentPart().questions.length) {
      finish();
      return;
    }
    round.index += 1;
    refreshQuiz(".quiz-title");
  },
  "next-part": () => {
    if (!round.checked) return;
    if (round.partIndex + 1 === round.lesson.parts.length) {
      finish();
      return;
    }
    round.partIndex += 1;
    loadPart();
  },
};

screen.addEventListener("change", event => {
  const form = event.target.closest("#story-answers");
  if (form) form.querySelector('button[type="submit"]').disabled = !form.checkValidity();
});

screen.addEventListener("submit", event => {
  const form = event.target;
  if (form.id !== "story-answers") return;
  event.preventDefault();
  if (round.checked || !form.checkValidity()) return;

  const choices = new FormData(form);
  round.answers = currentPart().questions.map((_, index) => Number(choices.get("answer-" + index)));
  round.checked = true;
  const correct = countCorrect();
  round.storyCorrect += correct;
  telegram?.HapticFeedback?.notificationOccurred(correct === currentPart().questions.length ? "success" : "error");
  refreshQuiz(".story-result");
});

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

