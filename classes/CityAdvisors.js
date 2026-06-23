// CityAdvisors.js — 3 advisor NPCs that unlock as city grows, each with mini-quests
// Stored on cityManagement.advisors (instance)

class CityAdvisors {
  static ADVISOR_DEFS = {
    trade: {
      name: "Merchant Vizier",
      emoji: "\uD83D\uDCBC",
      atlasFrame: "trader",
      unlockPop: 150,
      desc: "Expert in commerce and market trends.",
      tipPool: [
        "Buy low in one city, sell high in another. Price spreads are your profit.",
        "Trade pacts with allied cities boost route income by 15%.",
        "Seasonal demand shifts can double your margins if timed right.",
        "Keep an eye on city inventories — surplus items crash local prices.",
      ],
    },
    military: {
      name: "War Marshal",
      emoji: "\u2694\uFE0F",
      atlasFrame: "Sword",
      unlockPop: 300,
      desc: "Veteran commander. Handles defense strategy.",
      tipPool: [
        "Walls and garrisons deter raiders. Invest early.",
        "Conscription policy halves unit costs but hurts morale.",
        "Alliance pacts share defense — your allies will fight for you.",
        "Counter-espionage protects against sabotage. Worth the spy cost.",
      ],
    },
    people: {
      name: "People's Voice",
      emoji: "\uD83C\uDFDB\uFE0F",
      atlasFrame: "Shield",
      unlockPop: 200,
      desc: "Advocate for the citizens. Manages happiness and growth.",
      tipPool: [
        "Food supply is your lifeline. Stockpile before winter.",
        "Cultural Funding policy is expensive but keeps riots away.",
        "Happiness above 80 triggers natural population growth.",
        "Subsidized Food saves 30% consumption. Great for large cities.",
      ],
    },
  };

  static QUEST_TEMPLATES = {
    trade: [
      { text: "The merchants demand a festival! Earn {gold}g in trade route income within {days} days.", gold: 200, days: 12, reward: 150, rewardType: "gold" },
      { text: "Establish a trade pact with any city within {days} days.", goal: "trade_pact", days: 10, reward: 120, rewardType: "gold" },
      { text: "Stock at least {qty} unique items in our market.", qty: 8, days: 15, reward: 180, rewardType: "gold" },
    ],
    military: [
      { text: "Train {qty} military units within {days} days.", qty: 3, days: 10, reward: 200, rewardType: "gold" },
      { text: "Activate Fortify Walls policy for at least {days} days.", goal: "fortifyWalls", days: 5, reward: 150, rewardType: "gold" },
      { text: "Deploy a spy on an intel mission and succeed.", goal: "spy_intel", days: 12, reward: 180, rewardType: "gold" },
    ],
    people: [
      { text: "Raise happiness to {target} or above within {days} days.", target: 75, days: 10, reward: 160, rewardType: "gold" },
      { text: "Grow population to {target} within {days} days.", target: 0, days: 15, reward: 200, rewardType: "gold" }, // target set dynamically
      { text: "Activate Cultural Funding for {days} consecutive days.", goal: "culturalFunding", days: 5, reward: 140, rewardType: "gold" },
    ],
  };

  constructor() {
    this.unlocked = {};      // { trade: true, military: false, ... }
    this.activeQuests = [];  // { advisor, text, deadline, reward, rewardType, progress, completed, goal, ... }
    this._nextQuestId = 1;
    this._lastQuestGenDay = 0;
    this._questGenInterval = 7; // generate advisor quest every 7 days
  }

  /** Check if any advisor should unlock based on population */
  checkUnlocks(city) {
    const unlocked = [];
    for (const [key, def] of Object.entries(CityAdvisors.ADVISOR_DEFS)) {
      if (!this.unlocked[key] && city.population >= def.unlockPop) {
        this.unlocked[key] = true;
        unlocked.push(def);
      }
    }
    return unlocked;
  }

  getUnlockedAdvisors() {
    return Object.entries(CityAdvisors.ADVISOR_DEFS)
      .filter(([k]) => this.unlocked[k])
      .map(([k, def]) => ({ key: k, ...def }));
  }

  isUnlocked(advisorKey) {
    return !!this.unlocked[advisorKey];
  }

  /** Get a random tip from an advisor */
  getTip(advisorKey) {
    const def = CityAdvisors.ADVISOR_DEFS[advisorKey];
    if (!def) return null;
    return def.tipPool[Math.floor(Math.random() * def.tipPool.length)];
  }

  /** Generate new advisor quests */
  generateQuests(day, city) {
    if (day - this._lastQuestGenDay < this._questGenInterval) return [];
    this._lastQuestGenDay = day;

    // Remove completed quests older than 5 days
    this.activeQuests = this.activeQuests.filter(q => !q.completed || (day - q.completedDay < 5));

    const newQuests = [];
    for (const [advisorKey, templates] of Object.entries(CityAdvisors.QUEST_TEMPLATES)) {
      if (!this.unlocked[advisorKey]) continue;
      // Only one active quest per advisor
      if (this.activeQuests.some(q => q.advisor === advisorKey && !q.completed)) continue;

      const template = templates[Math.floor(Math.random() * templates.length)];
      const quest = {
        id: this._nextQuestId++,
        advisor: advisorKey,
        text: template.text
          .replace("{gold}", template.gold || "?")
          .replace("{days}", template.days || "?")
          .replace("{qty}", template.qty || "?")
          .replace("{target}", template.target || Math.floor(city.population * 1.15)),
        deadline: day + (template.days || 10),
        reward: template.reward || 100,
        rewardType: template.rewardType || "gold",
        goal: template.goal || null,
        targetValue: template.target || template.qty || template.gold || 0,
        progress: 0,
        completed: false,
        completedDay: 0,
      };
      // Dynamic population target
      if (template.target === 0 && template.text.includes("population")) {
        quest.targetValue = Math.floor(city.population * 1.15);
        quest.text = quest.text.replace("0", String(quest.targetValue));
      }
      this.activeQuests.push(quest);
      newQuests.push(quest);
    }
    return newQuests;
  }

  /** Check quest progress and auto-complete */
  checkProgress(city, cityMgmt, day) {
    const completed = [];
    for (const q of this.activeQuests) {
      if (q.completed) continue;

      // Expire
      if (day > q.deadline) {
        q.completed = true;
        q.completedDay = day;
        q.failed = true;
        continue;
      }

      let done = false;

      // Goal-based checks
      if (q.goal === "trade_pact" && cityMgmt?.diplomacy) {
        done = Object.values(cityMgmt.diplomacy.relations).some(r => r.pacts?.trade_pact);
      }
      if (q.goal === "fortifyWalls") {
        done = CityPolicies.isActive(city, "fortifyWalls");
      }
      if (q.goal === "culturalFunding") {
        done = CityPolicies.isActive(city, "culturalFunding");
      }
      if (q.goal === "spy_intel" && cityMgmt?.espionage) {
        done = Object.keys(cityMgmt.espionage.intel).length > 0;
      }

      // Value-based checks
      if (q.text.includes("happiness")) {
        const h = cityMgmt?.getHappiness?.(city) || 50;
        done = h >= q.targetValue;
      }
      if (q.text.includes("population") && !q.goal) {
        done = city.population >= q.targetValue;
      }
      if (q.text.includes("military units")) {
        const count = city.management?.units?.length || 0;
        done = count >= q.targetValue;
      }
      if (q.text.includes("unique items")) {
        let unique = 0;
        if (city.inventory) for (const [, v] of city.inventory) { if (v.quantity > 0) unique++; }
        done = unique >= q.targetValue;
      }

      if (done) {
        q.completed = true;
        q.completedDay = day;
        q.failed = false;
        completed.push(q);
      }
    }
    return completed;
  }

  /** Collect rewards for completed quests */
  collectReward(questId, city) {
    const q = this.activeQuests.find(a => a.id === questId);
    if (!q || !q.completed || q.failed || q.collected) return null;
    q.collected = true;
    if (q.rewardType === "gold" && city.management) {
      city.management.budget += q.reward;
    }
    return q;
  }

  toJSON() {
    return {
      unlocked: { ...this.unlocked },
      activeQuests: this.activeQuests.map(q => ({ ...q })),
      _nextQuestId: this._nextQuestId,
      _lastQuestGenDay: this._lastQuestGenDay,
    };
  }

  static fromJSON(data) {
    const a = new CityAdvisors();
    if (!data) return a;
    a.unlocked = (data.unlocked && typeof data.unlocked === "object") ? { ...data.unlocked } : {};
    a.activeQuests = Array.isArray(data.activeQuests) ? data.activeQuests.map(q => ({ ...q })) : [];
    a._nextQuestId = Math.max(1, Number(data._nextQuestId) || 1);
    a._lastQuestGenDay = Number(data._lastQuestGenDay) || 0;
    return a;
  }
}

window.CityAdvisors = CityAdvisors;
