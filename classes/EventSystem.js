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
    // Don't override if combat was started by the event
    if (gameStateManager.currentState !== GameStates.COMBAT) {
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
