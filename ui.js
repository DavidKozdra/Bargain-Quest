

uiManager.registerScreen("mainMenu", {
  validStates: [GameStates.MAIN_MENU],

  create: () => {
    const parent = createDiv().id("mainMenu").class("screen");

    // Game Title
    createElement("h1", "Main Menu").parent(parent).addClass("main-title");

    // === START GAME BUTTON ===
    createButton("Start Game")
      .parent(parent)
      .addClass("menu-btn")
      .mousePressed(() => {
        gameStateManager.setState(GameStates.PLAYING);
      });

    // === VIEW EDITOR SECTION ===
    createElement("h3", "Quick View Editor").parent(parent);


    createButton("Open View Editor")
      .parent(parent)
      .addClass("menu-btn")
      .mousePressed(() => {
        gameStateManager.setState(GameStates.VIEW_EDIT);
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
  validStates: [GameStates.VIEW_EDIT],

  create: () => {
    const parent = createDiv().id("viewEditor").class("screen");

    // Day Display
    const dayDisplay = createDiv("Day: ").parent(parent).id("dayDisplay");
    createSpan("0").parent(dayDisplay).id("dayCount");

    // View Menu
    const viewMenu = createDiv().parent(parent).class("view-menu").id("viewMenu");
    const header = createDiv().parent(viewMenu).class("view-header").id("viewToggle");
    createSpan("Views").parent(header);
    const toggleArrow = createSpan("▼").parent(header).id("toggleArrow");

    const viewList = createDiv().parent(viewMenu).class("view-list").id("viewList");
    const addViewBtn = createButton("＋").parent(viewMenu).class("add-btn").id("addViewBtn");

    // Form
    const viewForm = createDiv().parent(parent).class("view-form").id("viewForm").style("display", "none");
    createButton("X").parent(viewForm).mousePressed(() => toggleForm(false));

    createElement("label", "Name:<br>").parent(viewForm)
      .child(createInput().attribute("placeholder", "e.g. Side View").id("viewName"));

    const projLabel = createElement("label", "Projection:<br>").parent(viewForm);
    createSelect().id("viewType").parent(projLabel)
      .option("orthographic")
      .option("perspective");

    createElement("label", "Rotate X (deg):<br>").parent(viewForm)
      .child(createInput("number").value(30).id("viewRotX"));

    createElement("label", "Rotate Y (deg):<br>").parent(viewForm)
      .child(createInput("number").value(-45).id("viewRotY"));

    createButton("Save").parent(viewForm).id("saveViewBtn");

    return parent;
  },

  show: () => {
    console.log("Showing viewEditor");
    initViews();
  },

  hide: () => {
    console.log("Hiding viewEditor");
  }
});
function initViews() {
  const stored = localStorage.getItem('viewSettings');
  viewSettings = stored ? JSON.parse(stored) : [
    { name: 'Isometric', type: 'orthographic', rotX: 30, rotY: -45 },
    { name: 'Top-Down', type: 'orthographic', rotX: 270, rotY: -180, callBack: setTopDown }
  ];
  localStorage.setItem('viewSettings', JSON.stringify(viewSettings));

  const list = select('#viewList');
  list.html('');

  viewSettings.forEach((v, i) => addViewButton(v, i));

  select('#viewToggle').mousePressed(() => {
    list.toggleClass('expanded');
    const arrow = select('#toggleArrow');
    arrow.html(list.hasClass('expanded') ? '▲' : '▼');
  });

  select('#addViewBtn').mousePressed(() => toggleForm(true));
  select('#saveViewBtn').mousePressed(saveNewView);

  setView(0);
}

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

    createElement("h2", "Paused").parent(wrapper);

    createButton("Resume")
      .parent(wrapper)
      .addClass("pause-btn")
      .mousePressed(() => {
        gameStateManager.setState(GameStates.PLAYING);
      });

    // Optional: add buttons here for settings, quit, etc.
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
