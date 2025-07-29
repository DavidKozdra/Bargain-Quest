

uiManager.registerScreen("mainMenu", {
  validStates: [GameStates.MAIN_MENU],

  create: () => {
    const parent = createDiv().id("mainMenu").class("screen");

    // Game Title
    createElement("h1", "BARGAIN QUEST  ").parent(parent).addClass("main-title");

    // === START GAME BUTTON ===
    createButton("Start Game")
      .parent(parent)
      .addClass("menu-btn")
      .mousePressed(() => {
        gameStateManager.setState(GameStates.PLAYING);
      });

    createButton("Settings")
      .parent(parent)
      .addClass("menu-btn")
      .mousePressed(() => {
        gameStateManager.setState(GameStates.SETTINGS);
      });

    // === Quit Button ===
    createButton("Quit Game")
      .parent(parent)
      .addClass("menu-btn")
      .mousePressed(() => {
        window.close(); // or custom logic
      });

    return parent;
  },

  show: () => {
    const m = select("#mainMenu");
    if (m) {
      m.show();
      m.style("opacity", "1");
    }
  },

  hide: () => {
    const m = select("#mainMenu");
    if (m) {
      m.style("opacity", "0");
      setTimeout(() => m.hide(), 200);
    }
  }
});
uiManager.registerScreen("viewEditor", {
  validStates: [GameStates.PLAYING],

  create: () => {
    const parent = createDiv()
      .id("viewEditor")
      .class("screen")
      .style("top", "0px")
      .style("left", "50%")
      .style("transform", "translateX(-50%)");

    // Day Display
    createDiv("Day: ").id("dayDisplay").parent(parent)
      .child(createSpan("0").id("dayCount"));

    // View Menu
    const viewMenu = createDiv().id("viewMenu").class("view-menu").parent(parent);
    const header = createDiv().id("viewToggle").class("view-header").parent(viewMenu);
    createSpan("Views").parent(header);
    createSpan("▼").id("toggleArrow").parent(header);

    const viewList = createDiv().id("viewList").class("view-list").parent(viewMenu);
    createButton("＋").id("addViewBtn").class("add-btn").parent(viewMenu);

    // Form
    const form = createDiv().id("viewForm").class("view-form").style("display", "none").parent(parent);
    createButton("X").id("closeViewButton").parent(form);

    createElement("label", "Name:<br>").parent(form)
      .child(createInput().id("viewName").attribute("placeholder", "e.g. Side View"));

    const projLabel = createElement("label", "Projection:<br>").parent(form);
    const selectEl = createSelect().id("viewType").parent(projLabel);
    selectEl.option("orthographic");
    selectEl.option("perspective");

    createElement("label", "Rotate X (deg):<br>").parent(form)
      .child(createInput("number").id("viewRotX").value(30));

    createElement("label", "Rotate Y (deg):<br>").parent(form)
      .child(createInput("number").id("viewRotY").value(-45));

    createButton("Save").id("saveViewBtn").parent(form);

    // View settings from localStorage
    let stored = localStorage.getItem('viewSettings');
    viewSettings = stored ? JSON.parse(stored) : [
      { name: 'Isometric', type: 'orthographic', rotX: 30, rotY: -45 },
      { name: 'Top-Down', type: 'orthographic', rotX: 270, rotY: -180, callBack: setTopDown }
    ];
    localStorage.setItem('viewSettings', JSON.stringify(viewSettings));

    // Render buttons
    viewList.html('');
    viewSettings.forEach((v, i) => {
      const btn = createButton(v.name).addClass("view-btn").parent(viewList);
      btn.id(`view-btn-${i}`);
    });

    // Default view
    currentView = viewSettings[0];
    isOrtho = currentView.type === "orthographic";
    camRotX = radians(currentView.rotX);
    camRotY = radians(currentView.rotY);

    return parent;
  },

  show: () => {
    const screen = select("#viewEditor");
    if (screen) {
      screen.show().style("opacity", "1");
    }

    // Toggle view list
    select("#viewToggle")?.mousePressed(() => {
      const list = select("#viewList");
      list?.toggleClass("expanded");
      const arrow = select("#toggleArrow");
      arrow?.html(list.hasClass("expanded") ? "▲" : "▼");
    });

    select("#addViewBtn")?.mousePressed(() => toggleForm(true));
    select("#closeViewButton")?.mousePressed(() => toggleForm(false));
    select("#saveViewBtn")?.mousePressed(saveNewView);

    viewSettings.forEach((v, i) => {
      select(`#view-btn-${i}`)?.mousePressed(() => setView(i));
    });

  },

  update:() => {

    select("#dayCount")?.html(dayNight.daysElapsed);
  },

  hide: () => {
    const screen = select("#viewEditor");
    if (screen) {
      screen.style("opacity", "0");
      setTimeout(() => screen.hide(), 200);
    }
  }
});



function addViewButton(view, idx) {
  const list = select('#viewList');
  const btn = createButton(view.name).addClass('view-btn').parent(list);
  btn.mousePressed(() => setView(idx));
}

function setView(idx) {
  currentView = viewSettings[idx];

  if (currentView.callBack) {
    currentView.callBack();
    console.log("callBack");
    toggleForm(false);
    return;
  }

  isOrtho = currentView.type === 'orthographic';
  camRotX = radians(currentView.rotX);
  camRotY = radians(currentView.rotY);

  toggleForm(false);
}

function toggleForm(show) {
  const f = select('#viewForm');
  if (!f) return;

  if (typeof show === 'boolean') {
    f.style('display', show ? 'flex' : 'none');
  } else {
    const current = f.style('display');
    f.style('display', current === 'flex' ? 'none' : 'flex');
  }
}

function saveNewView() {
  const name = select('#viewName').value().trim();
  const type = select('#viewType').value();
  const rotX = parseFloat(select('#viewRotX').value());
  const rotY = parseFloat(select('#viewRotY').value());

  if (!name) {
    alert('Enter a name for your view');
    return;
  }

  const v = { name, type, rotX, rotY };
  viewSettings.push(v);
  localStorage.setItem('viewSettings', JSON.stringify(viewSettings));
  addViewButton(v, viewSettings.length - 1);
  toggleForm(false);
}


uiManager.registerScreen("pauseMenu", {
  validStates: [GameStates.PAUSED],

  create: () => {
    const wrapper = createDiv().id("pauseMenu").class("screen");

    createElement("h2", "Game Paused").parent(wrapper);

    createButton("Resume")
      .parent(wrapper)
      .addClass("pause-btn")
      .mousePressed(() => {
        gameStateManager.setState(GameStates.PLAYING);
      });

    createButton("Settings")
      .parent(wrapper)
      .addClass("pause-btn")
      .mousePressed(() => {
        console.log("!!! !!@!@")
        gameStateManager.setState(GameStates.SETTINGS);
      });

    createButton("Quit to Main Menu")
      .parent(wrapper)
      .addClass("pause-btn")
      .mousePressed(() => {
        gameStateManager.setState(GameStates.MAIN_MENU);
      });

    return wrapper;
  },

  show: () => {
    const pauseWrapper = select("#pauseMenu");
    if (pauseWrapper) {
      pauseWrapper.show();
      pauseWrapper.style("opacity", "1");
    }
  },

  hide: () => {
    const pauseWrapper = select("#pauseMenu");
    if (pauseWrapper) {
      pauseWrapper.style("opacity", "0");
      setTimeout(() => pauseWrapper.hide(), 200);
    }
  }
});

uiManager.registerScreen("settingsMenu", {
  validStates: [
    GameStates.SETTINGS,
  ],

  create: () => {
    const wrapper = createDiv().id("settingsMenu").class("screen");

    createElement("h2", "Settings").parent(wrapper);

    // Music Volume
    const musicLabel = createP("Music Volume").parent(wrapper);
    const musicSlider = createSlider(0, 1, 0.5, 0.01).id("musicSlider").parent(wrapper);

    // Game Volume
    const gameLabel = createP("Game Volume").parent(wrapper);
    const gameSlider = createSlider(0, 1, 0.5, 0.01).id("gameSlider").parent(wrapper);

    // Clear Data
    createButton("Clear All Saved Data")
      .parent(wrapper)
      .addClass("danger-btn")
      .mousePressed(() => {
        if (confirm("Are you sure? This will delete all saved settings.")) {
          localStorage.clear();
          musicSlider.value(0.5);
          gameSlider.value(0.5);
          saveSettings();
        }
      });

    // Back Button
    createButton("Back")
      .parent(wrapper)
      .addClass("settings-btn")
      .mousePressed(() => {
        console.log(gameStateManager.prev)

        gameStateManager.setState(gameStateManager.prev);
      });

    return wrapper;
  },

  show: () => {
    const m = select("#settingsMenu");
    if (m) {
      m.show();
      m.style("opacity", "1");

      // Load from localStorage
      const music = parseFloat(localStorage.getItem("music_vol")) || 0.5;
      const game = parseFloat(localStorage.getItem("game_vol")) || 0.5;

      select("#musicSlider").value(music);
      select("#gameSlider").value(game);

      // Watch for changes
      select("#musicSlider").input(() => saveSettings());
      select("#gameSlider").input(() => saveSettings());
    }
  },

  hide: () => {
    const m = select("#settingsMenu");
    if (m) {
      m.style("opacity", "0");
      setTimeout(() => m.hide(), 200);
    }
  }
});
