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
        gameStateManager.setState(GameStates.PLAYING);
      });

    // Continue button (only if save exists)
    const continueBtn = createButton("Continue")
      .parent(parent)
      .addClass("menu-btn")
      .mousePressed(() => {
        if (typeof SaveSystem !== 'undefined' && SaveSystem.hasSave()) {
          SaveSystem.load();
          gameStateManager.setState(GameStates.PLAYING);
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
// CITY VIEW (expanded shop with trends)
// ============================
uiManager.registerScreen("cityView", {
  validStates: [GameStates.PLAYING],

  create: () => {
    const wrapper = createDiv().id("cityView").class("screen").style("display", "none");

    // Header
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

    // Category filters
    const filterRow = createDiv().class("shop-filter-row").parent(wrapper);
    const categories = ["All", "Food", "Ore", "Material", "Spice", "Medicine", "Equipment", "Goods", "Luxury"];
    for (let cat of categories) {
      createButton(cat)
        .parent(filterRow)
        .addClass("filter-btn")
        .attribute("data-category", cat)
        .mousePressed(() => {
          window._shopFilter = cat;
          uiManager.screens["cityView"].show();
        });
    }

    // Shop grid
    createElement("h3", "Shop Inventory").parent(wrapper).style("margin", "8px 0 4px");
    createDiv().id("shopScroll").class("shop-grid").parent(wrapper);

    // Buttons
    const buttonRow = createDiv().class("city-button-row").parent(wrapper);

    createButton("Leave City")
      .parent(buttonRow)
      .addClass("settings-btn")
      .mousePressed(() => {
        const safe = findNearestSafeTile(player.x, player.y, cities);
        if (safe) { player.x = safe.x; player.y = safe.y; }
        player.currentCity = null;
        uiManager.screens["cityView"].hide();
      });

    createButton("Fast Travel")
      .id("fastTravelBtn")
      .parent(buttonRow)
      .addClass("settings-btn")
      .mousePressed(() => {
        const current = player.currentCity;
        const closest = findClosestCity(current, cities);
        if (closest) {
          player.currentCity = null;
          player.fastTravelToCity(closest.city);
          uiManager.screens["cityView"].show();
        }
      });

    return wrapper;
  },

  show: () => {
    const view = select("#cityView");
    if (!view || !player.currentCity) return;
    view.show().style("opacity", "1");

    const city = player.currentCity;
    const filter = window._shopFilter || "All";

    select("#cityNameWrapper")?.html(city.name);
    select("#cityPopulation")?.html(`Pop: ${city.population}`);
    select("#cityPlayerGold")?.html(`Gold: ${player.gold}`);

    // Cargo weight
    let totalWeight = 0;
    for (let [key, entry] of player.inventory) {
      const item = ItemLibrary[key];
      if (item) totalWeight += item.weight * entry.quantity;
    }
    select("#cityPlayerCargo")?.html(`Cargo: ${totalWeight} / ${player.cargoCapacity || 50}`);

    // Fast travel button text
    const closest = findClosestCity(city, cities);
    const ftBtn = select("#fastTravelBtn");
    if (ftBtn && closest) {
      ftBtn.html(`Travel to ${closest.name}`);
    }

    // Highlight active filter
    selectAll(".filter-btn").forEach(btn => {
      const cat = btn.attribute("data-category");
      if (cat === filter) {
        btn.style("background", "#d4af37");
        btn.style("color", "#000");
      } else {
        btn.style("background", "#333");
        btn.style("color", "#ccc");
      }
    });

    // Build shop items
    const shopScroll = select("#shopScroll");
    shopScroll.html("");

    const sortedItems = Object.entries(ItemLibrary).sort(([a], [b]) => {
      return (city.inventory.has(b) ? 1 : 0) - (city.inventory.has(a) ? 1 : 0);
    });

    for (const [itemKey, itemData] of sortedItems) {
      if (filter !== "All" && itemData.category !== filter) continue;

      const cityEntry = city.inventory.get(itemKey);
      const playerEntry = player.inventory.get(itemKey);
      const cityQty = cityEntry?.quantity || 0;
      const playerQty = playerEntry?.quantity || 0;
      const buyPrice = city.calculateItemPrice(itemKey, cities, false);
      const sellPrice = city.calculateItemPrice(itemKey, cities, true);

      const currentWeight = totalWeight;
      const canAfford = player.gold >= buyPrice;
      const hasStock = cityQty > 0;
      const hasCargoSpace = currentWeight + itemData.weight <= (player.cargoCapacity || 50);
      const canBuy = canAfford && hasStock && hasCargoSpace;
      const canSell = playerQty > 0;

      const itemDiv = createDiv().class("shop-item").parent(shopScroll);

      // Item image (use asset if available, otherwise show name)
      const imgName = itemKey.toLowerCase();
      const imgRow = createDiv().style("display", "flex").style("align-items", "center").style("gap", "8px").parent(itemDiv);
      createImg(`./assets/images/${imgName}.png`, itemData.name)
        .style("width", "32px")
        .style("height", "32px")
        .style("image-rendering", "pixelated")
        .attribute("onerror", "this.style.display='none'")
        .parent(imgRow);

      // Item name + category
      const nameRow = createDiv().class("shop-item-name").parent(imgRow);
      createSpan(itemData.name).style("font-weight", "bold").style("color", "#fff").parent(nameRow);

      // Price trend arrow
      if (city.getPriceTrend) {
        const trend = city.getPriceTrend(itemKey);
        let trendIcon = "→";
        let trendColor = "#aaa";
        if (trend > 0) { trendIcon = "↑"; trendColor = "#4CAF50"; }
        if (trend < 0) { trendIcon = "↓"; trendColor = "#f44336"; }
        createSpan(` ${trendIcon}`).style("color", trendColor).style("font-size", "14px").parent(nameRow);
      }

      // Category tag
      createSpan(itemData.category)
        .class("category-tag")
        .parent(itemDiv);

      // Quantities
      createP(`City: ×${cityQty}  |  You: ×${playerQty}`)
        .style("font-size", "12px")
        .style("margin", "4px 0")
        .style("color", "#aaa")
        .parent(itemDiv);

      // Weight
      createP(`Weight: ${itemData.weight}`)
        .style("font-size", "11px")
        .style("margin", "2px 0")
        .style("color", "#888")
        .parent(itemDiv);

      // Buy/Sell buttons
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
    select("#playerCargo")?.html(`📦 ${totalWeight}/${player.cargoCapacity || 50}`);

    const inv = [...player.inventory.entries()]
      .filter(([key]) => key in ItemLibrary)
      .map(([key, entry]) => `${ItemLibrary[key].name}×${entry.quantity}`)
      .join(", ");
    select("#playerInventory")?.html(`🎒 ${inv || "Empty"}`);

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
        select("#combatDesc")?.html(
          `A band of ${combatSystem.raider.strength} raiders blocks your path!`
        );
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
