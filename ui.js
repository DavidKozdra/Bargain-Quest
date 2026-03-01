// ============================
// MAIN MENU
// ============================
uiManager.registerScreen("mainMenu", {
  validStates: [GameStates.MAIN_MENU],

  create: () => {
    const parent = createDiv().id("mainMenu").class("screen");

    createImg("./assets/images/logo.png", "Game Logo")
      .style("width", "150px")
      .style("margin-bottom", "20px")
      .parent(parent);

    createElement("h1", "BARGAIN QUEST").parent(parent).addClass("main-title");

    createButton("New Game")
      .parent(parent)
      .addClass("menu-btn")
      .mousePressed(() => {
        gameStateManager.setState(GameStates.NEW_GAME_CONFIG);
      });

    // Continue button (only if save exists)
    const continueBtn = createButton("Continue")
      .parent(parent)
      .addClass("menu-btn")
      .mousePressed(() => {
        if (typeof loadExistingGame === 'function') {
          loadExistingGame();
        }
      });
    continueBtn.id("continueBtn");

    createButton("Settings")
      .parent(parent)
      .addClass("menu-btn")
      .mousePressed(() => {
        gameStateManager.setState(GameStates.SETTINGS);
      });

    createButton("Quit Game")
      .parent(parent)
      .addClass("menu-btn")
      .mousePressed(() => {
        window.close();
      });

    return parent;
  },

  show: () => {
    const m = select("#mainMenu");
    if (m) {
      m.show();
      m.style("opacity", "1");
    }
    // Show/hide continue button based on save
    const cb = select("#continueBtn");
    if (cb) {
      const hasSave = typeof SaveSystem !== 'undefined' && SaveSystem.hasSave();
      cb.style("display", hasSave ? "block" : "none");
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


// ============================
// NEW GAME CONFIG (map size selection)
// ============================
uiManager.registerScreen("newGameConfig", {
  validStates: [GameStates.NEW_GAME_CONFIG],

  create: () => {
    const wrapper = createDiv().id("newGameConfig").class("screen");

    createElement("h2", "New Voyage").parent(wrapper).style("margin-bottom", "8px");
    createP("Choose the size of the world and set sail!")
      .parent(wrapper)
      .style("color", "#aaa")
      .style("margin-bottom", "16px");

    // Map size presets
    createElement("h3", "Map Size").parent(wrapper).style("margin-bottom", "6px");

    const presets = [
      { label: "Small (75×75)",    cols: 75,  rows: 75,  desc: "~8 cities, quick games" },
      { label: "Medium (150×150)", cols: 150, rows: 150, desc: "~15 cities, balanced" },
      { label: "Large (250×250)",  cols: 250, rows: 250, desc: "~25 cities, epic voyages" },
    ];

    // Track selection
    window._newGameMapCols = 150;
    window._newGameMapRows = 150;

    const presetRow = createDiv()
      .style("display", "flex")
      .style("gap", "10px")
      .style("flex-wrap", "wrap")
      .style("justify-content", "center")
      .style("margin-bottom", "12px")
      .parent(wrapper);

    for (const preset of presets) {
      const btn = createButton(preset.label)
        .parent(presetRow)
        .addClass("menu-btn map-size-btn")
        .attribute("data-cols", preset.cols)
        .attribute("data-rows", preset.rows)
        .mousePressed(() => {
          window._newGameMapCols = preset.cols;
          window._newGameMapRows = preset.rows;
          // Update slider to match
          const slider = select("#mapSizeSlider");
          if (slider) slider.value(preset.cols);
          // Update label
          updateMapSizeLabel();
          // Highlight
          selectAll(".map-size-btn").forEach(b => b.style("background", "#333").style("color", "#ccc"));
          btn.style("background", "#d4af37").style("color", "#000");
        });
      // Default highlight on medium
      if (preset.cols === 150) {
        btn.style("background", "#d4af37").style("color", "#000");
      }
    }

    // Custom slider
    createP("Or set custom size:").parent(wrapper).style("color", "#aaa").style("margin", "4px 0");

    const sliderRow = createDiv()
      .style("display", "flex")
      .style("align-items", "center")
      .style("gap", "10px")
      .style("justify-content", "center")
      .parent(wrapper);

    createSlider(50, 300, 150, 5)
      .id("mapSizeSlider")
      .parent(sliderRow)
      .style("width", "200px")
      .input(() => {
        const val = parseInt(select("#mapSizeSlider").value());
        window._newGameMapCols = val;
        window._newGameMapRows = val;
        updateMapSizeLabel();
        // Un-highlight presets
        selectAll(".map-size-btn").forEach(b => b.style("background", "#333").style("color", "#ccc"));
      });

    createSpan("150×150").id("mapSizeLabel").parent(sliderRow).style("color", "#fff").style("min-width", "80px");

    // Info line
    createP("").id("mapInfoLine")
      .parent(wrapper)
      .style("color", "#888")
      .style("font-size", "13px")
      .style("margin", "6px 0");

    // Difficulty / Frequency settings
    createElement("h3", "Game Settings").parent(wrapper).style("margin", "16px 0 6px");

    const settingsRow = createDiv()
      .style("display", "flex")
      .style("gap", "20px")
      .style("flex-wrap", "wrap")
      .style("justify-content", "center")
      .style("margin-bottom", "12px")
      .parent(wrapper);

    // Event frequency
    const eventCol = createDiv().parent(settingsRow).style("text-align", "center");
    createP("Event Frequency").parent(eventCol).style("color", "#ccc").style("margin", "4px 0");
    const eventSelect = createSelect().parent(eventCol);
    eventSelect.option("Low", 0.08);
    eventSelect.option("Medium", 0.16);
    eventSelect.option("High", 0.32);
    eventSelect.selected("Medium");
    eventSelect.style("padding", "4px 8px");
    eventSelect.style("background", "#333");
    eventSelect.style("color", "#fff");
    eventSelect.style("border", "1px solid #555");
    eventSelect.style("border-radius", "4px");

    // Raider frequency
    const raiderCol = createDiv().parent(settingsRow).style("text-align", "center");
    createP("Raiders").parent(raiderCol).style("color", "#ccc").style("margin", "4px 0");
    const raiderSelect = createSelect().parent(raiderCol);
    raiderSelect.option("Few", 90);
    raiderSelect.option("Normal", 60);
    raiderSelect.option("Many", 30);
    raiderSelect.selected("Normal");
    raiderSelect.style("padding", "4px 8px");
    raiderSelect.style("background", "#333");
    raiderSelect.style("color", "#fff");
    raiderSelect.style("border", "1px solid #555");
    raiderSelect.style("border-radius", "4px");

    // Store selections globally
    window._newGameEventChance = 0.16;
    window._newGameRaiderInterval = 60;

    eventSelect.changed(() => { window._newGameEventChance = parseFloat(eventSelect.value()); });
    raiderSelect.changed(() => { window._newGameRaiderInterval = parseInt(raiderSelect.value()); });

    createP("").style("margin", "10px 0 20px").parent(wrapper);

    // Start button
    createButton("⚓ Start Adventure")
      .parent(wrapper)
      .addClass("menu-btn")
      .style("font-size", "18px")
      .style("padding", "12px 32px")
      .style("background", "#2a7d3f")
      .style("color", "#fff")
      .mousePressed(() => {
        if (typeof startNewGame === 'function') {
          startNewGame(window._newGameMapCols, window._newGameMapRows);
        }
      });

    // Back button
    createButton("Back")
      .parent(wrapper)
      .addClass("settings-btn")
      .style("margin-top", "10px")
      .mousePressed(() => {
        gameStateManager.setState(GameStates.MAIN_MENU);
      });

    function updateMapSizeLabel() {
      const c = window._newGameMapCols;
      const r = window._newGameMapRows;
      select("#mapSizeLabel")?.html(`${c}×${r}`);
      const area = c * r;
      const estCities = Math.max(5, Math.min(60, Math.floor(area / 300)));
      select("#mapInfoLine")?.html(`≈${estCities} cities • ${(area * 32 * 32 / 1000000).toFixed(1)}M px² world`);
    }
    updateMapSizeLabel();

    return wrapper;
  },

  show: () => {
    const w = select("#newGameConfig");
    if (w) { w.show(); w.style("opacity", "1"); }
  },

  hide: () => {
    const w = select("#newGameConfig");
    if (w) { w.style("opacity", "0"); setTimeout(() => w.hide(), 200); }
  }
});


// ============================
// PAUSE MENU (with save/load)
// ============================
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

    createButton("Save Game")
      .parent(wrapper)
      .addClass("pause-btn")
      .mousePressed(() => {
        if (typeof SaveSystem !== 'undefined') {
          SaveSystem.save();
          if (typeof notificationManager !== 'undefined') {
            notificationManager.log("Game Saved!", "success");
          }
        }
      });

    createButton("Load Game")
      .parent(wrapper)
      .addClass("pause-btn")
      .mousePressed(() => {
        if (typeof SaveSystem !== 'undefined' && SaveSystem.hasSave()) {
          SaveSystem.load();
          gameStateManager.setState(GameStates.PLAYING);
          if (typeof notificationManager !== 'undefined') {
            notificationManager.log("Game Loaded!", "info");
          }
        }
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
    const w = select("#pauseMenu");
    if (w) { w.show(); w.style("opacity", "1"); }
  },

  hide: () => {
    const w = select("#pauseMenu");
    if (w) { w.style("opacity", "0"); setTimeout(() => w.hide(), 200); }
  }
});


// ============================
// SETTINGS MENU
// ============================
uiManager.registerScreen("settingsMenu", {
  validStates: [GameStates.SETTINGS],

  create: () => {
    const wrapper = createDiv().id("settingsMenu").class("screen");

    createElement("h2", "Settings").parent(wrapper);

    createP("Music Volume").parent(wrapper);
    createSlider(0, 1, 0.5, 0.01).id("musicSlider").parent(wrapper);

    createP("Game Volume").parent(wrapper);
    createSlider(0, 1, 0.5, 0.01).id("gameSlider").parent(wrapper);

    createButton("Clear All Saved Data")
      .parent(wrapper)
      .addClass("danger-btn")
      .mousePressed(() => {
        if (confirm("Are you sure? This will delete all saved settings and game data.")) {
          localStorage.clear();
          select("#musicSlider").value(0.5);
          select("#gameSlider").value(0.5);
          saveSettings();
        }
      });

    createButton("Back")
      .parent(wrapper)
      .addClass("settings-btn")
      .mousePressed(() => {
        gameStateManager.setState(gameStateManager.prev);
      });

    return wrapper;
  },

  show: () => {
    const m = select("#settingsMenu");
    if (m) {
      m.show();
      m.style("opacity", "1");
      const music = parseFloat(localStorage.getItem("music_vol")) || 0.5;
      const game = parseFloat(localStorage.getItem("game_vol")) || 0.5;
      select("#musicSlider").value(music);
      select("#gameSlider").value(game);
      select("#musicSlider").input(() => saveSettings());
      select("#gameSlider").input(() => saveSettings());
    }
  },

  hide: () => {
    const m = select("#settingsMenu");
    if (m) { m.style("opacity", "0"); setTimeout(() => m.hide(), 200); }
  }
});

function saveSettings() {
  const musicVal = parseFloat(select("#musicSlider")?.value()) || 0;
  const gameVal = parseFloat(select("#gameSlider")?.value()) || 0;
  localStorage.setItem("music_vol", musicVal.toFixed(2));
  localStorage.setItem("game_vol", gameVal.toFixed(2));
  if (typeof sound !== "undefined") {
    if (sound.setMusicVolume) sound.setMusicVolume(musicVal);
    if (sound.setGameVolume) sound.setGameVolume(gameVal);
  }
}


// ============================
// TRAVEL PANEL — lists all cities with distance-based cost
// ============================
function buildTravelPanel(panelId) {
  const panel = select("#" + (panelId || "travelPanelInfo"));
  if (!panel || !player.currentCity) return;
  panel.html("");

  const current = player.currentCity;
  const loc = current.location;

  // Header
  const header = createDiv().parent(panel).class("travel-header");
  createElement("h3", "⛵ Travel From " + current.name).parent(header)
    .style("margin", "0 0 4px").style("color", "#d4af37");
  createElement("p", "Select a destination. Cost scales with distance.")
    .parent(header).style("margin", "0 0 8px").style("color", "#aaa").style("font-size", "12px");

  // Build sorted city list
  const cityEntries = [];
  for (const city of cities) {
    if (city === current) continue;
    const dx = city.location.x - loc.x;
    const dy = city.location.y - loc.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const tileDist = Math.round(dist);
    // Cost: base 5 + 1g per 2 tiles, min 5
    const cost = Math.max(5, Math.floor(5 + dist * 0.5));
    cityEntries.push({ city, dist, tileDist, cost });
  }
  cityEntries.sort((a, b) => a.dist - b.dist);

  // List container
  const listEl = createDiv().parent(panel).class("travel-list");

  for (const entry of cityEntries) {
    const canAfford = player.gold >= entry.cost;
    const row = createDiv().parent(listEl).class("travel-row" + (canAfford ? "" : " travel-row-disabled"));

    // City info (left side)
    const info = createDiv().parent(row).class("travel-info");
    createElement("span", entry.city.name).parent(info).class("travel-city-name");

    const tags = createDiv().parent(info).class("travel-tags");
    createElement("span", `${entry.tileDist} tiles`).parent(tags).class("travel-distance");
    if (entry.city.isCoastal) {
      createElement("span", "⚓ Port").parent(tags).class("travel-tag-port");
    }
    createElement("span", `Pop: ${entry.city.population}`).parent(tags).class("travel-pop");

    // Cost + button (right side)
    const action = createDiv().parent(row).class("travel-action");
    createElement("span", `${entry.cost}g`).parent(action).class("travel-cost" + (canAfford ? "" : " travel-cost-expensive"));

    const btn = createButton(canAfford ? "Travel" : "Can't Afford")
      .parent(action)
      .addClass("travel-go-btn" + (canAfford ? "" : " travel-go-btn-disabled"));

    if (canAfford) {
      const city = entry.city;
      const cost = entry.cost;
      btn.mousePressed(() => {
        player.currentCity = null;
        player.fastTravelToCity(city, cost);
        select("#" + (panelId || "travelPanelInfo"))?.style("display", "none");
        uiManager.screens["cityView"].show();
      });
    }
  }

  if (cityEntries.length === 0) {
    createElement("p", "No other cities discovered.").parent(listEl)
      .style("color", "#888").style("text-align", "center").style("padding", "20px");
  }
}

// ============================
// CITY VIEW (expanded shop with trends)
// ============================
uiManager.registerScreen("cityView", {
  validStates: [GameStates.PLAYING],

  create: () => {
    const wrapper = createDiv().id("cityView").class("screen").style("display", "none");

    // ── Header ──
    const headerBox = createDiv().class("city-header").parent(wrapper);

    createDiv().id("cityNameWrapper")
      .style("background", "url('./assets/images/Sign.png') no-repeat center center")
      .style("background-size", "contain")
      .style("height", "10dvh")
      .style("width", "25dvw")
      .style("padding", "0 20px")
      .style("display", "flex")
      .style("align-items", "center")
      .style("justify-content", "center")
      .style("font-size", "24px")
      .style("font-weight", "bold")
      .style("color", "#fff")
      .parent(headerBox);

    const popRow = createDiv()
      .style("display", "flex")
      .style("align-items", "center")
      .style("gap", "8px")
      .parent(headerBox);

    createImg("./assets/images/people.png", "population")
      .style("width", "40px")
      .style("height", "40px")
      .parent(popRow);

    createSpan("").id("cityPopulation")
      .style("font-size", "16px")
      .style("color", "#aaa")
      .parent(popRow);

    // Player info row
    const infoRow = createDiv().class("city-info-row").parent(wrapper);

    createImg("./assets/images/cash.png", "gold")
      .style("width", "24px").style("height", "24px").parent(infoRow);
    createSpan("").id("cityPlayerGold").parent(infoRow);
    createSpan("").id("cityPlayerCargo").parent(infoRow);

    // ── Tab Bar ──
    const tabBar = createDiv().class("city-tab-bar").parent(wrapper);
    const tabs = ["Shop", "Port", "Info"];
    for (const tabName of tabs) {
      createButton(tabName)
        .parent(tabBar)
        .addClass("city-tab-btn")
        .attribute("data-tab", tabName.toLowerCase())
        .mousePressed(() => {
          window._cityTab = tabName.toLowerCase();
          uiManager.screens["cityView"].show();
        });
    }

    // ── Tab Panels ──
    createDiv().id("cityTabShop").class("city-tab-panel").parent(wrapper);
    createDiv().id("cityTabPort").class("city-tab-panel").parent(wrapper);
    createDiv().id("cityTabInfo").class("city-tab-panel").parent(wrapper);

    return wrapper;
  },

  show: () => {
    const view = select("#cityView");
    if (!view || !player.currentCity) return;
    view.show().style("opacity", "1");

    const city = player.currentCity;
    const tab = window._cityTab || "shop";

    // ── Header info ──
    select("#cityNameWrapper")?.html(city.name);
    select("#cityPopulation")?.html(`Pop: ${city.population}`);
    select("#cityPlayerGold")?.html(`Gold: ${player.gold}`);

    let totalWeight = 0;
    for (let [key, entry] of player.inventory) {
      const item = ItemLibrary[key];
      if (item) totalWeight += item.weight * entry.quantity;
    }
    select("#cityPlayerCargo")?.html(`Cargo: ${totalWeight} / ${player.getEffectiveCargoCapacity ? player.getEffectiveCargoCapacity() : (player.cargoCapacity || 50)}`);

    // ── Highlight active tab ──
    selectAll(".city-tab-btn").forEach(btn => {
      const t = btn.attribute("data-tab");
      if (t === tab) {
        btn.addClass("city-tab-active");
      } else {
        btn.removeClass("city-tab-active");
      }
    });

    // ── Show/hide panels ──
    select("#cityTabShop")?.style("display", tab === "shop" ? "block" : "none");
    select("#cityTabPort")?.style("display", tab === "port" ? "block" : "none");
    select("#cityTabInfo")?.style("display", tab === "info" ? "block" : "none");

    // ═══════════════════════════════
    //  SHOP TAB
    // ═══════════════════════════════
    if (tab === "shop") {
      const shopPanel = select("#cityTabShop");
      shopPanel.html("");

      const shopScroll = createDiv().class("shop-grid").parent(shopPanel);

      const sortedItems = Object.entries(ItemLibrary).sort(([a], [b]) => {
        return (city.inventory.has(b) ? 1 : 0) - (city.inventory.has(a) ? 1 : 0);
      });

      for (const [itemKey, itemData] of sortedItems) {
        const cityEntry = city.inventory.get(itemKey);
        const playerEntry = player.inventory.get(itemKey);
        const cityQty = cityEntry?.quantity || 0;
        const playerQty = playerEntry?.quantity || 0;
        const buyPrice = city.calculateItemPrice(itemKey, cities, false);
        const sellPrice = city.calculateItemPrice(itemKey, cities, true);

        const canAfford = player.gold >= buyPrice;
        const hasStock = cityQty > 0;
        const hasCargoSpace = totalWeight + itemData.weight <= (player.getEffectiveCargoCapacity ? player.getEffectiveCargoCapacity() : (player.cargoCapacity || 50));
        const canBuy = canAfford && hasStock && hasCargoSpace;
        const canSell = playerQty > 0;

        const itemDiv = createDiv().class("shop-item").parent(shopScroll);

        // Item image + name
        const imgRow = createDiv().style("display", "flex").style("align-items", "center").style("gap", "8px").parent(itemDiv);
        const imgName = itemKey.toLowerCase();
        createImg(`./assets/images/${imgName}.png`, itemData.name)
          .style("width", "32px")
          .style("height", "32px")
          .style("image-rendering", "pixelated")
          .attribute("onerror", "this.style.display='none'")
          .parent(imgRow);

        const nameRow = createDiv().class("shop-item-name").parent(imgRow);
        createSpan(itemData.name).style("font-weight", "bold").style("color", "#fff").parent(nameRow);

        // Price trend
        if (city.getPriceTrend) {
          const trend = city.getPriceTrend(itemKey);
          let trendIcon = "→";
          let trendColor = "#aaa";
          if (trend > 0) { trendIcon = "↑"; trendColor = "#4CAF50"; }
          if (trend < 0) { trendIcon = "↓"; trendColor = "#f44336"; }
          createSpan(` ${trendIcon}`).style("color", trendColor).style("font-size", "14px").parent(nameRow);
        }

        // Category tag
        createSpan(itemData.category).class("category-tag").parent(itemDiv);

        // Quantities + weight
        createP(`City: ×${cityQty}  |  You: ×${playerQty}  |  Wt: ${itemData.weight}`)
          .style("font-size", "12px").style("margin", "4px 0").style("color", "#aaa").parent(itemDiv);

        // Buy/Sell
        const btnRow = createDiv().class("shop-btn-row").parent(itemDiv);

        createButton(`Buy $${buyPrice}`)
          .parent(btnRow)
          .addClass(canBuy ? "buy-btn" : "buy-btn-disabled")
          .mousePressed(() => {
            if (player.gold >= buyPrice && cityQty > 0) {
              player.spendGold(buyPrice);
              player.addItem(itemData);
              if (cityEntry) cityEntry.quantity--;
              uiManager.screens["cityView"].show();
            }
          });

        createButton(`Sell $${sellPrice}`)
          .parent(btnRow)
          .addClass(canSell ? "sell-btn" : "sell-btn-disabled")
          .mousePressed(() => {
            if (playerQty > 0) {
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
    }

    // ═══════════════════════════════
    //  PORT TAB
    // ═══════════════════════════════
    if (tab === "port") {
      const portPanel = select("#cityTabPort");
      portPanel.html("");

      if (!(city.isCoastal || city.port)) {
        // Landlocked city — no port
        const noPort = createDiv().parent(portPanel).style("text-align", "center").style("padding", "40px 20px");
        createElement("h3", "🚫 No Port").parent(noPort).style("color", "#666").style("margin", "0 0 8px");
        createP("This city is landlocked. Travel to a coastal city to access port services.")
          .parent(noPort).style("color", "#888").style("font-size", "13px");
      } else {
        createElement("h3", "⚓ Harbor — Buy Vessels")
          .parent(portPanel)
          .style("margin", "8px 0 6px")
          .style("color", "#6cc");

        // Available boats for purchase
        const boatGrid = createDiv().class("shop-grid").parent(portPanel);

        for (const [boatKey, boatDef] of Object.entries(typeof BoatLibrary !== 'undefined' ? BoatLibrary : {})) {
          const canAfford = player.gold >= boatDef.cost;

          const boatCard = createDiv().class("shop-item").parent(boatGrid);

          const nameRow = createDiv().style("display", "flex").style("align-items", "center").style("gap", "8px").parent(boatCard);
          createSpan(boatDef.icon).style("font-size", "24px").parent(nameRow);
          createSpan(boatDef.displayName).style("font-weight", "bold").style("color", "#fff").parent(nameRow);

          createP(boatDef.description)
            .style("font-size", "11px").style("color", "#aaa").style("margin", "4px 0").parent(boatCard);

          createP(`Speed: ${boatDef.speed}ms/tile  •  Cargo: +${boatDef.cargoBonus}  •  Crew: ${boatDef.crewSize}`)
            .style("font-size", "11px").style("color", "#888").style("margin", "2px 0").parent(boatCard);

          createButton(`Buy $${boatDef.cost}`)
            .parent(boatCard)
            .addClass(canAfford ? "buy-btn" : "buy-btn-disabled")
            .mousePressed(() => {
              if (player.gold >= boatDef.cost) {
                const defaultName = `${boatDef.displayName} ${player.fleet.length + 1}`;
                const boatName = prompt(`Name your new ${boatDef.displayName}:`, defaultName);
                if (boatName === null) return;
                player.spendGold(boatDef.cost);
                const newBoat = new Boat(boatKey, boatName || defaultName);
                player.fleet.push(newBoat);
                if (!player.activeBoat) player.activeBoat = newBoat;
                if (typeof notificationManager !== 'undefined') {
                  notificationManager.log(`Purchased ${boatDef.displayName} "${newBoat.name}"!`, "success");
                }
                uiManager.screens["cityView"].show();
              }
            });
        }

        // Player's fleet
        if (player.fleet && player.fleet.length > 0) {
          createElement("h3", "🚢 Your Fleet")
            .parent(portPanel)
            .style("margin", "16px 0 6px")
            .style("color", "#acd");

          const fleetGrid = createDiv().class("shop-grid").parent(portPanel);

          for (let i = 0; i < player.fleet.length; i++) {
            const boat = player.fleet[i];
            const isActive = player.activeBoat === boat;
            const boatDef = typeof BoatLibrary !== 'undefined' ? BoatLibrary[boat.type] : null;

            const card = createDiv().class("shop-item").parent(fleetGrid);
            if (isActive) card.style("border", "2px solid #d4af37");

            const row = createDiv().style("display", "flex").style("align-items", "center").style("gap", "8px").parent(card);
            createSpan(boatDef?.icon || '🚢').style("font-size", "20px").parent(row);
            createSpan(`"${boat.name}"`).style("font-weight", "bold").style("color", "#fff").parent(row);
            createSpan(`(${boat.displayName})`).style("color", "#aaa").style("font-size", "12px").parent(row);

            if (isActive) {
              createSpan("★ ACTIVE").style("color", "#d4af37").style("font-size", "11px").style("margin-left", "auto").parent(row);
            }

            createP(`Speed: ${boat.speed}ms  •  Cargo: +${boat.cargoBonus}`)
              .style("font-size", "11px").style("color", "#888").style("margin", "4px 0").parent(card);

            const btnRow = createDiv().style("display", "flex").style("gap", "6px").parent(card);

            if (!isActive) {
              createButton("Set Active")
                .parent(btnRow).addClass("buy-btn")
                .mousePressed(() => {
                  player.activeBoat = boat;
                  if (typeof notificationManager !== 'undefined') {
                    notificationManager.log(`"${boat.name}" is now your active vessel.`, "info");
                  }
                  uiManager.screens["cityView"].show();
                });
            }

            const sellPrice = boatDef ? Math.floor(boatDef.cost * 0.4) : 50;
            createButton(`Sell $${sellPrice}`)
              .parent(btnRow).addClass("sell-btn")
              .mousePressed(() => {
                if (player.isSailing) {
                  if (typeof notificationManager !== 'undefined') {
                    notificationManager.log("You can't sell a boat while at sea!", "warning");
                  }
                  return;
                }
                player.earnGold(sellPrice);
                player.fleet.splice(i, 1);
                if (player.activeBoat === boat) player.activeBoat = player.fleet[0] || null;
                if (typeof notificationManager !== 'undefined') {
                  notificationManager.log(`Sold "${boat.name}" for $${sellPrice}.`, "info");
                }
                uiManager.screens["cityView"].show();
              });

            createButton("Rename")
              .parent(btnRow).addClass("filter-btn")
              .mousePressed(() => {
                const newName = prompt(`Rename "${boat.name}":`, boat.name);
                if (newName && newName.trim()) {
                  boat.name = newName.trim();
                  uiManager.screens["cityView"].show();
                }
              });
          }
        }
      }
    }

    // ═══════════════════════════════
    //  INFO TAB
    // ═══════════════════════════════
    if (tab === "info") {
      const infoPanel = select("#cityTabInfo");
      infoPanel.html("");

      // City stats
      const statsBox = createDiv().class("info-stats-box").parent(infoPanel);
      createElement("h3", "📊 City Info").parent(statsBox).style("color", "#d4af37").style("margin", "0 0 8px");

      const statsList = createDiv().parent(statsBox).style("display", "flex").style("flex-direction", "column").style("gap", "4px");

      const addStat = (label, value) => {
        const row = createDiv().parent(statsList).style("display", "flex").style("justify-content", "space-between");
        createSpan(label).parent(row).style("color", "#aaa").style("font-size", "13px");
        createSpan(value).parent(row).style("color", "#fff").style("font-size", "13px").style("font-weight", "bold");
      };

      addStat("Population", city.population.toString());
      addStat("Unique Items", city.inventory.size.toString());
      addStat("Coastal", (city.isCoastal || city.port) ? "Yes ⚓" : "No");

      // Total city wealth (sum of item values)
      let cityWealth = 0;
      for (const [key, entry] of city.inventory) {
        cityWealth += city.calculateItemPrice(key, cities, false) * entry.quantity;
      }
      addStat("Market Value", `$${cityWealth}`);

      if (city.holidays && city.holidays.length > 0) {
        createElement("h4", "🎉 Holidays").parent(statsBox)
          .style("color", "#d4af37").style("margin", "10px 0 4px");

        const holidayList = createDiv().parent(statsBox)
          .style("display", "flex").style("flex-direction", "column").style("gap", "4px");

        for (const h of city.holidays) {
          const row = createDiv().parent(holidayList)
            .style("display", "flex").style("justify-content", "space-between")
            .style("background", "#222").style("padding", "4px 8px")
            .style("border-radius", "4px");
          createSpan(h.name || "Festival").parent(row)
            .style("color", "#fff").style("font-size", "12px");
          createSpan(`Day ${h.day} • ${h.season}`).parent(row)
            .style("color", "#aaa").style("font-size", "12px");
        }
      }

      // ── Buttons ──
      const buttonRow = createDiv().class("city-button-row").parent(infoPanel);

      createButton("Leave City")
        .parent(buttonRow)
        .addClass("settings-btn")
        .mousePressed(() => {
          const safe = findNearestSafeTile(player.x, player.y, cities);
          if (safe) { player.x = safe.x; player.y = safe.y; }
          player.currentCity = null;
          uiManager.screens["cityView"].hide();
        });

      createButton("Travel")
        .id("travelBtn")
        .parent(buttonRow)
        .addClass("settings-btn")
        .mousePressed(() => {
          const travelPanel = select("#travelPanelInfo");
          if (travelPanel) {
            const isVisible = travelPanel.style("display") !== "none";
            if (isVisible) {
              travelPanel.style("display", "none");
            } else {
              buildTravelPanel("travelPanelInfo");
              travelPanel.style("display", "block");
            }
          }
        });

      // Travel panel embedded in info tab
      createDiv().id("travelPanelInfo").parent(infoPanel).style("display", "none");
    }
  },

  hide: () => {
    const view = select("#cityView");
    if (view) { view.style("opacity", "0"); setTimeout(() => view.hide(), 200); }
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


// ============================
// PLAYER HUD (bottom bar)
// ============================
uiManager.registerScreen("playerView", {
  validStates: [GameStates.PLAYING],

  create: () => {
    const bar = createDiv().id("playerView").class("hud-bar");

    const statsWrapper = createDiv().class("hud-stats").parent(bar);
    createSpan("").id("playerGold").parent(statsWrapper);
    createSpan("").id("playerCargo").parent(statsWrapper);
    createSpan("").id("playerInventory").parent(statsWrapper);

    const timeWrapper = createDiv().class("hud-time").parent(bar);
    createSpan("").id("dayLabel").parent(timeWrapper);
    createSpan("").id("timeLabel").parent(timeWrapper);

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

    select("#playerGold")?.html(`💰 ${player.gold}`);

    // Cargo weight
    let totalWeight = 0;
    for (let [key, entry] of player.inventory) {
      const item = ItemLibrary[key];
      if (item) totalWeight += item.weight * entry.quantity;
    }
    select("#playerCargo")?.html(`📦 ${totalWeight}/${player.getEffectiveCargoCapacity ? player.getEffectiveCargoCapacity() : (player.cargoCapacity || 50)}`);

    const inv = [...player.inventory.entries()]
      .filter(([key]) => key in ItemLibrary)
      .map(([key, entry]) => `${ItemLibrary[key].name}×${entry.quantity}`)
      .join(", ");

    // Boat indicator
    if (player.isSailing && player.activeBoat) {
      select("#playerInventory")?.html(`⛵ ${player.activeBoat.name} • 🎒 ${inv || "Empty"}`);
    } else {
      select("#playerInventory")?.html(`🎒 ${inv || "Empty"}`);
    }

    if (typeof dayNight !== 'undefined') {
      const dayNum = dayNight.getDaysElapsed();
      const weekday = dayNight.getDayOfWeek();
      const season = dayNight.getSeason();
      const year = dayNight.getYear();
      select("#dayLabel")?.html(`Year ${year}, ${season} — Day ${dayNum} (${weekday})`);
      if (dayNight.getTimeString) {
        select("#timeLabel")?.html(dayNight.getTimeString());
      }
    }
  }
});


// ============================
// COMBAT VIEW
// ============================
uiManager.registerScreen("combatView", {
  validStates: [GameStates.COMBAT],

  create: () => {
    const wrapper = createDiv().id("combatView").class("screen combat-screen").style("display", "none");

    createElement("h2", "⚔️ Raiders Attack!").id("combatTitle").parent(wrapper);
    createP("").id("combatDesc").parent(wrapper);

    // Combat log
    createDiv().id("combatLog").class("combat-log").parent(wrapper);

    // Action buttons
    const actions = createDiv().id("combatActions").class("combat-actions").parent(wrapper);

    createButton("⚔️ Fight")
      .parent(actions)
      .addClass("combat-btn fight-btn")
      .mousePressed(() => {
        if (typeof combatSystem !== 'undefined') {
          const result = combatSystem.playerAction('fight');
          updateCombatLog(result);
        }
      });

    createButton("🏃 Flee")
      .parent(actions)
      .addClass("combat-btn flee-btn")
      .mousePressed(() => {
        if (typeof combatSystem !== 'undefined') {
          const result = combatSystem.playerAction('flee');
          updateCombatLog(result);
        }
      });

    createButton("💰 Bribe")
      .parent(actions)
      .addClass("combat-btn bribe-btn")
      .mousePressed(() => {
        if (typeof combatSystem !== 'undefined') {
          const result = combatSystem.playerAction('bribe');
          updateCombatLog(result);
        }
      });

    // Continue button (shown after combat ends)
    createButton("Continue")
      .id("combatContinueBtn")
      .parent(wrapper)
      .addClass("menu-btn")
      .style("display", "none")
      .mousePressed(() => {
        if (typeof combatSystem !== 'undefined') {
          combatSystem.endCombat();
        } else {
          gameStateManager.setState(GameStates.PLAYING);
        }
      });

    return wrapper;
  },

  show: () => {
    const view = select("#combatView");
    if (view) {
      view.show().style("opacity", "1");
      select("#combatLog")?.html("");
      select("#combatContinueBtn")?.style("display", "none");
      select("#combatActions")?.style("display", "flex");

      if (typeof combatSystem !== 'undefined' && combatSystem.raider) {
        const rType = RAIDER_TYPES[combatSystem.raiderType] || RAIDER_TYPES['bandit'];
        const isMonster = rType.monster;
        const title = select("#combatTitle");
        if (title) {
          title.html(isMonster ? `🐉 ${rType.name} Appears!` : "⚔️ Raiders Attack!");
        }
        select("#combatDesc")?.html(
          isMonster
            ? `A fearsome ${rType.name} blocks your path! (Str: ${combatSystem.raider.strength})`
            : `A band of ${combatSystem.raider.strength} raiders blocks your path!`
        );

        // Disable bribe button for monsters
        const bribeBtn = select(".bribe-btn");
        if (bribeBtn) {
          if (isMonster) {
            bribeBtn.html("💰 Bribe (N/A)");
            bribeBtn.style("opacity", "0.4");
          } else {
            bribeBtn.html("💰 Bribe");
            bribeBtn.style("opacity", "1");
          }
        }
      }
    }
  },

  hide: () => {
    const view = select("#combatView");
    if (view) { view.style("opacity", "0"); setTimeout(() => view.hide(), 200); }
  }
});

function updateCombatLog(result) {
  if (!result) return;

  const log = select("#combatLog");
  if (log) {
    const entry = createP(result.message || "...")
      .style("margin", "4px 0")
      .style("color", result.won ? "#4CAF50" : result.fled ? "#ff9800" : "#f44336");
    entry.parent(log);

    // Auto-scroll
    log.elt.scrollTop = log.elt.scrollHeight;
  }

  if (result.resolved) {
    select("#combatActions")?.style("display", "none");
    select("#combatContinueBtn")?.style("display", "block");

    // Show loot summary
    if (result.won && result.loot) {
      const lootText = `Loot: ${result.loot.gold || 0} gold` +
        (result.loot.items ? `, ${result.loot.items.length} items` : "");
      const lootP = createP(lootText)
        .style("color", "#d4af37")
        .style("font-weight", "bold");
      lootP.parent(select("#combatLog"));
    }
  }
}


// ============================
// RANDOM EVENT VIEW
// ============================
uiManager.registerScreen("eventView", {
  validStates: [GameStates.RANDOM_EVENT],

  create: () => {
    const wrapper = createDiv().id("eventView").class("screen event-screen").style("display", "none");

    createElement("h2", "").id("eventTitle").parent(wrapper);
    createP("").id("eventDesc").parent(wrapper);
    createDiv().id("eventChoices").class("event-choices").parent(wrapper);

    return wrapper;
  },

  show: () => {
    const view = select("#eventView");
    if (view) {
      view.show().style("opacity", "1");
    }

    if (typeof eventSystem !== 'undefined' && eventSystem.currentEvent) {
      const evt = eventSystem.currentEvent;
      select("#eventTitle")?.html(`🎲 ${evt.name}`);
      select("#eventDesc")?.html(evt.description);

      const choicesDiv = select("#eventChoices");
      choicesDiv?.html("");

      if (evt.choices) {
        for (let i = 0; i < evt.choices.length; i++) {
          const choice = evt.choices[i];
          createButton(choice.text)
            .parent(choicesDiv)
            .addClass("event-choice-btn")
            .mousePressed(() => {
              const result = eventSystem.resolveChoice(i);
              showEventResult(result);
            });
        }
      }
    }
  },

  hide: () => {
    const view = select("#eventView");
    if (view) { view.style("opacity", "0"); setTimeout(() => view.hide(), 200); }
  }
});

function showEventResult(result) {
  if (!result) return;

  select("#eventChoices")?.html("");
  select("#eventDesc")?.html(result.message || "The event concludes.");

  const continueBtn = createButton("Continue")
    .addClass("menu-btn")
    .mousePressed(() => {
      gameStateManager.setState(GameStates.PLAYING);
    });
  continueBtn.parent(select("#eventChoices"));
}


// ============================
// GAME WON VIEW
// ============================
uiManager.registerScreen("gameWonView", {
  validStates: [GameStates.GAMEWON],

  create: () => {
    const wrapper = createDiv().id("gameWonView").class("screen").style("display", "none");

    createElement("h1", "🏆 Victory!")
      .parent(wrapper)
      .style("color", "var(--accent)");

    createP("You've reached 5000 gold. You may continue playing!")
      .style("margin-bottom", "20px")
      .parent(wrapper);

    createButton("Keep Playing")
      .parent(wrapper)
      .addClass("menu-btn")
      .mousePressed(() => {
        player.hasWon = true;
        gameStateManager.setState(GameStates.PLAYING);
      });

    return wrapper;
  },

  show: () => { select("#gameWonView")?.show(); },
  hide: () => { select("#gameWonView")?.hide(); }
});


// ============================
// GAME LOSE VIEW
// ============================
uiManager.registerScreen("gameLoseView", {
  validStates: [GameStates.GAMELOSE],

  create: () => {
    const wrapper = createDiv().id("gameLoseView").class("screen").style("display", "none");

    createElement("h1", "💀 Defeat")
      .parent(wrapper)
      .style("color", "#ff4f4f");

    createP("You've run out of gold and supplies. Try again?")
      .style("margin-bottom", "20px")
      .parent(wrapper);

    createButton("Retry")
      .parent(wrapper)
      .addClass("menu-btn")
      .mousePressed(() => {
        location.reload();
      });

    return wrapper;
  },

  show: () => { select("#gameLoseView")?.show(); },
  hide: () => { select("#gameLoseView")?.hide(); }
});
