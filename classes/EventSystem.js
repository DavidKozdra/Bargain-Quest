// EventSystem.js — Random travel events

class EventSystem {
  constructor() {
    this.tilesMoved = 0;
    this.checkInterval = 4; // Check every 4 tiles moved
    this.eventChance = 0.2; // 20% chance per check
    this.currentEvent = null;
    this.eventHistory = [];
    this.maxHistory = 30;

    this.events = this.defineEvents();
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
                return { message: "The traveler is grateful. Your reputation improves.", type: "info" };
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
