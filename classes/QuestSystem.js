// QuestSystem.js — Procedural multi-stage quest engine
// Generates narrative quest chains that combine delivery, smuggling,
// combat, diplomacy, and exploration into coherent storylines.

class QuestSystem {
  constructor() {
    /** @type {Quest[]} */
    this.active = [];
    /** @type {Quest[]} */
    this.completed = [];
    this.maxActive = 2;
    this._lastOfferDay = -999;
    this.offerCooldownDays = 5;
    /** @type {Quest|null} Current quest offer being shown to player */
    this.pendingOffer = null;

    // Quest templates define the narrative arcs
    this.templates = this._defineTemplates();

    this._onDayChanged = () => this._onDayTick();
    window.addEventListener('dayChanged', this._onDayChanged);
  }

  destroy() {
    window.removeEventListener('dayChanged', this._onDayChanged);
  }

  // ─── Quest Templates ─────────────────────────────────────
  // Each template generates a multi-stage quest with narrative flavor.
  // Stages reference existing game mechanics: delivery, combat,
  // smuggling, reputation checks, survey, and item acquisition.

  _defineTemplates() {
    return [
      // ── The Scholar's Request ──
      {
        id: 'scholar_texts',
        name: "The Scholar's Request",
        minCities: 3,
        minDay: 3,
        weight: 10,
        generate: (ctx) => {
          const sourceCities = ctx.pickCities(3);
          const patron = sourceCities[0];
          const lib1 = sourceCities[1];
          const lib2 = sourceCities[2];
          const reward = ctx.scaleGold(300);
          return {
            id: ctx.uid('scholar'),
            templateId: 'scholar_texts',
            title: `The Scholar of ${patron.name}`,
            description: `A scholar in ${patron.name} needs ancient texts from ${lib1.name} and ${lib2.name}. Rumor has it one city's library is restricted.`,
            patron: patron.name,
            stages: [
              {
                id: 'acquire_text_1',
                type: 'visit_city',
                description: `Travel to ${lib1.name} and acquire the first text.`,
                targetCity: lib1.name,
                item: 'ForbiddenTexts',
                itemQty: 1,
                complete: false,
              },
              {
                id: 'acquire_text_2',
                type: 'visit_city',
                description: `Travel to ${lib2.name} for the second text. The library may require... creative acquisition.`,
                targetCity: lib2.name,
                item: 'ForbiddenTexts',
                itemQty: 1,
                complete: false,
              },
              {
                id: 'return_texts',
                type: 'deliver',
                description: `Return both texts to the scholar in ${patron.name}.`,
                targetCity: patron.name,
                item: 'ForbiddenTexts',
                itemQty: 2,
                complete: false,
              },
            ],
            currentStage: 0,
            reward: { gold: reward, xp: 80, reputation: { city: patron.name, amount: 10 } },
            bonusReward: { item: 'MarketAnalysis' },
            startDay: ctx.day,
            deadline: null,
            failed: false,
            completed: false,
          };
        },
      },

      // ── The Iron Famine ──
      {
        id: 'iron_famine',
        name: 'The Iron Famine',
        minCities: 2,
        minDay: 5,
        weight: 12,
        generate: (ctx) => {
          const [buyer, seller] = ctx.pickCities(2);
          const qty = 6 + Math.floor(Math.random() * 5);
          const reward = ctx.scaleGold(250);
          return {
            id: ctx.uid('iron'),
            templateId: 'iron_famine',
            title: `Famine in ${buyer.name}`,
            description: `${buyer.name}'s forges have run dry. They need ${qty} Iron urgently. ${seller.name} has stockpiles — but at what price?`,
            patron: buyer.name,
            stages: [
              {
                id: 'buy_iron',
                type: 'acquire_items',
                description: `Acquire ${qty} Iron from any source.`,
                item: 'Iron',
                itemQty: qty,
                complete: false,
              },
              {
                id: 'deliver_iron',
                type: 'deliver',
                description: `Deliver ${qty} Iron to ${buyer.name}.`,
                targetCity: buyer.name,
                item: 'Iron',
                itemQty: qty,
                complete: false,
              },
            ],
            currentStage: 0,
            reward: { gold: reward, xp: 60, reputation: { city: buyer.name, amount: 8 } },
            bonusReward: null,
            startDay: ctx.day,
            deadline: ctx.day + 20,
            failed: false,
            completed: false,
          };
        },
      },

      // ── The Smuggler's Gambit ──
      {
        id: 'smuggler_gambit',
        name: "The Smuggler's Gambit",
        minCities: 3,
        minDay: 8,
        weight: 8,
        generate: (ctx) => {
          const [contact, pickup, drop] = ctx.pickCities(3);
          const reward = ctx.scaleGold(400);
          return {
            id: ctx.uid('smug'),
            templateId: 'smuggler_gambit',
            title: `Whispers in ${contact.name}`,
            description: `A shadowy contact in ${contact.name} offers a lucrative smuggling run. Pick up contraband in ${pickup.name}, deliver to ${drop.name}. Don't get caught.`,
            patron: contact.name,
            stages: [
              {
                id: 'meet_contact',
                type: 'visit_city',
                description: `Meet the contact in ${contact.name}.`,
                targetCity: contact.name,
                complete: false,
              },
              {
                id: 'pickup_goods',
                type: 'visit_city',
                description: `Pick up the smuggled goods in ${pickup.name}.`,
                targetCity: pickup.name,
                item: 'SmuggledGems',
                itemQty: 1,
                grantItems: true,
                complete: false,
              },
              {
                id: 'deliver_contraband',
                type: 'deliver',
                description: `Deliver the contraband to ${drop.name} without being inspected.`,
                targetCity: drop.name,
                item: 'SmuggledGems',
                itemQty: 1,
                complete: false,
              },
            ],
            currentStage: 0,
            reward: { gold: reward, xp: 100, reputation: { city: drop.name, amount: -3 } },
            bonusReward: null,
            startDay: ctx.day,
            deadline: ctx.day + 15,
            failed: false,
            completed: false,
          };
        },
      },

      // ── The Lost Expedition ──
      {
        id: 'lost_expedition',
        name: 'The Lost Expedition',
        minCities: 2,
        minDay: 10,
        weight: 7,
        generate: (ctx) => {
          const [patron, destination] = ctx.pickCities(2);
          const surveyPoints = ctx.pickLandTiles(3);
          const reward = ctx.scaleGold(350);
          return {
            id: ctx.uid('exped'),
            templateId: 'lost_expedition',
            title: `Lost Expedition of ${patron.name}`,
            description: `An expedition from ${patron.name} went missing near uncharted territory. Search the wilderness, then report to ${destination.name}.`,
            patron: patron.name,
            stages: [
              {
                id: 'search_area',
                type: 'survey',
                description: `Search ${surveyPoints.length} locations for signs of the expedition.`,
                surveyPoints: surveyPoints,
                surveyVisited: surveyPoints.map(() => false),
                complete: false,
              },
              {
                id: 'report_findings',
                type: 'visit_city',
                description: `Report your findings to ${destination.name}.`,
                targetCity: destination.name,
                complete: false,
              },
            ],
            currentStage: 0,
            reward: { gold: reward, xp: 70, reputation: { city: patron.name, amount: 12 } },
            bonusReward: { item: 'TreasureHunter' },
            startDay: ctx.day,
            deadline: ctx.day + 25,
            failed: false,
            completed: false,
          };
        },
      },

      // ── The Trade War ──
      {
        id: 'trade_war',
        name: 'The Trade War',
        minCities: 3,
        minDay: 12,
        weight: 9,
        generate: (ctx) => {
          const [city1, city2, neutral] = ctx.pickCities(3);
          const goods = ['Silk', 'Spices', 'Wine'];
          const good = goods[Math.floor(Math.random() * goods.length)];
          const qty = 3 + Math.floor(Math.random() * 3);
          const reward = ctx.scaleGold(500);
          return {
            id: ctx.uid('twar'),
            templateId: 'trade_war',
            title: `${city1.name} vs ${city2.name}`,
            description: `${city1.name} and ${city2.name} are locked in a trade embargo. ${neutral.name} wants you to broker peace by delivering luxury goods to both sides.`,
            patron: neutral.name,
            stages: [
              {
                id: 'acquire_luxury',
                type: 'acquire_items',
                description: `Acquire ${qty * 2} ${good} for the peace offering.`,
                item: good,
                itemQty: qty * 2,
                complete: false,
              },
              {
                id: 'deliver_city1',
                type: 'deliver',
                description: `Deliver ${qty} ${good} to ${city1.name} as a peace offering.`,
                targetCity: city1.name,
                item: good,
                itemQty: qty,
                complete: false,
              },
              {
                id: 'deliver_city2',
                type: 'deliver',
                description: `Deliver ${qty} ${good} to ${city2.name} as a peace offering.`,
                targetCity: city2.name,
                item: good,
                itemQty: qty,
                complete: false,
              },
              {
                id: 'return_broker',
                type: 'visit_city',
                description: `Return to ${neutral.name} to confirm the peace.`,
                targetCity: neutral.name,
                complete: false,
              },
            ],
            currentStage: 0,
            reward: { gold: reward, xp: 120, reputation: { city: neutral.name, amount: 15 } },
            bonusReward: { item: 'NegotiationForDummies' },
            startDay: ctx.day,
            deadline: null,
            failed: false,
            completed: false,
          };
        },
      },

      // ── The Pirate's Bounty ──
      {
        id: 'pirate_bounty',
        name: "The Pirate's Bounty",
        minCities: 2,
        minDay: 7,
        weight: 10,
        generate: (ctx) => {
          const [port, hideout] = ctx.pickCities(2);
          const reward = ctx.scaleGold(350);
          return {
            id: ctx.uid('pirate'),
            templateId: 'pirate_bounty',
            title: `Terror of ${port.name}`,
            description: `Pirates have been raiding ships near ${port.name}. Track them to ${hideout.name}'s waters and defeat their captain.`,
            patron: port.name,
            stages: [
              {
                id: 'gather_intel',
                type: 'visit_city',
                description: `Gather intelligence about the pirates in ${port.name}.`,
                targetCity: port.name,
                complete: false,
              },
              {
                id: 'sail_to_hideout',
                type: 'visit_city',
                description: `Sail to ${hideout.name} to confront the pirate captain.`,
                targetCity: hideout.name,
                triggerCombat: true,
                combatStrength: 4 + Math.floor(Math.random() * 3),
                complete: false,
              },
              {
                id: 'claim_bounty',
                type: 'visit_city',
                description: `Return to ${port.name} to claim your bounty.`,
                targetCity: port.name,
                complete: false,
              },
            ],
            currentStage: 0,
            reward: { gold: reward, xp: 90, reputation: { city: port.name, amount: 12 } },
            bonusReward: null,
            startDay: ctx.day,
            deadline: ctx.day + 20,
            failed: false,
            completed: false,
          };
        },
      },

      // ── The Cartographer's Dream ──
      {
        id: 'cartographer',
        name: "The Cartographer's Dream",
        minCities: 2,
        minDay: 6,
        weight: 8,
        generate: (ctx) => {
          const [patron, finalCity] = ctx.pickCities(2);
          const points = ctx.pickLandTiles(5);
          const reward = ctx.scaleGold(280);
          return {
            id: ctx.uid('carto'),
            templateId: 'cartographer',
            title: `Mapping the Unknown`,
            description: `A cartographer in ${patron.name} needs 5 uncharted locations surveyed for a definitive world atlas.`,
            patron: patron.name,
            stages: [
              {
                id: 'survey_lands',
                type: 'survey',
                description: `Survey all ${points.length} uncharted locations.`,
                surveyPoints: points,
                surveyVisited: points.map(() => false),
                complete: false,
              },
              {
                id: 'deliver_maps',
                type: 'visit_city',
                description: `Deliver the completed maps to ${finalCity.name}.`,
                targetCity: finalCity.name,
                complete: false,
              },
            ],
            currentStage: 0,
            reward: { gold: reward, xp: 60, reputation: { city: patron.name, amount: 8 } },
            bonusReward: null,
            startDay: ctx.day,
            deadline: ctx.day + 30,
            failed: false,
            completed: false,
          };
        },
      },

      // ── The Merchant Prince ──
      {
        id: 'merchant_prince',
        name: 'The Merchant Prince',
        minCities: 4,
        minDay: 15,
        weight: 5,
        generate: (ctx) => {
          const allCities = ctx.pickCities(4);
          const patron = allCities[0];
          const targets = allCities.slice(1);
          const reward = ctx.scaleGold(800);
          return {
            id: ctx.uid('prince'),
            templateId: 'merchant_prince',
            title: `Rise of the Merchant Prince`,
            description: `The guild in ${patron.name} challenges you: establish trade dominance by delivering luxury goods to three cities, then return to claim your title.`,
            patron: patron.name,
            stages: [
              {
                id: 'silk_run',
                type: 'deliver',
                description: `Deliver 3 Silk to ${targets[0].name}.`,
                targetCity: targets[0].name,
                item: 'Silk',
                itemQty: 3,
                complete: false,
              },
              {
                id: 'spice_run',
                type: 'deliver',
                description: `Deliver 3 Spices to ${targets[1].name}.`,
                targetCity: targets[1].name,
                item: 'Spices',
                itemQty: 3,
                complete: false,
              },
              {
                id: 'wine_run',
                type: 'deliver',
                description: `Deliver 3 Wine to ${targets[2].name}.`,
                targetCity: targets[2].name,
                item: 'Wine',
                itemQty: 3,
                complete: false,
              },
              {
                id: 'claim_title',
                type: 'visit_city',
                description: `Return to ${patron.name} to claim the title of Merchant Prince.`,
                targetCity: patron.name,
                complete: false,
              },
            ],
            currentStage: 0,
            reward: { gold: reward, xp: 200, reputation: { city: patron.name, amount: 20 } },
            bonusReward: { item: 'NegotiationForDummies' },
            startDay: ctx.day,
            deadline: null,
            failed: false,
            completed: false,
          };
        },
      },

      // ── Alien Artifacts ── (space quest, requires space access)
      {
        id: 'alien_artifacts',
        name: 'Alien Artifacts',
        minCities: 2,
        minDay: 20,
        weight: 4,
        requiresSpace: true,
        generate: (ctx) => {
          const [patron, dropoff] = ctx.pickCities(2);
          const reward = ctx.scaleGold(600);
          return {
            id: ctx.uid('alien'),
            templateId: 'alien_artifacts',
            title: `Relics of the Vanta Rift`,
            description: `Researchers in ${patron.name} have detected alien artifact signals. Travel to space, acquire relics, and return them for study.`,
            patron: patron.name,
            stages: [
              {
                id: 'briefing',
                type: 'visit_city',
                description: `Get briefed by researchers in ${patron.name}.`,
                targetCity: patron.name,
                complete: false,
              },
              {
                id: 'acquire_relics',
                type: 'acquire_items',
                description: `Acquire 2 Alien Relics from space trade or exploration.`,
                item: 'AlienRelic',
                itemQty: 2,
                complete: false,
              },
              {
                id: 'deliver_relics',
                type: 'deliver',
                description: `Deliver the relics to ${dropoff.name} for study.`,
                targetCity: dropoff.name,
                item: 'AlienRelic',
                itemQty: 2,
                complete: false,
              },
            ],
            currentStage: 0,
            reward: { gold: reward, xp: 150, reputation: { city: patron.name, amount: 15 } },
            bonusReward: { item: 'TreasureHunter' },
            startDay: ctx.day,
            deadline: null,
            failed: false,
            completed: false,
          };
        },
      },

      // ── The Healer's Plea ──
      {
        id: 'healers_plea',
        name: "The Healer's Plea",
        minCities: 2,
        minDay: 4,
        weight: 11,
        generate: (ctx) => {
          const [sick, herbCity] = ctx.pickCities(2);
          const herbQty = 4 + Math.floor(Math.random() * 3);
          const reward = ctx.scaleGold(200);
          return {
            id: ctx.uid('healer'),
            templateId: 'healers_plea',
            title: `Plague in ${sick.name}`,
            description: `A sickness spreads through ${sick.name}. The healer needs ${herbQty} Herbs to brew a cure. ${herbCity.name}'s forests may have what you need.`,
            patron: sick.name,
            stages: [
              {
                id: 'gather_herbs',
                type: 'acquire_items',
                description: `Gather ${herbQty} Herbs.`,
                item: 'Herbs',
                itemQty: herbQty,
                complete: false,
              },
              {
                id: 'deliver_cure',
                type: 'deliver',
                description: `Deliver ${herbQty} Herbs to the healer in ${sick.name}.`,
                targetCity: sick.name,
                item: 'Herbs',
                itemQty: herbQty,
                complete: false,
              },
            ],
            currentStage: 0,
            reward: { gold: reward, xp: 50, reputation: { city: sick.name, amount: 15 } },
            bonusReward: null,
            startDay: ctx.day,
            deadline: ctx.day + 12,
            failed: false,
            completed: false,
          };
        },
      },
    ];
  }

  // ─── Context builder for template generation ──────────────

  _buildGenContext() {
    const cityList = typeof cities !== 'undefined' ? cities : [];
    const day = typeof dayNight !== 'undefined' ? dayNight.getDaysElapsed() : 0;
    const goldTarget = window._newGameGoldTarget || 5000;
    const playerGold = typeof player !== 'undefined' ? player.gold : 100;
    const goldProgress = playerGold / (goldTarget * 0.35);
    const dayProgress = day / 40;
    const scale = Math.min(4.0, Math.max(1, 1 + Math.max(goldProgress, dayProgress) * 1.5));

    return {
      day,
      scale,
      cityList,
      pickCities: (n) => {
        const shuffled = cityList.slice().sort(() => Math.random() - 0.5);
        return shuffled.slice(0, Math.min(n, shuffled.length));
      },
      pickLandTiles: (n) => {
        const points = [];
        const maxCols = typeof cols !== 'undefined' ? cols : 100;
        const maxRows = typeof rows !== 'undefined' ? rows : 100;
        for (let i = 0; i < n; i++) {
          let tx, ty, attempts = 0;
          do {
            tx = Math.floor(Math.random() * maxCols);
            ty = Math.floor(Math.random() * maxRows);
            attempts++;
          } while (attempts < 200 && (typeof grid === 'undefined' || !grid[ty]?.[tx] || grid[ty][tx].options[0] === 'Water'));
          if (typeof grid !== 'undefined' && grid[ty]?.[tx]?.options[0] !== 'Water') {
            points.push({ x: tx, y: ty });
          }
        }
        return points;
      },
      scaleGold: (base) => Math.floor(base * Math.min(3, scale)),
      uid: (prefix) => `quest_${prefix}_${day}_${Math.random().toString(36).slice(2, 7)}`,
    };
  }

  // ─── Quest Offer Generation ───────────────────────────────

  /** Try to generate a quest offer. Called on day tick or city visit. */
  tryGenerateOffer() {
    if (this.pendingOffer) return null;
    if (this.active.length >= this.maxActive) return null;

    const day = typeof dayNight !== 'undefined' ? dayNight.getDaysElapsed() : 0;
    if (day - this._lastOfferDay < this.offerCooldownDays) return null;

    const cityList = typeof cities !== 'undefined' ? cities : [];
    const ctx = this._buildGenContext();

    // Filter eligible templates
    const eligible = this.templates.filter(t => {
      if (t.minDay > day) return false;
      if (t.minCities > cityList.length) return false;
      if (t.requiresSpace) {
        const hasSpace = typeof player !== 'undefined' && player.spaceTravel?.visitedPlanets?.length > 0;
        if (!hasSpace) return false;
      }
      // Don't repeat recently completed quest types
      const recentIds = this.completed.slice(-5).map(q => q.templateId);
      if (recentIds.includes(t.id)) return false;
      // Don't offer same type as active
      if (this.active.some(q => q.templateId === t.id)) return false;
      return true;
    });

    if (eligible.length === 0) return null;

    // Weighted random selection
    const totalWeight = eligible.reduce((sum, t) => sum + (t.weight || 1), 0);
    let roll = Math.random() * totalWeight;
    let chosen = eligible[0];
    for (const t of eligible) {
      roll -= (t.weight || 1);
      if (roll <= 0) { chosen = t; break; }
    }

    const quest = chosen.generate(ctx);
    this.pendingOffer = quest;
    this._lastOfferDay = day;
    return quest;
  }

  /** Player accepts the pending offer */
  acceptOffer() {
    if (!this.pendingOffer) return false;
    if (this.active.length >= this.maxActive) return false;
    this.active.push(this.pendingOffer);
    if (typeof notificationManager !== 'undefined') {
      notificationManager.log(`Quest accepted: "${this.pendingOffer.title}"`, 'success');
    }
    this.pendingOffer = null;
    return true;
  }

  /** Player declines the pending offer */
  declineOffer() {
    this.pendingOffer = null;
  }

  /** Abandon an active quest */
  abandonQuest(quest) {
    const idx = this.active.indexOf(quest);
    if (idx < 0) return false;
    this.active.splice(idx, 1);
    if (typeof notificationManager !== 'undefined') {
      notificationManager.log(`Quest abandoned: "${quest.title}"`, 'warning');
    }
    // Reputation penalty at patron city
    if (typeof cities !== 'undefined') {
      const city = cities.find(c => c.name === quest.patron);
      if (city && city.adjustReputation) city.adjustReputation(-5);
    }
    return true;
  }

  // ─── Stage Completion Logic ───────────────────────────────

  /** Check all active quests for stage progression. Called frequently. */
  checkProgress() {
    if (typeof player === 'undefined') return;
    const day = typeof dayNight !== 'undefined' ? dayNight.getDaysElapsed() : 0;

    for (let qi = this.active.length - 1; qi >= 0; qi--) {
      const quest = this.active[qi];

      // Check deadline
      if (quest.deadline && day > quest.deadline) {
        this._failQuest(quest, qi);
        continue;
      }

      // Process current stage
      const stage = quest.stages[quest.currentStage];
      if (!stage || stage.complete) {
        // Advance to next incomplete stage
        this._advanceStage(quest);
        continue;
      }

      const completed = this._checkStage(quest, stage);
      if (completed) {
        stage.complete = true;
        if (typeof notificationManager !== 'undefined') {
          notificationManager.log(`Quest progress: "${quest.title}" — ${stage.description} ✓`, 'success');
        }
        this._advanceStage(quest);
      }
    }
  }

  _checkStage(quest, stage) {
    switch (stage.type) {
      case 'visit_city':
        if (player.currentCity?.name === stage.targetCity) {
          // Grant items if stage says so
          if (stage.grantItems && stage.item && stage.itemQty) {
            player.addItem({ name: stage.item, quantity: stage.itemQty }, true);
            if (typeof notificationManager !== 'undefined') {
              notificationManager.log(`Received ${stage.itemQty} ${stage.item}.`, 'info');
            }
          }
          // Trigger combat if specified
          if (stage.triggerCombat && typeof combatSystem !== 'undefined' && typeof Raider !== 'undefined') {
            const str = stage.combatStrength || 4;
            const raider = new Raider({
              x: player.x, y: player.y,
              strength: str,
              patrolPoints: [],
            });
            raider.loot.gold = 30 + Math.floor(Math.random() * 50);
            combatSystem.startCombat(raider);
          }
          return true;
        }
        return false;

      case 'deliver':
        if (player.currentCity?.name === stage.targetCity) {
          const entry = player.inventory.get(stage.item);
          if (entry && entry.quantity >= stage.itemQty) {
            // Remove delivered items
            for (let i = 0; i < stage.itemQty; i++) {
              player.removeItem({ name: stage.item });
            }
            // Add items to city inventory
            if (typeof cities !== 'undefined') {
              const destCity = cities.find(c => c.name === stage.targetCity);
              if (destCity && ItemLibrary[stage.item]) {
                const ce = destCity.inventory.get(stage.item);
                if (ce) ce.quantity += stage.itemQty;
                else destCity.inventory.set(stage.item, { item: ItemLibrary[stage.item], quantity: stage.itemQty });
              }
            }
            return true;
          }
        }
        return false;

      case 'acquire_items': {
        const entry = player.inventory.get(stage.item);
        return entry && entry.quantity >= stage.itemQty;
      }

      case 'survey':
        if (stage.surveyPoints) {
          for (let j = 0; j < stage.surveyPoints.length; j++) {
            if (!stage.surveyVisited[j]) {
              const sp = stage.surveyPoints[j];
              if (Math.abs(player.x - sp.x) <= 2 && Math.abs(player.y - sp.y) <= 2) {
                stage.surveyVisited[j] = true;
                if (typeof notificationManager !== 'undefined') {
                  notificationManager.log(`Survey point ${j + 1}/${stage.surveyPoints.length} discovered!`, 'success');
                }
              }
            }
          }
          return stage.surveyVisited.every(v => v);
        }
        return false;

      case 'reputation_check': {
        if (typeof cities === 'undefined') return false;
        const city = cities.find(c => c.name === stage.targetCity);
        return city && city.reputation >= (stage.requiredRep || 60);
      }

      default:
        return false;
    }
  }

  _advanceStage(quest) {
    // Find next incomplete stage
    let next = -1;
    for (let i = 0; i < quest.stages.length; i++) {
      if (!quest.stages[i].complete) { next = i; break; }
    }

    if (next >= 0) {
      quest.currentStage = next;
    } else {
      // All stages done — quest complete!
      this._completeQuest(quest);
    }
  }

  _completeQuest(quest) {
    const idx = this.active.indexOf(quest);
    if (idx >= 0) this.active.splice(idx, 1);

    quest.completed = true;
    this.completed.push(quest);
    if (this.completed.length > 30) this.completed.shift();

    // Award rewards
    if (quest.reward) {
      if (quest.reward.gold) player.earnGold(quest.reward.gold);
      if (quest.reward.xp) player.gainXP(quest.reward.xp);
      if (quest.reward.reputation && typeof cities !== 'undefined') {
        const city = cities.find(c => c.name === quest.reward.reputation.city);
        if (city && city.adjustReputation) {
          city.adjustReputation(quest.reward.reputation.amount);
        }
      }
    }

    // Bonus reward (unique items for special quests)
    if (quest.bonusReward?.item) {
      if (!player.inventory.has(quest.bonusReward.item)) {
        player.addItem({ name: quest.bonusReward.item, quantity: 1 }, true);
        if (typeof notificationManager !== 'undefined') {
          notificationManager.log(`Bonus reward: ${ItemLibrary[quest.bonusReward.item]?.name || quest.bonusReward.item}!`, 'success');
        }
      }
    }

    if (typeof notificationManager !== 'undefined') {
      notificationManager.log(`Quest complete: "${quest.title}" — ${quest.reward.gold}g earned!`, 'success');
    }

    // Dispatch event for achievement tracking
    window.dispatchEvent(new CustomEvent('questCompleted', { detail: { quest } }));
  }

  _failQuest(quest, index) {
    this.active.splice(index, 1);
    quest.failed = true;

    if (typeof cities !== 'undefined') {
      const city = cities.find(c => c.name === quest.patron);
      if (city && city.adjustReputation) city.adjustReputation(-8);
    }

    if (typeof notificationManager !== 'undefined') {
      notificationManager.log(`Quest failed: "${quest.title}" — deadline expired!`, 'error');
    }
  }

  // ─── Daily Tick ───────────────────────────────────────────

  _onDayTick() {
    this.checkProgress();

    // Chance to offer a new quest when visiting a city
    if (typeof player !== 'undefined' && player.currentCity && !this.pendingOffer) {
      if (Math.random() < 0.25) { // 25% daily chance while in a city
        this.tryGenerateOffer();
      }
    }
  }

  // ─── Serialization ────────────────────────────────────────

  toJSON() {
    return {
      active: this.active,
      completed: this.completed.slice(-30),
      lastOfferDay: this._lastOfferDay,
      pendingOffer: this.pendingOffer,
    };
  }

  static fromJSON(data) {
    const qs = new QuestSystem();
    qs.active = data.active || [];
    qs.completed = data.completed || [];
    qs._lastOfferDay = data.lastOfferDay || -999;
    qs.pendingOffer = data.pendingOffer || null;
    return qs;
  }

  /** Get summary for UI display */
  getActiveQuestSummaries() {
    return this.active.map(q => ({
      id: q.id,
      title: q.title,
      description: q.description,
      patron: q.patron,
      currentStage: q.currentStage,
      totalStages: q.stages.length,
      stageDescription: q.stages[q.currentStage]?.description || 'Complete!',
      reward: q.reward,
      deadline: q.deadline,
      startDay: q.startDay,
    }));
  }
}
