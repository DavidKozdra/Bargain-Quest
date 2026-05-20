const reviewData = {
  overall: 7.3,
  summary:
    "This is a real game project with meaningful scope, live systems, and unusually solid automated coverage for a browser game. The ceiling is high, but the current structure is being held back by oversized files, global-state coupling, and UI code that is too entangled to scale cleanly.",
  scores: [
    {
      label: "Feature Depth",
      value: 9.0,
      note: "The project has breadth: trading, combat, city management, diplomacy, space travel, saves, and content systems."
    },
    {
      label: "Testing",
      value: 8.8,
      note: "The repo has a strong safety net. Local test execution passed all 141 tests."
    },
    {
      label: "Architecture",
      value: 6.8,
      note: "There is clear intent toward modularization, but large controllers and `window` coupling still dominate the runtime."
    },
    {
      label: "Maintainability",
      value: 5.0,
      note: "A few giant files carry too much behavior, which raises change risk and slows future iteration."
    },
    {
      label: "UI Consistency",
      value: 5.8,
      note: "The game ships a lot of UI, but patterns are mixed across CSS, inline styles, DOM scripting, and blocking browser dialogs."
    },
    {
      label: "Production Readiness",
      value: 6.6,
      note: "Functional and playable, but not yet structurally tidy enough to call polished engineering."
    }
  ],
  strengths: [
    {
      title: "The project is not a prototype anymore",
      detail:
        "This is well beyond a toy codebase. The repo has multiple game layers, reusable engine work, content pipelines, save adapters, and a large number of feature-specific tests."
    },
    {
      title: "Automated tests are doing real work",
      detail:
        "The current test run passed `141/141`, covering save/load, world generation, UI utilities, city systems, combat, space travel, and content rules. That is a major strength."
    },
    {
      title: "There is a visible modularization effort",
      detail:
        "The split between game-specific code and `Koz_Engine_Lib/` is the right direction. The engine docs and migration roadmap show deliberate architectural intent rather than random file growth."
    },
    {
      title: "Gameplay systems have depth and interaction",
      detail:
        "City management, diplomacy, directives, unit logistics, and space-travel hooks show system layering instead of shallow menu features."
    },
    {
      title: "The codebase has observable quality signals",
      detail:
        "There are dedicated adapters, test files, docs, runtime error reporting, and explicit state-management helpers. Those are signs of engineering discipline."
    }
  ],
  weaknesses: [
    {
      title: "Several files are too large to manage comfortably",
      detail:
        "`ui.js` is about `8071` lines, `game.js` about `6474`, `classes/CityManagement.js` about `5481`, and `ui/cityManagement.js` about `4751`. Files that size become change-hazards."
    },
    {
      title: "Global-state coupling is still heavy",
      detail:
        "Core modules repeatedly read from `window`, rely on `typeof ... !== 'undefined'` guards, and pull runtime dependencies implicitly. That makes behavior harder to reason about and harder to isolate."
    },
    {
      title: "UI implementation patterns are inconsistent",
      detail:
        "The project mixes stylesheet-driven UI, inline styling, direct `document.createElement` flows, p5 DOM helpers, and browser-native `prompt` or `confirm` dialogs. That inconsistency makes the UX feel less cohesive."
    },
    {
      title: "Event lifecycle management is uneven",
      detail:
        "There are many event listeners across `game.js`, `ui.js`, and `ui/cityManagement.js`. Some are cleaned up, but the pattern is not centralized, which increases leak and duplication risk over time."
    },
    {
      title: "The architecture is mid-migration",
      detail:
        "The repo is clearly moving toward a cleaner engine/game separation, but it is not there yet. That creates a transitional tax where both old and new patterns coexist."
    }
  ],
  evidence: [
    {
      label: "Tests Passing",
      value: "141 / 141",
      detail: "Executed with `node tests/run-unit-tests.js`."
    },
    {
      label: "Largest JS File",
      value: "8,071 lines",
      detail: "`ui.js` is the biggest file in the repo and a strong indicator of over-centralized UI logic."
    },
    {
      label: "Game Runtime Size",
      value: "6,474 lines",
      detail: "`game.js` still acts as a major coordination hub rather than a thin entry layer."
    },
    {
      label: "City Mgmt Logic",
      value: "5,481 lines",
      detail: "`classes/CityManagement.js` carries too much policy, state, and progression behavior in one place."
    },
    {
      label: "City Mgmt UI",
      value: "4,751 lines",
      detail: "`ui/cityManagement.js` is large enough that UI composition and behavior should be split further."
    },
    {
      label: "Review Signal",
      value: "Mixed but Strong",
      detail: "The repo is better than average for feature depth and testing, weaker than average for cohesion and maintainability."
    }
  ],
  verdict: [
    "The project is <strong>good and real</strong>, not sloppy throwaway work. The strongest evidence is the passing test surface and the amount of coherent gameplay infrastructure already in place.",
    "The biggest problem is not missing features. It is <strong>structural concentration</strong>: too much code and too many responsibilities live in a few massive files with too much implicit global wiring.",
    "If those large controllers are split into smaller domain modules and the runtime keeps moving away from direct `window` access, the score can move from <strong>7.3/10</strong> into the <strong>8+</strong> range without needing a redesign."
  ]
};

function renderScores() {
  const grid = document.getElementById("scoreGrid");
  reviewData.scores.forEach((score) => {
    const card = document.createElement("article");
    card.className = "score-card";
    card.innerHTML = `
      <div class="score-row">
        <h3>${score.label}</h3>
        <span class="score-value">${score.value.toFixed(1)}</span>
      </div>
      <div class="meter" aria-hidden="true">
        <div class="meter-fill" style="width:${score.value * 10}%"></div>
      </div>
      <p>${score.note}</p>
    `;
    grid.appendChild(card);
  });
}

function renderFacts(targetId, items, tone) {
  const root = document.getElementById(targetId);
  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = `fact ${tone}`;
    card.innerHTML = `
      <h3>${item.title}</h3>
      <p>${item.detail}</p>
    `;
    root.appendChild(card);
  });
}

function renderEvidence() {
  const grid = document.getElementById("evidenceGrid");
  reviewData.evidence.forEach((item) => {
    const card = document.createElement("article");
    card.className = "evidence-card";
    card.innerHTML = `
      <h3>${item.label}</h3>
      <span class="evidence-value">${item.value}</span>
      <p>${item.detail}</p>
    `;
    grid.appendChild(card);
  });
}

function renderVerdict() {
  const verdict = document.getElementById("verdict");
  verdict.innerHTML = reviewData.verdict.map((line) => `<p>${line}</p>`).join("");
}

document.getElementById("overallScore").textContent = reviewData.overall.toFixed(1);
document.getElementById("scoreSummary").textContent = reviewData.summary;
renderScores();
renderFacts("strengthsList", reviewData.strengths, "good");
renderFacts("weaknessesList", reviewData.weaknesses, "bad");
renderEvidence();
renderVerdict();
