// EventSystem.js — Random travel events

class EventSystem {
  constructor() {
    this.tilesMoved = 0;
    this.checkInterval = 20; // Check every 20 tiles moved
    this.eventChance = 0.10; // 10% chance per check
    this.currentEvent = null;
    this.eventHistory = [];
    this.maxHistory = 30;

    // Countdown timer for active events
    this._eventTimer = null; // setTimeout id
    this._eventDeadline = 0; // Date.now() + ms

    this.events = this.defineEvents();
  }

  destroy() {
    this.clearEventTimer();
  }

  /** Clear any active event countdown */
  clearEventTimer() {
    if (this._eventTimer) {
      clearTimeout(this._eventTimer);
      this._eventTimer = null;
    }
    this._eventDeadline = 0;
  }

  /** Start countdown for current event. When it expires, auto-resolve the worst choice. */
  startEventTimer(seconds) {
    this.clearEventTimer();
    this._eventDeadline = Date.now() + seconds * 1000;
    this._eventTimer = setTimeout(() => {
      this._eventTimer = null;
      this._eventDeadline = 0;
      if (!this.currentEvent) return;

      // Grab event info before we clear it
      const evt = this.currentEvent;
      const worst = evt.worstChoice ?? evt.choices.length - 1;
      const choice = evt.choices[worst];

      // Resolve the consequence
      const result = choice.resolve();

      // Build a proper timeout message: event-specific flavor + actual consequence
      const timeoutFlavor = evt.timeoutMessage || `You hesitated too long!`;
      const fullMessage = `⏰ ${timeoutFlavor}\n\n${result.message}`;
      result.message = fullMessage;
      result.type = result.type || 'error';

      if (typeof notificationManager !== 'undefined') {
        notificationManager.log(`⏰ ${timeoutFlavor}`, 'error');
      }

      // Clear event AFTER resolving (so UI can still show result)
      this.currentEvent = null;

      // Show result in the event popup (stays visible until player clicks Continue)
      if (typeof showEventResult === 'function') showEventResult(result);
    }, seconds * 1000);
  }

  /** Seconds remaining on current event timer, or 0 */
  getTimerRemaining() {
    if (!this._eventDeadline) return 0;
    return Math.max(0, Math.ceil((this._eventDeadline - Date.now()) / 1000));
  }

  onPlayerMoved() {
    if (gameStateManager.is(GameStates.COMBAT) || gameStateManager.is(GameStates.RANDOM_EVENT)) return;
    if (player.currentCity) return; // No events in cities

    this.tilesMoved++;
    if (this.tilesMoved >= this.checkInterval) {
      this.tilesMoved = 0;
      if (Math.random() < this.eventChance) {
        this.triggerRandomEvent();
      }
    }
  }

  triggerRandomEvent() {
    const terrain = grid[player.y]?.[player.x]?.options[0] || 'Grass';
    const season = dayNight.getSeason();
    const day = dayNight.getDaysElapsed();

    // Filter eligible events
    const eligible = this.events.filter(e => {
      if (e.minDay && day < e.minDay) return false;
      if (e.terrain && !e.terrain.includes(terrain)) return false;
      if (e.season && !e.season.includes(season)) return false;
      return true;
    });

    if (eligible.length === 0) return;

    const event = eligible[Math.floor(Math.random() * eligible.length)];
    this.currentEvent = { ...event, triggered: day, terrain, season };

    // Start countdown timer if event has a time limit
    if (event.timeLimit) {
      this.startEventTimer(event.timeLimit);
    }

    this.eventHistory.push({
      name: event.name,
      day,
      terrain,
      season,
    });
    if (this.eventHistory.length > this.maxHistory) this.eventHistory.shift();

    gameStateManager.setState(GameStates.RANDOM_EVENT);
  }

  resolveChoice(choiceIndex) {
    if (!this.currentEvent || !this.currentEvent.choices[choiceIndex]) return;

    // Clear countdown timer when player makes a choice
    this.clearEventTimer();

    const choice = this.currentEvent.choices[choiceIndex];
    const result = choice.resolve();

    if (typeof notificationManager !== 'undefined') {
      notificationManager.log(result.message, result.type || "info");
    }

    this.currentEvent = null;
    // Don't override if the event launched combat or a minigame
    if (gameStateManager.currentState !== GameStates.COMBAT &&
        gameStateManager.currentState !== GameStates.MINIGAME) {
      gameStateManager.setState(GameStates.PLAYING);
    }

    return result;
  }

  defineEvents() {
    return [
      {
        name: "Broken Wheel",
        description: "Your cart has hit a rock and broken a wheel! You need to repair it or lose time.",
        terrain: ['Rock', 'Sand', 'Grass'],
        timeLimit: 20,
        worstChoice: 1,
        timeoutMessage: "The wheel splinters further while you dither — you're forced to jury-rig a fix!",
        choices: [
          {
            text: "Pay 15 gold to repair (quick fix)",
            resolve: () => {
              if (player.gold >= 15) {
                player.spendGold(15);
                return { message: "Wheel repaired for 15 gold. Onward!", type: "info" };
              }
              return { message: "Not enough gold! You waste half a day fixing it.", type: "warning" };
            }
          },
          {
            text: "Attempt repair yourself (50% chance)",
            resolve: () => {
              if (Math.random() < 0.5) {
                return { message: "You skillfully repair the wheel. No cost!", type: "success" };
              }
              return { message: "Repair failed. You lose a day struggling with it.", type: "error" };
            }
          },
        ]
      },
      {
        name: "Wandering Merchant",
        description: "A mysterious merchant appears with exotic goods. They offer you a special deal.",
        terrain: ['Grass', 'Sand', 'Forest', 'Rock', 'Snow'],
        timeLimit: 18,
        worstChoice: 2,
        timeoutMessage: "The merchant grows impatient and vanishes before you can decide.",
        choices: [
          {
            text: "Buy rare Spices at a discount (40 gold)",
            resolve: () => {
              if (player.gold >= 40 && ItemLibrary['Spices']) {
                player.spendGold(40);
                player.addItem({ name: 'Spices', quantity: 2 });
                return { message: "Bought 2 Spices for 40 gold!", type: "success" };
              } else if (player.gold >= 40) {
                player.spendGold(40);
                player.addItem({ name: 'Herbs', quantity: 3 });
                return { message: "Bought 3 Herbs for 40 gold!", type: "success" };
              }
              return { message: "You can't afford it. The merchant shrugs and leaves.", type: "warning" };
            }
          },
          {
            text: "Trade 2 random items for something valuable",
            resolve: () => {
              const keys = [...player.inventory.keys()];
              if (keys.length >= 2) {
                player.removeItem({ name: keys[0] });
                player.removeItem({ name: keys[1] });
                const reward = Math.random() > 0.5 ? 'Jewelry' : 'Wine';
                if (ItemLibrary[reward]) {
                  player.addItem({ name: reward, quantity: 1 });
                  return { message: `Traded for 1 ${reward}! Great deal.`, type: "success" };
                }
                player.earnGold(50);
                return { message: "Traded for 50 gold!", type: "success" };
              }
              return { message: "You don't have enough items to trade.", type: "warning" };
            }
          },
          {
            text: "Decline and move on",
            resolve: () => {
              return { message: "The merchant vanishes into the mist.", type: "info" };
            }
          }
        ]
      },
      {
        name: "Fierce Storm",
        description: "Dark clouds gather and a violent storm rolls in. The wind howls around you!",
        terrain: ['Grass', 'Sand', 'Snow'],
        season: ['Spring', 'Fall'],
        timeLimit: 15,
        worstChoice: 1,
        timeoutMessage: "The storm hits before you can find cover — you're caught in the open!",
        choices: [
          {
            text: "Seek shelter and wait it out",
            resolve: () => {
              return { message: "You find shelter. Lost a few hours but stayed safe.", type: "info" };
            }
          },
          {
            text: "Press on through the storm",
            resolve: () => {
              if (Math.random() < 0.3) {
                // Lose perishable
                const perishables = [...player.inventory.entries()]
                  .filter(([k, v]) => ItemLibrary[k]?.perishable);
                if (perishables.length > 0) {
                  const [key] = perishables[Math.floor(Math.random() * perishables.length)];
                  player.removeItem({ name: key });
                  return { message: `The storm ruined 1 ${key}!`, type: "error" };
                }
              }
              return { message: "You brave the storm and emerge unscathed!", type: "success" };
            }
          }
        ]
      },
      {
        name: "Abandoned Camp",
        description: "You discover an abandoned campsite. The embers are still warm...",
        terrain: ['Grass', 'Forest', 'Sand', 'Rock', 'Snow'],
        choices: [
          {
            text: "Search the camp",
            resolve: () => {
              if (Math.random() < 0.1) {
                player.spendGold(10);
                return { message: "It was a trap! Bandits stole 10 gold!", type: "error" };
              }
              const goldFound = 5 + Math.floor(Math.random() * 25);
              player.earnGold(goldFound);
              return { message: `Found ${goldFound} gold in the campsite!`, type: "success" };
            }
          },
          {
            text: "Leave it alone",
            resolve: () => {
              return { message: "Better safe than sorry. You move on.", type: "info" };
            }
          }
        ]
      },
      {
        name: "Festival Rumor",
        description: "A passing traveler tells you of an upcoming celebration in a distant city!",
        terrain: ['Grass', 'Forest', 'Sand', 'Rock', 'Snow'],
        minDay: 5,
        choices: [
          {
            text: "Ask for details",
            resolve: () => {
              if (cities.length > 0) {
                const city = cities[Math.floor(Math.random() * cities.length)];
                const items = Object.keys(ItemLibrary);
                const item = items[Math.floor(Math.random() * items.length)];
                return {
                  message: `"${city.name} will celebrate a ${item} festival soon! Prices will soar."`,
                  type: "info"
                };
              }
              return { message: "The traveler's mumbling is hard to understand.", type: "info" };
            }
          },
          {
            text: "Ignore the gossip",
            resolve: () => {
              return { message: "You nod politely and continue walking.", type: "info" };
            }
          }
        ]
      },
      {
        name: "River Crossing",
        description: "A swollen river blocks your path. The bridge has collapsed!",
        terrain: ['Grass', 'Forest'],
        timeLimit: 20,
        worstChoice: 0,
        timeoutMessage: "The river keeps rising — you're forced to wade across before it's too late!",
        choices: [
          {
            text: "Wade across (risky)",
            resolve: () => {
              if (Math.random() < 0.25) {
                const items = [...player.inventory.keys()];
                if (items.length > 0) {
                  const lost = items[Math.floor(Math.random() * items.length)];
                  player.removeItem({ name: lost });
                  return { message: `You made it across but dropped 1 ${lost} in the current!`, type: "warning" };
                }
              }
              return { message: "You wade across safely!", type: "success" };
            }
          },
          {
            text: "Pay a ferryman (10 gold)",
            resolve: () => {
              if (player.gold >= 10) {
                player.spendGold(10);
                return { message: "The ferryman takes you across safely for 10 gold.", type: "info" };
              }
              return { message: "You can't afford the ferry. You wade across anyway.", type: "warning" };
            }
          }
        ]
      },
      {
        name: "Lucky Find",
        description: "Something glints in the sunlight between the rocks...",
        terrain: ['Grass', 'Sand', 'Rock', 'Forest', 'Snow'],
        choices: [
          {
            text: "Investigate the glint",
            resolve: () => {
              const roll = Math.random();
              if (roll < 0.3) {
                const gold = 30 + Math.floor(Math.random() * 60);
                player.earnGold(gold);
                return { message: `A hidden cache! Found ${gold} gold!`, type: "success" };
              } else if (roll < 0.6) {
                const items = Object.keys(ItemLibrary);
                const item = items[Math.floor(Math.random() * items.length)];
                player.addItem({ name: item, quantity: 2 });
                return { message: `Found 2x ${item}!`, type: "success" };
              }
              return { message: "Just a shiny rock. Oh well.", type: "info" };
            }
          },
          {
            text: "Keep walking",
            resolve: () => {
              return { message: "Probably nothing. You continue your journey.", type: "info" };
            }
          }
        ]
      },
      {
        name: "Caravan Wreckage",
        description: "A destroyed merchant caravan lies on the road. Goods are scattered everywhere.",
        terrain: ['Grass', 'Sand', 'Rock', 'Forest'],
        choices: [
          {
            text: "Scavenge supplies",
            resolve: () => {
              const items = Object.keys(ItemLibrary);
              const numItems = 2 + Math.floor(Math.random() * 3);
              const found = [];
              for (let i = 0; i < numItems; i++) {
                const item = items[Math.floor(Math.random() * items.length)];
                player.addItem({ name: item, quantity: 1 });
                found.push(item);
              }
              return { message: `Scavenged: ${found.join(', ')}`, type: "success" };
            }
          },
          {
            text: "Investigate the scene (raider intel)",
            resolve: () => {
              if (typeof raiderManager !== 'undefined' && raiderManager.raiders.length > 0) {
                const r = raiderManager.raiders[0];
                return {
                  message: `Tracks lead toward (${r.x}, ${r.y}). Raiders of strength ${r.strength} operate nearby.`,
                  type: "warning"
                };
              }
              return { message: "The tracks go cold. No useful intel.", type: "info" };
            }
          }
        ]
      },
      {
        name: "Sick Traveler",
        description: "A sick traveler begs for help by the roadside.",
        terrain: ['Grass', 'Forest', 'Sand', 'Rock', 'Snow'],
        choices: [
          {
            text: "Give them Herbs (if you have some)",
            resolve: () => {
              if (player.inventory.has('Herbs')) {
                player.removeItem({ name: 'Herbs' });
                const reward = 15 + Math.floor(Math.random() * 20);
                player.earnGold(reward);
                return { message: `The traveler thanks you and gives you ${reward} gold!`, type: "success" };
              }
              return { message: "You don't have any Herbs to give.", type: "warning" };
            }
          },
          {
            text: "Give them 20 gold for medicine",
            resolve: () => {
              if (player.gold >= 20) {
                player.spendGold(20);
                // Boost reputation at the nearest city
                if (typeof cities !== 'undefined' && cities.length > 0) {
                  let nearest = null, bestDist = Infinity;
                  for (const c of cities) {
                    const d = Math.abs(player.x - c.location.x) + Math.abs(player.y - c.location.y);
                    if (d < bestDist) { bestDist = d; nearest = c; }
                  }
                  if (nearest && nearest.adjustReputation) nearest.adjustReputation(2);
                }
                return { message: "The traveler is grateful. Your reputation improves with the nearest city.", type: "info" };
              }
              return { message: "You can't afford to help right now.", type: "warning" };
            }
          },
          {
            text: "Walk past",
            resolve: () => {
              return { message: "You avert your eyes and keep walking.", type: "info" };
            }
          }
        ]
      },
      {
        name: "Bandit Toll",
        description: "Armed bandits block the road and demand a toll!",
        terrain: ['Forest', 'Rock'],
        timeLimit: 12,
        worstChoice: 0,
        timeoutMessage: "The bandits lose patience and shake you down!",
        choices: [
          {
            text: "Pay the toll (30 gold)",
            resolve: () => {
              if (player.gold >= 30) {
                player.spendGold(30);
                return { message: "You pay 30 gold and the bandits let you pass.", type: "warning" };
              }
              return { message: "You don't have 30 gold! They let you go with a shove.", type: "error" };
            }
          },
          {
            text: "Fight them!",
            resolve: () => {
              // Trigger a combat encounter
              if (typeof combatSystem !== 'undefined') {
                const bandit = new Raider({ x: player.x, y: player.y, strength: 3, patrolPoints: [] });
                bandit.loot.gold = 30 + Math.floor(Math.random() * 20);
                combatSystem.startCombat(bandit);
                return { message: "You draw your weapon!", type: "warning" };
              }
              return { message: "You fight them off but take some bruises.", type: "warning" };
            }
          },
          {
            text: "Sneak past (40% chance)",
            resolve: () => {
              if (Math.random() < 0.4) {
                return { message: "You slip past unnoticed!", type: "success" };
              }
              // Caught, lose some gold
              const lost = Math.min(player.gold, 15);
              player.spendGold(lost);
              return { message: `Caught! They take ${lost} gold as 'punishment'.`, type: "error" };
            }
          }
        ]
      },
      {
        name: "Abandoned Library",
        description: "You discover the ruins of a small library. Most books are ruined by weather, but a few intact volumes catch your eye.",
        terrain: ['Grass', 'Forest', 'Rock', 'Sand'],
        minDay: 10,
        choices: [
          {
            text: "Search the shelves carefully",
            resolve: () => {
              const bookKeys = Object.keys(ItemLibrary).filter(k => ItemLibrary[k].tags?.has('book'));
              // Only offer books player doesn't own
              const available = bookKeys.filter(k => !player.inventory.has(k));
              if (available.length === 0) {
                const gold = 20 + Math.floor(Math.random() * 30);
                player.earnGold(gold);
                return { message: `You already own all the valuable books here. You sell some old pages for ${gold} gold.`, type: "info" };
              }
              const bookKey = available[Math.floor(Math.random() * available.length)];
              const book = ItemLibrary[bookKey];
              if (player.addItem({ name: bookKey, quantity: 1 })) {
                return { message: `Found "${book.name}"! A rare find among the ruins.`, type: "success" };
              }
              return { message: "Your cargo is too full to carry any books.", type: "warning" };
            }
          },
          {
            text: "Leave it alone (could be trapped)",
            resolve: () => {
              return { message: "Better safe than sorry. You leave the dusty ruins behind.", type: "info" };
            }
          }
        ]
      },
      {
        name: "Traveling Scholar",
        description: "A weary scholar rests by the road, surrounded by stacks of books. They offer to share knowledge — for a price or a favor.",
        terrain: ['Grass', 'Forest', 'Sand', 'Rock'],
        minDay: 15,
        choices: [
          {
            text: "Buy a book (half price!)",
            resolve: () => {
              const bookKeys = Object.keys(ItemLibrary).filter(k => ItemLibrary[k].tags?.has('book'));
              const available = bookKeys.filter(k => !player.inventory.has(k));
              if (available.length === 0) {
                return { message: "\"You already know everything I could teach you!\" the scholar laughs.", type: "info" };
              }
              const bookKey = available[Math.floor(Math.random() * available.length)];
              const book = ItemLibrary[bookKey];
              const halfPrice = Math.floor((book.goalPercent || 0.15) * (window._newGameGoldTarget || 5000) * 0.5);
              if (player.gold >= halfPrice) {
                if (!player.addItem({ name: bookKey, quantity: 1 })) {
                  return { message: "Your cargo is too full!", type: "warning" };
                }
                player.spendGold(halfPrice);
                return { message: `Bought "${book.name}" for ${halfPrice} gold — a scholar's discount!`, type: "success" };
              }
              return { message: `You need ${halfPrice} gold for "${book.name}". You can't afford it.`, type: "warning" };
            }
          },
          {
            text: "Trade 3 items for a book",
            resolve: () => {
              const nonBookItems = [...player.inventory.keys()].filter(k => !ItemLibrary[k]?.tags?.has('book'));
              if (nonBookItems.length < 3) {
                return { message: "\"You don't have enough goods to trade,\" the scholar sighs.", type: "warning" };
              }
              const bookKeys = Object.keys(ItemLibrary).filter(k => ItemLibrary[k].tags?.has('book'));
              const available = bookKeys.filter(k => !player.inventory.has(k));
              if (available.length === 0) {
                return { message: "\"You already own all my books!\" the scholar exclaims.", type: "info" };
              }
              // Remove 3 random non-book items
              for (let i = 0; i < 3; i++) {
                const idx = Math.floor(Math.random() * nonBookItems.length);
                player.removeItem({ name: nonBookItems[idx] });
                nonBookItems.splice(idx, 1);
              }
              const bookKey = available[Math.floor(Math.random() * available.length)];
              const book = ItemLibrary[bookKey];
              player.addItem({ name: bookKey, quantity: 1 }, true); // force add
              return { message: `Traded 3 items for "${book.name}"! Knowledge is priceless.`, type: "success" };
            }
          },
          {
            text: "Chat and move on",
            resolve: () => {
              return { message: "The scholar shares some gossip and you part ways.", type: "info" };
            }
          }
        ]
      },

      // ═══════════════════════════════
      //  WATER-ONLY EVENTS
      // ═══════════════════════════════
      {
        name: "Sea Monster",
        description: "A massive tentacle erupts from the waves! Something lurks beneath your vessel!",
        terrain: ['Water'],
        minDay: 5,
        timeLimit: 15,
        worstChoice: 0,
        timeoutMessage: "The creature wraps its tentacles around your hull — you're forced to fight!",
        choices: [
          {
            text: "Fight it off!",
            resolve: () => {
              const str = player.combatStrength || 3;
              const roll = Math.random() * 10;
              if (roll < str) {
                const gold = 40 + Math.floor(Math.random() * 60);
                player.earnGold(gold);
                return { message: `You drive the beast away! It drops ${gold} gold worth of sea treasures.`, type: "success" };
              }
              // Damage boat
              if (player.activeBoat) {
                const dmg = 15 + Math.floor(Math.random() * 20);
                player.activeBoat.applyDamage(dmg);
                return { message: `The creature batters your hull! -${dmg} condition (${player.activeBoat.condition}%).`, type: "error" };
              }
              const lost = Math.min(player.gold, Math.floor(player.gold * 0.1));
              if (lost > 0) player.spendGold(lost);
              return { message: `The monster thrashes your raft! Lost ${lost} gold in the chaos.`, type: "error" };
            }
          },
          {
            text: "Throw cargo overboard to distract it",
            resolve: () => {
              const items = [...player.inventory.keys()].filter(k => !ItemLibrary[k]?.tags?.has('book'));
              if (items.length > 0) {
                const sacrifice = items[Math.floor(Math.random() * items.length)];
                player.removeItem({ name: sacrifice });
                return { message: `You toss 1 ${sacrifice} into the water. The creature takes the bait and sinks below!`, type: "warning" };
              }
              return { message: "You have nothing to throw! The beast loses interest after rocking your boat.", type: "warning" };
            }
          },
          {
            text: "Cut anchor and flee!",
            resolve: () => {
              if (player.activeBoat) {
                player.activeBoat.applyDamage(5);
                return { message: `You speed away! Minor hull scrapes (-5 condition, now ${player.activeBoat.condition}%).`, type: "info" };
              }
              return { message: "You paddle frantically and escape!", type: "info" };
            }
          }
        ]
      },
      {
        name: "Flotsam & Jetsam",
        description: "Wooden crates and barrels bob in the water ahead — wreckage from a ship!",
        terrain: ['Water'],
        choices: [
          {
            text: "Haul in the salvage",
            resolve: () => {
              const roll = Math.random();
              if (roll < 0.4) {
                const gold = 20 + Math.floor(Math.random() * 40);
                player.earnGold(gold);
                return { message: `Waterlogged coin purses! Salvaged ${gold} gold.`, type: "success" };
              } else if (roll < 0.75) {
                const tradeGoods = ['Salt', 'Spices', 'Silk', 'Wine', 'Fish'];
                const item = tradeGoods[Math.floor(Math.random() * tradeGoods.length)];
                const qty = 1 + Math.floor(Math.random() * 3);
                if (ItemLibrary[item]) {
                  player.addItem({ name: item, quantity: qty });
                  return { message: `Found ${qty}x ${item} in a sealed crate!`, type: "success" };
                }
                player.earnGold(25);
                return { message: "Found some soggy but usable supplies worth 25 gold.", type: "success" };
              }
              // Trap — hull damage from hidden rocks
              if (player.activeBoat) {
                player.activeBoat.applyDamage(10);
                return { message: `Hidden debris scraped your hull! -10 condition (${player.activeBoat.condition}%).`, type: "error" };
              }
              return { message: "Just waterlogged junk. Not worth the effort.", type: "info" };
            }
          },
          {
            text: "Sail around it (play it safe)",
            resolve: () => {
              return { message: "Better safe than sorry on the open sea. You navigate around.", type: "info" };
            }
          }
        ]
      },

      // ═══════════════════════════════
      //  SNOW-ONLY EVENT
      // ═══════════════════════════════
      {
        name: "Blizzard",
        description: "A howling blizzard descends without warning! Visibility drops to nothing and the cold bites deep.",
        terrain: ['Snow'],
        season: ['Winter', 'Fall'],
        timeLimit: 15,
        worstChoice: 1,
        timeoutMessage: "The blizzard engulfs you before you can prepare — you stumble forward blindly!",
        choices: [
          {
            text: "Dig in and build a snow shelter",
            resolve: () => {
              if (player.inventory.has('Wood')) {
                player.removeItem({ name: 'Wood' });
                return { message: "You use 1 Wood to build a sturdy shelter and ride out the storm safely.", type: "success" };
              }
              return { message: "Without wood for a fire, you huddle together and wait. Cold but alive.", type: "info" };
            }
          },
          {
            text: "Push through the blizzard",
            resolve: () => {
              const roll = Math.random();
              if (roll < 0.3) {
                // Lose perishable goods to cold
                const perishables = [...player.inventory.entries()]
                  .filter(([k]) => ItemLibrary[k]?.perishable);
                if (perishables.length > 0) {
                  const [key] = perishables[Math.floor(Math.random() * perishables.length)];
                  player.removeItem({ name: key });
                  return { message: `The freezing cold ruined 1 ${key}!`, type: "error" };
                }
              }
              if (roll < 0.15) {
                const lost = Math.min(player.gold, 20);
                if (lost > 0) player.spendGold(lost);
                return { message: `Frostbite! Lost ${lost} gold on medical supplies.`, type: "error" };
              }
              return { message: "You trudge through the blizzard and emerge on the other side!", type: "success" };
            }
          },
          {
            text: "Burn cargo for warmth (sacrifice 2 items)",
            resolve: () => {
              const items = [...player.inventory.keys()].filter(k => !ItemLibrary[k]?.tags?.has('book'));
              if (items.length >= 2) {
                const a = items[Math.floor(Math.random() * items.length)];
                player.removeItem({ name: a });
                const remaining = items.filter(k => k !== a);
                const b = remaining[Math.floor(Math.random() * remaining.length)] || a;
                player.removeItem({ name: b });
                const gold = 10 + Math.floor(Math.random() * 15);
                player.earnGold(gold);
                return { message: `Burned 1 ${a} and 1 ${b} for warmth. Found ${gold} gold in the ashes of your camp.`, type: "warning" };
              }
              return { message: "You don't have enough cargo to burn. You shiver through the storm.", type: "warning" };
            }
          }
        ]
      },

      // ═══════════════════════════════
      //  SAND-ONLY EVENT
      // ═══════════════════════════════
      {
        name: "Quicksand",
        description: "The ground gives way beneath you! You're sinking into quicksand!",
        terrain: ['Sand'],
        timeLimit: 10,
        worstChoice: 2,
        timeoutMessage: "You're sinking fast — panic sets in as you thrash around!",
        choices: [
          {
            text: "Throw heavy cargo to lighten the load",
            resolve: () => {
              const heavyItems = [...player.inventory.keys()]
                .filter(k => ItemLibrary[k] && ItemLibrary[k].weight >= 2 && !ItemLibrary[k].tags?.has('book'));
              if (heavyItems.length > 0) {
                const item = heavyItems[Math.floor(Math.random() * heavyItems.length)];
                player.removeItem({ name: item });
                return { message: `You toss 1 ${item} and pull yourself free!`, type: "warning" };
              }
              // No heavy items, sacrifice gold
              const cost = Math.min(player.gold, 25);
              if (cost > 0) player.spendGold(cost);
              return { message: `You struggle free but drop ${cost} gold coins in the sand!`, type: "warning" };
            }
          },
          {
            text: "Use a rope (requires Tools)",
            resolve: () => {
              if (player.inventory.has('Tools')) {
                player.removeItem({ name: 'Tools' });
                return { message: "You use your Tools to rig a rope and pull yourself out. Tools consumed.", type: "success" };
              }
              return { message: "You don't have Tools! You flail and barely escape, losing some supplies.", type: "error" };
            }
          },
          {
            text: "Stay calm and slowly work your way out",
            resolve: () => {
              if (Math.random() < 0.6) {
                return { message: "You stay calm, spread your weight, and slowly crawl free!", type: "success" };
              }
              // Sink deeper, lose more
              const items = [...player.inventory.keys()].filter(k => !ItemLibrary[k]?.tags?.has('book'));
              if (items.length > 0) {
                const lost = items[Math.floor(Math.random() * items.length)];
                player.removeItem({ name: lost });
                return { message: `You struggle too much and 1 ${lost} sinks into the sand before you escape!`, type: "error" };
              }
              const goldLost = Math.min(player.gold, 15);
              if (goldLost > 0) player.spendGold(goldLost);
              return { message: `You barely escape but ${goldLost} gold sinks into the sand!`, type: "error" };
            }
          }
        ]
      },

      // ═══════════════════════════════════════════════════════
      //  NEW ECONOMY/META EVENTS (integrate with new systems)
      // ═══════════════════════════════════════════════════════

      // --- Treasure Map Fragment ---
      {
        name: "Old Hermit's Gift",
        description: "An old hermit beckons you from a cave entrance. 'I've no use for this anymore,' he says, holding a tattered parchment.",
        terrain: ['Rock', 'Forest', 'Sand'],
        minDay: 8,
        choices: [
          {
            text: "Accept the parchment",
            resolve: () => {
              if (typeof treasureSystem !== 'undefined') {
                const regions = ['northern', 'southern', 'eastern', 'western', 'central'];
                const region = regions[Math.floor(Math.random() * regions.length)];
                treasureSystem.addFragment(region);
                return { message: `Received a treasure map fragment (${region} region)! Collect 3 of the same region to form a map.`, type: "success" };
              }
              const gold = 25 + Math.floor(Math.random() * 30);
              player.earnGold(gold);
              return { message: `The parchment was worthless, but you found ${gold} gold in the cave!`, type: "info" };
            }
          },
          {
            text: "Decline politely",
            resolve: () => {
              return { message: "The hermit shrugs and retreats into his cave.", type: "info" };
            }
          }
        ]
      },

      // --- Smuggler Encounter ---
      {
        name: "Shady Dockworker",
        description: "A figure in a dark cloak sidles up to you. 'Psst... looking to make some real coin? I know where the black markets are.'",
        terrain: ['Grass', 'Sand', 'Forest'],
        minDay: 10,
        choices: [
          {
            text: "Pay 50 gold for information",
            resolve: () => {
              if (player.gold >= 50) {
                player.spendGold(50);
                if (typeof smugglingSystem !== 'undefined') {
                  smugglingSystem.knownMarkets = smugglingSystem.knownMarkets || [];
                  // Reveal a random city's black market
                  const eligible = (typeof cities !== 'undefined' ? cities : []).filter(c => c.hasBlackMarket && !smugglingSystem.knownMarkets.includes(c.name));
                  if (eligible.length > 0) {
                    const city = eligible[Math.floor(Math.random() * eligible.length)];
                    smugglingSystem.discoverMarket(city.name);
                    return { message: `The figure whispers: "${city.name} has a black market. Ask for 'the special goods'."`, type: "success" };
                  }
                }
                return { message: "The information leads to a dead end. 50 gold wasted.", type: "warning" };
              }
              return { message: "You can't afford the information. The figure melts into the shadows.", type: "warning" };
            }
          },
          {
            text: "Decline — too risky",
            resolve: () => {
              return { message: "You walk away. Some opportunities aren't worth the risk.", type: "info" };
            }
          }
        ]
      },

      // --- Gambling Challenge ---
      {
        name: "Dice Game in the Woods",
        description: "A group of travelers has set up a dice game by a campfire. 'Care to try your luck, stranger?'",
        terrain: ['Grass', 'Forest', 'Sand'],
        choices: [
          {
            text: "Bet 30 gold on dice (50/50)",
            resolve: () => {
              if (player.gold < 30) return { message: "You don't have enough gold to play.", type: "warning" };
              player.spendGold(30);
              if (Math.random() < 0.50) {
                player.earnGold(60);
                return { message: "Lucky roll! You win 60 gold!", type: "success" };
              }
              return { message: "Bad luck! You lose 30 gold.", type: "error" };
            }
          },
          {
            text: "Bet 80 gold — high stakes (40% win, 2×)",
            resolve: () => {
              if (player.gold < 80) return { message: "Not enough gold for high stakes.", type: "warning" };
              player.spendGold(80);
              if (Math.random() < 0.40) {
                player.earnGold(160);
                return { message: "High roller! You pocket 160 gold!", type: "success" };
              }
              return { message: "The dice betray you. 80 gold gone.", type: "error" };
            }
          },
          {
            text: "Walk away",
            resolve: () => {
              return { message: "Gambling's a fool's game... right?", type: "info" };
            }
          }
        ]
      },

      // --- Cursed Item ---
      {
        name: "Mysterious Chest",
        description: "A beautifully ornate chest sits alone in the road. It glows faintly with an eerie light.",
        terrain: ['Grass', 'Forest', 'Rock', 'Sand'],
        minDay: 15,
        timeLimit: 15,
        worstChoice: 0,
        timeoutMessage: "Curiosity gets the better of you — you open the chest!",
        choices: [
          {
            text: "Open the chest",
            resolve: () => {
              const roll = Math.random();
              if (roll < 0.35) {
                // Great treasure!
                const gold = 80 + Math.floor(Math.random() * 100);
                player.earnGold(gold);
                return { message: `Jackpot! The chest held ${gold} gold!`, type: "success" };
              } else if (roll < 0.55) {
                // Treasure item
                if (ItemLibrary['AncientCoin']) {
                  player.addItem({ name: 'AncientCoin', quantity: 1 }, true);
                  return { message: "An Ancient Coin glimmers inside! A valuable relic.", type: "success" };
                }
                player.earnGold(50);
                return { message: "Found 50 gold inside!", type: "success" };
              } else if (roll < 0.75) {
                // Cursed!
                if (ItemLibrary['CursedAmulet']) {
                  player.addItem({ name: 'CursedAmulet', quantity: 1 }, true);
                  return { message: "A Cursed Amulet latches onto you! It drains 5 gold/day until you sell it!", type: "error" };
                }
                const lost = Math.min(player.gold, 30);
                if (lost > 0) player.spendGold(lost);
                return { message: `The chest was trapped! Lost ${lost} gold.`, type: "error" };
              } else {
                // Trap, gold loss
                const lost = Math.min(player.gold, 40);
                if (lost > 0) player.spendGold(lost);
                return { message: `TRAP! Poison gas erupts! You stumble away, losing ${lost} gold on antidotes.`, type: "error" };
              }
            }
          },
          {
            text: "Leave it alone",
            resolve: () => {
              return { message: "You've seen enough horror tales to know better. You walk away.", type: "info" };
            }
          }
        ]
      },

      // --- Haggling Encounter ---
      {
        name: "Stubborn Peddler",
        description: "A peddler blocks your path with a cart of overpriced goods. 'Everything must go!' they shout.",
        terrain: ['Grass', 'Sand', 'Forest', 'Rock'],
        choices: [
          {
            text: "Haggle for a deal (minigame)",
            resolve: () => {
              if (typeof minigameManager !== 'undefined') {
                minigameManager.launch('haggling', { basePrice: 100, reputation: player.currentCity?.reputation || 50 }, (result) => {
                  if (result && result.success) {
                    const gold = 20 + Math.floor((result.avgAccuracy || 0) * 20);
                    player.earnGold(gold);
                    if (typeof notificationManager !== 'undefined')
                      notificationManager.log(`Haggled successfully! Earned ${gold} gold worth of deals!`, 'success');
                  } else {
                    if (typeof notificationManager !== 'undefined')
                      notificationManager.log('The peddler refuses to budge. No deal.', 'warning');
                  }
                  if (typeof gameStateManager !== 'undefined')
                    gameStateManager.setState(GameStates.PLAYING);
                });
                gameStateManager.setState(GameStates.MINIGAME);
                return { message: "Haggle time! Stop the bar in the green zone!", type: "info" };
              }
              // Fallback if no minigame system
              if (Math.random() < 0.5) {
                const gold = 20 + Math.floor(Math.random() * 20);
                player.earnGold(gold);
                return { message: `You talked them down and got ${gold} gold in goods!`, type: "success" };
              }
              return { message: "They won't budge on the price.", type: "info" };
            }
          },
          {
            text: "Buy at full price (40 gold for random goods)",
            resolve: () => {
              if (player.gold >= 40) {
                player.spendGold(40);
                const goods = ['Wine', 'Jewelry', 'Silk', 'Spices', 'Tools'];
                const item = goods[Math.floor(Math.random() * goods.length)];
                if (ItemLibrary[item]) {
                  player.addItem({ name: item, quantity: 2 });
                  return { message: `Bought 2x ${item} for 40 gold.`, type: "info" };
                }
                player.earnGold(40);
                return { message: "The goods were fake! You get your money back.", type: "warning" };
              }
              return { message: "Too expensive. You walk away empty handed.", type: "warning" };
            }
          },
          {
            text: "Walk around them",
            resolve: () => {
              return { message: "'FINE! SEE IF I CARE!' the peddler shouts as you leave.", type: "info" };
            }
          }
        ]
      },

      // --- Bank Robbery Aftermath ---
      {
        name: "Ransacked Village",
        description: "You come across a village that was recently raided. The bank vault lies open and empty.",
        terrain: ['Grass', 'Rock', 'Forest'],
        minDay: 20,
        choices: [
          {
            text: "Help the villagers (donate 50 gold)",
            resolve: () => {
              if (player.gold >= 50) {
                player.spendGold(50);
                // Boost reputation at all nearby cities
                if (typeof cities !== 'undefined') {
                  for (const c of cities) {
                    const d = Math.abs(player.x - c.location.x) + Math.abs(player.y - c.location.y);
                    if (d <= 15 && c.adjustReputation) c.adjustReputation(5);
                  }
                }
                return { message: "Your generosity earns major reputation with nearby cities!", type: "success" };
              }
              return { message: "You wish you could help but can't afford it.", type: "warning" };
            }
          },
          {
            text: "Search the ruins for leftover loot",
            resolve: () => {
              if (Math.random() < 0.4) {
                const gold = 30 + Math.floor(Math.random() * 50);
                player.earnGold(gold);
                return { message: `Found ${gold} gold the raiders missed!`, type: "success" };
              }
              // Reputation hit if caught scavenging
              if (typeof cities !== 'undefined') {
                for (const c of cities) {
                  const d = Math.abs(player.x - c.location.x) + Math.abs(player.y - c.location.y);
                  if (d <= 10 && c.adjustReputation) c.adjustReputation(-3);
                }
              }
              return { message: "Villagers catch you scavenging. Your reputation suffers.", type: "error" };
            }
          },
          {
            text: "Move on",
            resolve: () => {
              return { message: "You offer condolences and continue your journey.", type: "info" };
            }
          }
        ]
      },

      // --- Treasure Map Clue ---
      {
        name: "Treasure Map Peddler",
        description: "A weathered sailor waves a tattered map piece at you. 'Straight from the Dragon's Hoard, mate!'",
        terrain: ['Grass', 'Sand', 'Rock', 'Forest', 'Snow'],
        minDay: 12,
        choices: [
          {
            text: "Buy the fragment (35 gold)",
            resolve: () => {
              if (player.gold >= 35) {
                player.spendGold(35);
                if (typeof treasureSystem !== 'undefined') {
                  const regions = ['northern', 'southern', 'eastern', 'western', 'central'];
                  const region = regions[Math.floor(Math.random() * regions.length)];
                  treasureSystem.addFragment(region);
                  return { message: `Got a ${region} map fragment! Collect 3 of the same region.`, type: "success" };
                }
                player.earnGold(35);
                return { message: "The map was illegible. Money refunded.", type: "warning" };
              }
              return { message: "Not enough gold. The sailor sails away.", type: "warning" };
            }
          },
          {
            text: "Decline",
            resolve: () => {
              return { message: "'Your loss, landlubber!' the sailor grumbles.", type: "info" };
            }
          }
        ]
      },

      // --- Investment Opportunity ---
      {
        name: "Merchant Guild Offer",
        description: "A merchant guild representative approaches you. 'Invest in our trade route and earn dividends!'",
        terrain: ['Grass', 'Forest', 'Rock', 'Sand'],
        minDay: 15,
        choices: [
          {
            text: "Invest 100 gold (risky, 2-3× return in ~15 days)",
            resolve: () => {
              if (player.gold >= 100) {
                player.spendGold(100);
                if (typeof bankingSystem !== 'undefined' && typeof cities !== 'undefined' && cities.length > 0) {
                  const city = cities[Math.floor(Math.random() * cities.length)];
                  bankingSystem.invest(100, city.name);
                  return { message: `Invested 100g in ${city.name}'s trade route! Check the bank to track returns.`, type: "success" };
                }
                // Fallback: simple random return later
                const returnGold = Math.floor(100 * (1.5 + Math.random() * 1.5));
                setTimeout(() => {
                  player.earnGold(returnGold);
                  if (typeof notificationManager !== 'undefined')
                    notificationManager.log(`Investment returned ${returnGold} gold!`, 'success');
                }, 60000);
                return { message: `Invested 100g. Returns will arrive eventually.`, type: "info" };
              }
              return { message: "You can't afford the minimum investment.", type: "warning" };
            }
          },
          {
            text: "Decline",
            resolve: () => {
              return { message: "'Your loss!' the representative huffs.", type: "info" };
            }
          }
        ]
      },

      // --- Smuggling Inspection ---
      {
        name: "Road Checkpoint",
        description: "City guards have set up a checkpoint. They're inspecting every traveler's cargo!",
        terrain: ['Grass', 'Rock', 'Sand'],
        timeLimit: 12,
        worstChoice: 0,
        timeoutMessage: "The guards grow suspicious of your hesitation!",
        choices: [
          {
            text: "Submit to inspection",
            resolve: () => {
              // Check for contraband
              const contraband = [...player.inventory.keys()].filter(k => ItemLibrary[k]?.tags?.has('contraband'));
              if (contraband.length > 0) {
                // Confiscate all contraband + fine
                for (const c of contraband) {
                  const entry = player.inventory.get(c);
                  const qty = entry ? entry.quantity : 1;
                  for (let i = 0; i < qty; i++) player.removeItem({ name: c });
                }
                const fine = 50 + Math.floor(Math.random() * 50);
                const paid = Math.min(player.gold, fine);
                if (paid > 0) player.spendGold(paid);
                return { message: `Contraband confiscated! Fined ${paid} gold. ${contraband.length} item type(s) seized.`, type: "error" };
              }
              return { message: "All clear! The guards wave you through.", type: "success" };
            }
          },
          {
            text: "Bluff your way through (minigame)",
            resolve: () => {
              if (typeof minigameManager !== 'undefined') {
                minigameManager.launch('bluffMeter', { timeLimit: 10 }, (result) => {
                  if (result && result.success) {
                    if (typeof notificationManager !== 'undefined')
                      notificationManager.log('You bluffed your way past the guards!', 'success');
                  } else {
                    // Confiscate contraband if any
                    const contraband = [...player.inventory.keys()].filter(k => ItemLibrary[k]?.tags?.has('contraband'));
                    if (contraband.length > 0) {
                      for (const c of contraband) {
                        const entry = player.inventory.get(c);
                        const qty = entry ? entry.quantity : 1;
                        for (let i = 0; i < qty; i++) player.removeItem({ name: c });
                      }
                    }
                    const fine = 30 + Math.floor(Math.random() * 40);
                    const paid = Math.min(player.gold, fine);
                    if (paid > 0) player.spendGold(paid);
                    if (typeof notificationManager !== 'undefined')
                      notificationManager.log(`Bluff failed! Fined ${paid} gold.`, 'error');
                  }
                  if (typeof gameStateManager !== 'undefined')
                    gameStateManager.setState(GameStates.PLAYING);
                });
                gameStateManager.setState(GameStates.MINIGAME);
                return { message: "Keep your heartbeat steady! Tap rhythm to stay calm.", type: "info" };
              }
              // Fallback
              if (Math.random() < 0.5) {
                return { message: "You act casual and walk through. Phew!", type: "success" };
              }
              const fine = Math.min(player.gold, 40);
              if (fine > 0) player.spendGold(fine);
              return { message: `Caught! Fined ${fine} gold.`, type: "error" };
            }
          },
          {
            text: "Bribe the guards (25 gold)",
            resolve: () => {
              if (player.gold >= 25) {
                player.spendGold(25);
                return { message: "The guard pockets your coin and waves you through. No questions asked.", type: "info" };
              }
              return { message: "You can't afford the bribe. You submit to inspection instead.", type: "warning" };
            }
          }
        ]
      },

      // --- Bounty Intel ---
      {
        name: "Raider Camp Spotted",
        description: "You spot smoke from a raider encampment in the distance. Intel about their leader could be valuable.",
        terrain: ['Forest', 'Rock', 'Grass'],
        minDay: 10,
        choices: [
          {
            text: "Scout the camp (risky, intel reward)",
            resolve: () => {
              if (Math.random() < 0.6) {
                // Raider info
                if (typeof raiderManager !== 'undefined' && raiderManager.raiders.length > 0) {
                  const r = raiderManager.raiders[Math.floor(Math.random() * raiderManager.raiders.length)];
                  return { message: `Scout successful! Raider at (${r.x},${r.y}), strength ${r.strength}. Check bounty boards for gold!`, type: "success" };
                }
                player.earnGold(20);
                return { message: "Found 20 gold in an unattended stash!", type: "success" };
              }
              // Caught!
              const lost = Math.min(player.gold, 20);
              if (lost > 0) player.spendGold(lost);
              return { message: `Ambushed! Lost ${lost} gold escaping!`, type: "error" };
            }
          },
          {
            text: "Avoid the camp",
            resolve: () => {
              return { message: "You give the smoke a wide berth.", type: "info" };
            }
          }
        ]
      },

      // --- Navigation Dodge (sailing) ---
      {
        name: "Reef Maze",
        description: "Your vessel enters a treacherous reef-filled passage! Navigate carefully or risk hull damage!",
        terrain: ['Water'],
        minDay: 5,
        choices: [
          {
            text: "Navigate through (minigame)",
            resolve: () => {
              if (typeof minigameManager !== 'undefined') {
                minigameManager.launch('navigationDodge', {}, (result) => {
                  if (result && result.success) {
                    const gold = 30 + (result.dodged || 0);
                    player.earnGold(gold);
                    if (typeof notificationManager !== 'undefined')
                      notificationManager.log(`Perfect navigation! Found ${gold} gold in a hidden cove!`, 'success');
                  } else {
                    if (player.activeBoat) {
                      player.activeBoat.applyDamage(20);
                      if (typeof notificationManager !== 'undefined')
                        notificationManager.log(`Crashed into a reef! -20 condition (${player.activeBoat.condition}%).`, 'error');
                    }
                  }
                  if (typeof gameStateManager !== 'undefined')
                    gameStateManager.setState(GameStates.PLAYING);
                });
                gameStateManager.setState(GameStates.MINIGAME);
                return { message: "Dodge the obstacles! Use arrow keys!", type: "info" };
              }
              // Fallback
              if (Math.random() < 0.5) {
                player.earnGold(30);
                return { message: "Navigated safely! Found 30 gold.", type: "success" };
              }
              if (player.activeBoat) player.activeBoat.applyDamage(15);
              return { message: "Scraped the hull on a reef!", type: "error" };
            }
          },
          {
            text: "Go around (slow but safe)",
            resolve: () => {
              return { message: "You take the long way around. Safe but costly in time.", type: "info" };
            }
          }
        ]
      },

      // --- Lockpicking Encounter ---
      {
        name: "Locked Strongbox",
        description: "You find a heavy iron strongbox chained to a sunken tree trunk. The lock is old but sturdy.",
        terrain: ['Forest', 'Rock', 'Grass'],
        minDay: 8,
        choices: [
          {
            text: "Pick the lock (minigame)",
            resolve: () => {
              if (typeof minigameManager !== 'undefined') {
                minigameManager.launch('lockpicking', { tumblers: 4, timeLimit: 20 }, (result) => {
                  if (result && result.success) {
                    const roll = Math.random();
                    let msg;
                    if (roll < 0.4) {
                      const gold = 60 + Math.floor(Math.random() * 80);
                      player.earnGold(gold);
                      msg = `The strongbox held ${gold} gold!`;
                    } else if (roll < 0.7 && ItemLibrary['EnchantedRing']) {
                      player.addItem({ name: 'EnchantedRing', quantity: 1 }, true);
                      msg = 'Found an Enchanted Ring inside!';
                    } else {
                      const gold = 40 + Math.floor(Math.random() * 30);
                      player.earnGold(gold);
                      msg = `Found ${gold} gold and some old documents.`;
                    }
                    if (typeof notificationManager !== 'undefined')
                      notificationManager.log(msg, 'success');
                  } else {
                    if (typeof notificationManager !== 'undefined')
                      notificationManager.log('The lock jams! You can\'t open it.', 'warning');
                  }
                  if (typeof gameStateManager !== 'undefined')
                    gameStateManager.setState(GameStates.PLAYING);
                });
                gameStateManager.setState(GameStates.MINIGAME);
                return { message: "Rotate the tumblers to align! Use arrow keys.", type: "info" };
              }
              // Fallback
              if (Math.random() < 0.4) {
                const gold = 50 + Math.floor(Math.random() * 50);
                player.earnGold(gold);
                return { message: `Pried it open! Found ${gold} gold.`, type: "success" };
              }
              return { message: "The lock won't budge.", type: "warning" };
            }
          },
          {
            text: "Smash it open (brute force, 50% chance)",
            resolve: () => {
              if (Math.random() < 0.5) {
                const gold = 30 + Math.floor(Math.random() * 40);
                player.earnGold(gold);
                return { message: `Smashed it! Found ${gold} gold inside.`, type: "success" };
              }
              return { message: "The box is tougher than you thought. You hurt your hand.", type: "warning" };
            }
          },
          {
            text: "Leave it",
            resolve: () => {
              return { message: "You leave the mystery box behind.", type: "info" };
            }
          }
        ]
      },

      // --- Memory Challenge ---
      {
        name: "Curious Merchant's Game",
        description: "A bored merchant at a crossroads offers a deal: 'Match my cards and win a prize!'",
        terrain: ['Grass', 'Forest', 'Sand', 'Rock'],
        choices: [
          {
            text: "Play the memory game (entry: 20 gold)",
            resolve: () => {
              if (player.gold < 20) return { message: "You don't have 20 gold to play.", type: "warning" };
              player.spendGold(20);
              if (typeof minigameManager !== 'undefined') {
                minigameManager.launch('memoryMatch', { entryFee: 20 }, (result) => {
                  if (result && result.totalWon > 0) {
                    player.earnGold(result.totalWon);
                    if (typeof notificationManager !== 'undefined')
                      notificationManager.log(`Good memory! Won ${result.totalWon} gold! (net: ${result.profit}g)`, result.profit >= 0 ? 'success' : 'warning');
                  } else {
                    if (typeof notificationManager !== 'undefined')
                      notificationManager.log('Too many mistakes! You lose your entry fee.', 'warning');
                  }
                  if (typeof gameStateManager !== 'undefined')
                    gameStateManager.setState(GameStates.PLAYING);
                });
                gameStateManager.setState(GameStates.MINIGAME);
                return { message: "Match all the pairs! Click to flip cards.", type: "info" };
              }
              // Fallback
              if (Math.random() < 0.5) {
                player.earnGold(60);
                return { message: "Won 60 gold!", type: "success" };
              }
              return { message: "Lost the game and your 20 gold entry.", type: "error" };
            }
          },
          {
            text: "Decline",
            resolve: () => {
              return { message: "'Suit yourself!' the merchant shrugs.", type: "info" };
            }
          }
        ]
      },

      // --- Contract Clue ---
      {
        name: "Town Crier",
        description: "A town crier announces bounties and contracts from nearby cities. 'Hear ye, hear ye!'",
        terrain: ['Grass', 'Forest', 'Rock', 'Sand'],
        minDay: 5,
        choices: [
          {
            text: "Listen for opportunities",
            resolve: () => {
              if (typeof cities !== 'undefined' && cities.length > 0) {
                const city = cities[Math.floor(Math.random() * cities.length)];
                const features = [];
                if (city.hasBountyBoard) features.push('a bounty board');
                if (city.hasBank) features.push('a bank');
                if (city.hasGamblingDen) features.push('a gambling den');
                if (features.length > 0) {
                  return { message: `"${city.name}" has ${features.join(', ')}! Visit to earn more gold.`, type: "info" };
                }
                return { message: `"${city.name}" is a quiet trading post. Good for basic commerce.`, type: "info" };
              }
              return { message: "The crier rambles on but says nothing useful.", type: "info" };
            }
          },
          {
            text: "Ignore and move on",
            resolve: () => {
              return { message: "You've heard enough town criers for one lifetime.", type: "info" };
            }
          }
        ]
      },

      // --- Pirate Ghost Ship (water only) ---
      {
        name: "Ghost Ship",
        description: "A spectral galleon appears through the fog, its tattered sails billowing in a wind you cannot feel.",
        terrain: ['Water'],
        minDay: 20,
        timeLimit: 12,
        worstChoice: 1,
        timeoutMessage: "The ghost ship passes through you! An icy chill steals your vitality!",
        choices: [
          {
            text: "Board the ghost ship (brave!)",
            resolve: () => {
              const roll = Math.random();
              if (roll < 0.35) {
                const gold = 100 + Math.floor(Math.random() * 150);
                player.earnGold(gold);
                if (ItemLibrary['GoldenIdol']) {
                  player.addItem({ name: 'GoldenIdol', quantity: 1 }, true);
                  return { message: `The spirits test your courage and reward you with ${gold} gold and a Golden Idol!`, type: "success" };
                }
                return { message: `Found ${gold} gold in the spectral hold!`, type: "success" };
              } else if (roll < 0.55) {
                // Treasure fragment
                if (typeof treasureSystem !== 'undefined') {
                  const regions = ['northern', 'southern', 'eastern', 'western', 'central'];
                  treasureSystem.addFragment(regions[Math.floor(Math.random() * regions.length)]);
                  return { message: "A ghostly captain hands you a map fragment before fading away!", type: "success" };
                }
                player.earnGold(50);
                return { message: "Found 50 gold in the ghost ship!", type: "success" };
              } else {
                // Cursed
                if (ItemLibrary['CursedAmulet']) {
                  player.addItem({ name: 'CursedAmulet', quantity: 1 }, true);
                }
                const lost = Math.min(player.gold, 50);
                if (lost > 0) player.spendGold(lost);
                return { message: `The spirits are angry! Lost ${lost} gold and gained a cursed amulet!`, type: "error" };
              }
            }
          },
          {
            text: "Flee at full speed",
            resolve: () => {
              if (player.activeBoat) player.activeBoat.applyDamage(8);
              return { message: "You sail away at top speed. The ghost ship vanishes into the fog.", type: "warning" };
            }
          }
        ]
      },

      // --- Earthquake ---
      {
        name: "Earthquake",
        description: "The ground shakes violently! Rocks tumble from the hillside!",
        terrain: ['Rock', 'Grass', 'Forest'],
        timeLimit: 8,
        worstChoice: 1,
        timeoutMessage: "A rockslide catches you off guard!",
        choices: [
          {
            text: "Take cover behind a boulder",
            resolve: () => {
              if (Math.random() < 0.75) {
                return { message: "You duck behind a boulder and weather the quake safely!", type: "success" };
              }
              const lost = Math.min(player.gold, 15);
              if (lost > 0) player.spendGold(lost);
              return { message: `A rock clips you! Lost ${lost} gold on medical supplies.`, type: "warning" };
            }
          },
          {
            text: "Run for open ground",
            resolve: () => {
              if (Math.random() < 0.5) {
                return { message: "You sprint to safety!", type: "success" };
              }
              const items = [...player.inventory.keys()].filter(k => !ItemLibrary[k]?.tags?.has('book'));
              if (items.length > 0) {
                const lost = items[Math.floor(Math.random() * items.length)];
                player.removeItem({ name: lost });
                return { message: `Dropped 1 ${lost} while running!`, type: "error" };
              }
              return { message: "You stumble but make it out with just bruises.", type: "warning" };
            }
          }
        ]
      },

      // --- Wheel of Fortune Event ---
      {
        name: "Fortune Teller's Wheel",
        description: "A fortune teller sits in a colorful tent, a large wheel of fortune spinning beside her. 'Spin and discover your fate!'",
        terrain: ['Grass', 'Forest', 'Sand'],
        choices: [
          {
            text: "Spin the wheel (costs 25 gold)",
            resolve: () => {
              if (player.gold < 25) return { message: "You can't afford a spin.", type: "warning" };
              player.spendGold(25);
              if (typeof minigameManager !== 'undefined') {
                minigameManager.launch('wheelOfFortune', { bet: 25 }, (result) => {
                  if (result && result.winnings > 0) {
                    player.earnGold(result.winnings);
                    if (typeof notificationManager !== 'undefined')
                      notificationManager.log(`The wheel grants you ${result.winnings} gold!`, result.profit > 0 ? 'success' : 'info');
                  } else {
                    if (typeof notificationManager !== 'undefined')
                      notificationManager.log(`The wheel stops on ${result?.segment || 'nothing'}. Better luck next time!`, 'warning');
                  }
                  if (typeof gameStateManager !== 'undefined')
                    gameStateManager.setState(GameStates.PLAYING);
                });
                gameStateManager.setState(GameStates.MINIGAME);
                return { message: "The wheel spins!", type: "info" };
              }
              // Fallback
              const outcomes = [0, 10, 25, 50, 100, 0, 15];
              const result = outcomes[Math.floor(Math.random() * outcomes.length)];
              if (result > 0) {
                player.earnGold(result);
                return { message: `The wheel stops on ${result} gold!`, type: "success" };
              }
              return { message: "Bad luck! The wheel stops on nothing.", type: "warning" };
            }
          },
          {
            text: "Decline the spin",
            resolve: () => {
              return { message: "'Your loss!' the fortune teller cackles.", type: "info" };
            }
          }
        ]
      },
    ];
  }

  toJSON() {
    return {
      tilesMoved: this.tilesMoved,
      eventHistory: this.eventHistory,
    };
  }

  static fromJSON(data) {
    const es = new EventSystem();
    es.tilesMoved = data.tilesMoved || 0;
    es.eventHistory = data.eventHistory || [];
    return es;
  }
}
