

uiManager.registerScreen("mainMenu", {
  validStates: [GameStates.MAIN_MENU],

  create: () => {
    const parent = createDiv().id("mainMenu").class("screen");

    createImg("./assets/images/logo.png", "Game Logo")
      .style("width", "150px")
      .style("margin-bottom", "20px")
      .parent(parent);

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
  validStates: [],

  create: () => {
    const parent = createDiv()
      .id("viewEditor")
      .class("screen")
      .style("top", "20px")
      .style("left", "40%")
      .style("transform", "translateX(-50%)")
      .style("background", "rgba(25, 25, 25, 0.95)")
      .style("border-radius", "10px")
      .style("padding", "20px")
      .style("min-width", "480px")
      .style("box-shadow", "0 0 15px rgba(0,0,0,0.3)");

    // View Menu
    const header = createDiv().id("viewToggle").class("view-header").parent(parent);
    createSpan("Saved Views").parent(header);
    createSpan("▼").id("toggleArrow").parent(header);

    const viewList = createDiv().id("viewList").class("view-list").parent(parent);
    createButton("＋ New View").id("addViewBtn").class("add-btn").parent(parent)
      .style("margin-top", "6px");

    // View Form
    const form = createDiv().id("viewForm").class("view-form").style("display", "none").parent(parent);
    createButton("✖").id("closeViewButton").parent(form)
      .style("align-self", "flex-end")
      .style("margin-bottom", "10px");

    createElement("label", "Name").parent(form)
      .child(createInput().id("viewName").attribute("placeholder", "e.g. Isometric View"));

    createElement("label", "Projection").parent(form)
      .child(createSelect().id("viewType")
        .child(createElement("option", "orthographic"))
        .child(createElement("option", "perspective")));

    createElement("label", "Rotate X (deg)").parent(form)
      .child(createInput("number").id("viewRotX").value(30));

    createElement("label", "Rotate Y (deg)").parent(form)
      .child(createInput("number").id("viewRotY").value(-45));

    createButton("Save View").id("saveViewBtn").parent(form);

    // Load saved views
    let stored = localStorage.getItem('viewSettings');
    viewSettings = stored ? JSON.parse(stored) : [
      { name: 'Isometric', type: 'orthographic', rotX: 30, rotY: -45 },
      { name: 'Top-Down', type: 'orthographic', rotX: 270, rotY: -180, callBack: setTopDown }
    ];
    localStorage.setItem('viewSettings', JSON.stringify(viewSettings));

    // Render view buttons
    viewList.html('');
    viewSettings.forEach((v, i) => {
      createButton(v.name)
        .addClass("view-btn")
        .id(`view-btn-${i}`)
        .parent(viewList);
    });

    // Set default view
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

  update: () => {

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

function saveSettings() {
  const musicVal = parseFloat(select("#musicSlider")?.value()) || 0;
  const gameVal = parseFloat(select("#gameSlider")?.value()) || 0;

  localStorage.setItem("music_vol", musicVal.toFixed(2));
  localStorage.setItem("game_vol", gameVal.toFixed(2));

  // Optional: apply volume to your audio engine here
  if (typeof sound !== "undefined") {
    if (sound.setMusicVolume) sound.setMusicVolume(musicVal);
    if (sound.setGameVolume) sound.setGameVolume(gameVal);
  }
}


uiManager.registerScreen("cityView", {
  validStates: [GameStates.PLAYING],

  create: () => {
    const wrapper = createDiv().id("cityView").class("screen").style("display", "none");

    // === Header (City name + Population) ===
    const headerBox = createDiv()
      .style("display", "flex")
      .style("align-items", "center")
      .style("gap", "20px")
      .style("margin-bottom", "12px")
      .parent(wrapper);

    createDiv()
      .id("cityNameWrapper")
      .style("background", "url('./assets/images/Sign.png') no-repeat center center")
      .style("background-size", "contain")
      .style("height", "10dvh")
      .style("width", "25dvw")
      .style("padding", "0 20px")
      .style("display", "flex")
      .style("align-items", "center")
      .style("justify-content", "center")
      .style("font-size", "28px")
      .style("font-weight", "bold")
      .style("color", "#fff")
      .parent(headerBox);

    const popRow = createDiv()
      .style("display", "flex")
      .style("align-items", "center")
      .style("gap", "10px")
      .parent(headerBox);

    createImg("./assets/images/people.png", "population icon")
      .style("width", "50px")
      .style("height", "50px")
      .parent(popRow);

    createSpan("").id("cityPopulation").style("font-size", "18px").style("color", "#ccc").parent(popRow);

    // === Shop ===
    createElement("h3", "Shop Inventory").parent(wrapper);

    createDiv()
      .id("shopScroll")
      .style("display", "flex")
      .style("flex-wrap", "wrap")
      .style("width", "100%")
      .parent(wrapper);

    // === Leave and Fast Travel Buttons Row ===
    const buttonRow = createDiv().style("display", "flex").style("gap", "10px").style("margin-top", "12px").parent(wrapper);

    createButton("Leave City")
      .parent(buttonRow)
      .addClass("settings-btn")
      .mousePressed(() => {
        const safe = findNearestSafeTile(player.x, player.y, cities);
        if (safe) {
          player.x = safe.x;
          player.y = safe.y;
        }
        player.currentCity = null;
        uiManager.screens["cityView"].hide();
      });

    const fastTravelBtn = createButton("Go to Nearby City")
      .parent(buttonRow)
      .addClass("settings-btn")
      .mousePressed(() => {
        const current = player.currentCity;
        const closest = findClosestCity(current, cities);
        if (closest) {
          player.currentCity = null

          uiManager.screens["cityView"].update();
          player.fastTravelToCity(closest.city);

          uiManager.screens["cityView"].show();
        } else {
        }
      });

    return wrapper;
  },

  show: () => {
    const view = select("#cityView");
    if (!view || !player.currentCity) return;
    view.show().style("opacity", "1");

    const city = player.currentCity;
    select("#cityNameWrapper").html(city.name);
    select("#cityPopulation").html(`Population: ${city.population}`);

    // Update fast travel button text
    const closest = findClosestCity(city, cities);
    const fastTravelBtn = selectAll("button").find(btn => btn.html().startsWith("Go to"));
    if (closest && fastTravelBtn) {
      fastTravelBtn.html(`Fast Travel to ${closest.name}`);
    }

    const shopScroll = select("#shopScroll");
    shopScroll.html("");

    const sortedItems = Object.entries(ItemLibrary).sort(([a], [b]) => {
      return (city.inventory.has(b) ? 1 : 0) - (city.inventory.has(a) ? 1 : 0);
    });

    for (const [itemKey, itemData] of sortedItems) {
      const cityEntry = city.inventory.get(itemKey);
      const playerEntry = player.inventory.get(itemKey);
      const cityQty = cityEntry?.quantity || 0;
      const playerQty = playerEntry?.quantity || 0;
      const price = city.calculateItemPrice(itemKey, cities);
      const sellPrice = Math.floor(price * 0.6);
      const canBuy = player.gold >= price && cityQty > 0;
      const canSell = playerQty > 0;

      const itemDiv = createDiv().class("shop-item").parent(shopScroll)
        .style("flex", "1 1 300px")
        .style("padding", "12px")
        .style("background", "#1e1e1e")
        .style("border-radius", "6px")
        .style("display", "flex")
        .style("flex-direction", "column")
        .style("align-items", "center");

      createImg(`./assets/images/${itemKey.toLowerCase()}.png`, `${itemKey}`)
        .style("width", "48px")
        .style("height", "48px")
        .style("margin-bottom", "6px")
        .parent(itemDiv);

      createP(itemData.name)
        .style("font-weight", "bold")
        .style("margin", "0 0 6px 0")
        .style("color", "#fff")
        .parent(itemDiv);

      createP(`City: x${cityQty} — You: x${playerQty}`)
        .style("font-size", "0.9em")
        .style("margin", "0 0 8px 0")
        .style("color", "#aaa")
        .parent(itemDiv);

      const buttonGroup = createDiv().parent(itemDiv)
        .style("display", "flex")
        .style("gap", "8px")
        .style("width", "100%");

      createButton(`Buy $${price}`)
        .parent(buttonGroup)
        .style("flex", "1")
        .style("padding", "6px")
        .style("background", canBuy ? "#4CAF50" : "#333")
        .style("color", canBuy ? "#fff" : "#777")
        .style("border", "none")
        .style("border-radius", "4px")
        .mousePressed(() => {
          if (canBuy) {
            player.spendGold(price);
            player.addItem(itemData);
            cityEntry.quantity--;
            uiManager.screens["cityView"].show();
          }
        });

      createButton(`Sell $${sellPrice}`)
        .parent(buttonGroup)
        .style("flex", "1")
        .style("padding", "6px")
        .style("background", canSell ? "#1976D2" : "#333")
        .style("color", canSell ? "#fff" : "#777")
        .style("border", "none")
        .style("border-radius", "4px")
        .mousePressed(() => {
          if (canSell) {
            player.earnGold(sellPrice);
            player.removeItem(itemData);
            if (!cityEntry) {
              city.inventory.set(itemKey, { item: itemData, quantity: 1 });
            } else {
              cityEntry.quantity++;
            }
            uiManager.screens["cityView"].show();
          }
        });
    }
  },

  hide: () => {
    const view = select("#cityView");
    if (view) {
      view.style("opacity", "0");
      setTimeout(() => view.hide(), 200);
    }
  },

  update: () => {
    const view = select("#cityView");
    const shouldBeVisible = player.currentCity;
    if (shouldBeVisible && view?.style("display") === "none") {
      uiManager.screens["cityView"].show();
    } else if (!shouldBeVisible && view?.style("display") !== "none") {
      uiManager.screens["cityView"].hide();
    }
  }
});



uiManager.registerScreen("playerView", {
  validStates: [GameStates.PLAYING],

  create: () => {
    const bar = createDiv()
      .id("playerView")
      .class("screen")
      .style("position", "absolute")
      .style("bottom", "0")
      .style("left", "0")
      .style("right", "10%")
      .style("padding", "12px 24px")
      .style("background", "rgba(15, 15, 15, 0.95)")
      .style("color", "#eee")
      .style("font-size", "26px")
      .style("display", "none")
      .style("z-index", "1000")
      .style("border-top", "2px solid #333")
      .style("display", "flex")
      .style("justify-content", "space-between")
      .style("align-items", "center")
      .style("gap", "30px");

    const statsWrapper = createDiv().parent(bar).style("display", "flex").style("gap", "30px");
    const dayWrapper = createDiv().parent(bar).style("font-weight", "bold");

    createSpan("").id("playerGold").parent(statsWrapper);
    createSpan("").id("playerParty").parent(statsWrapper);
    createSpan("").id("playerInventory").parent(statsWrapper);
    createSpan("").id("dayLabel").parent(dayWrapper);


    const eventWrapper = createDiv()
      .id("eventLog")
      .parent(bar)
      .style("flex", "1")
      .style("max-height", "60px")
      .style("overflow-y", "auto")
      .style("color", "#d4af37")
      .style("font-size", "16px")
      .style("font-family", "serif")
      .style("padding-left", "10px");

    return bar;
  },

  show: () => {
    const view = select("#playerView");
    if (view) view.show();
    uiManager.screens["playerView"].update();
  },

  hide: () => {
    const view = select("#playerView");
    if (view) view.hide();
  },

  update: () => {
    if (!player) return;

    select("#playerGold")?.html(`Gold: <strong>${player.gold}</strong>`);
    select("#playerParty")?.html(`Party: <strong>${player.party.length} / ${player.partyLimit}</strong>`);

    const inv = [...player.inventory.entries()]
      .filter(([key]) => key in ItemLibrary)
      .map(([key, entry]) => `${ItemLibrary[key].name} × ${entry.quantity}`)
      .join(", ");

    select("#playerInventory")?.html(`Inventory: <strong>${inv || "Empty"}</strong>`);
    const dayNum = dayNight.getDaysElapsed();
    const weekday = dayNight.getDayOfWeek();
    const season = dayNight.getSeason();
    const year = dayNight.getYear();
    select("#dayLabel")?.html(`Year ${year}, ${season} — Day ${dayNum} (${weekday})`);

  }
});
uiManager.registerScreen("gameWonView", {
  validStates: [GameStates.GAMEWON],

  create: () => {
    const wrapper = createDiv()
      .id("gameWonView")
      .class("screen")
      .style("display", "none");

    createElement("h1", "Victory!")
      .parent(wrapper)
      .style("color", "var(--accent)");

    createP("You've reached 5000 gold. You may continue playing!")
      .style("margin-bottom", "20px")
      .parent(wrapper);

    createButton("Keep Playing")
      .parent(wrapper)
      .addClass("menu-btn")
      .mousePressed(() => {
        gameStateManager.setState(GameStates.PLAYING);
      });

    return wrapper;
  },

  show: () => {
    select("#gameWonView")?.show();
  },

  hide: () => {
    select("#gameWonView")?.hide();
  },
});



uiManager.registerScreen("gameWonView", {
  validStates: [GameStates.GAMEWON],

  create: () => {
    const wrapper = createDiv()
      .id("gameWonView")
      .class("screen")
      .style("display", "none");

    createElement("h1", "Victory!")
      .parent(wrapper)
      .style("color", "var(--accent)");

    createP("You've reached 5000 gold. You may continue playing!")
      .style("margin-bottom", "20px")
      .parent(wrapper);

    createButton("Keep Playing")
      .parent(wrapper)
      .addClass("menu-btn")
      .mousePressed(() => {
        player.hasWon = true
        gameStateManager.setState(GameStates.PLAYING);
        
      });

    return wrapper;
  },

  show: () => {
    select("#gameWonView")?.show();
  },

  hide: () => {
    select("#gameWonView")?.hide();
  },
});


uiManager.registerScreen("gameLoseView", {
  validStates: [GameStates.GAMELOSE],

  create: () => {
    const wrapper = createDiv()
      .id("gameLoseView")
      .class("screen")
      .style("display", "none");

    createElement("h1", "Defeat")
      .parent(wrapper)
      .style("color", "#ff4f4f");

    createP("You've run out of gold. Try again?")
      .style("margin-bottom", "20px")
      .parent(wrapper);

    createButton("Retry")
      .parent(wrapper)
      .addClass("menu-btn")
      .mousePressed(() => {
        location.reload(); // Reloads the page to retry
      });

    return wrapper;
  },

  show: () => {
    select("#gameLoseView")?.show();
  },

  hide: () => {
    select("#gameLoseView")?.hide();
  },
});
