// DiplomacySystem.js — Inter-city relations, pacts, gifts, and embargoes
// Stored on cityManagement.diplomacy = { relations: { cityName: {...} } }

class DiplomacySystem {
  static PACTS = {
    trade_pact:  { name: "Trade Pact",  emoji: "🤝", atlasFrame: "Friendly", desc: "Reduced tariffs, +15% route income with this city.", duration: 30 },
    alliance:    { name: "Alliance",    emoji: "🛡️", atlasFrame: "Shield",   desc: "Shared defense. Allied cities help fight raiders.", duration: 50 },
    rivalry:     { name: "Rivalry",     emoji: "⚔️", atlasFrame: "Sword",    desc: "Price war. Both cities suffer trade penalties.", duration: 20 },
    embargo:     { name: "Embargo",     emoji: "🚫", atlasFrame: "Hostile",  desc: "Block all trade routes with this city.", duration: 15 },
  };

  static RELATION_TIERS = [
    { min: 60,   label: "Allied",    emoji: "💚", atlasFrame: "Love",     color: "#4caf50" },
    { min: 25,   label: "Friendly",  emoji: "🙂", atlasFrame: "Friendly", color: "#8bc34a" },
    { min: -25,  label: "Neutral",   emoji: "🤷", atlasFrame: "Neutral",  color: "#90a4ae" },
    { min: -60,  label: "Hostile",   emoji: "😠", atlasFrame: "Hostile",  color: "#ff9800" },
    { min: -101, label: "Enemy",     emoji: "💀", atlasFrame: "Hate",     color: "#f44336" },
  ];

  constructor() {
    this.relations = {}; // { cityName: { score, pacts: { pactKey: expiresDay }, lastGiftDay } }
  }

  _ensure(cityName) {
    if (!this.relations[cityName]) {
      this.relations[cityName] = { score: 15, pacts: {}, lastGiftDay: -999, lastAIDecisionDay: -999, strategicNote: "" };
    }
    return this.relations[cityName];
  }

  getRelation(cityName) {
    return this._ensure(cityName);
  }

  getScore(cityName) {
    return this._ensure(cityName).score;
  }

  adjustScore(cityName, delta) {
    const r = this._ensure(cityName);
    r.score = Math.max(-100, Math.min(100, r.score + delta));
    return r.score;
  }

  getTier(cityName) {
    const score = this.getScore(cityName);
    for (const t of DiplomacySystem.RELATION_TIERS) {
      if (score >= t.min) return t;
    }
    return DiplomacySystem.RELATION_TIERS[DiplomacySystem.RELATION_TIERS.length - 1];
  }

  getGiftGain(amount, giftType = "gold") {
    const qty = Math.max(0, Math.floor(Number(amount) || 0));
    if (giftType === "wine") {
      return Math.min(28, 7 + (qty * 3));
    }
    return Math.min(25, Math.floor(qty / 40) + 3);
  }

  /** Send gold gift to improve relations */
  sendGift(cityName, amount, day, options = {}) {
    const r = this._ensure(cityName);
    if (day - r.lastGiftDay < 3) return { ok: false, msg: "Must wait 3 days between gifts." };
    const giftType = options.giftType === "wine" ? "wine" : "gold";
    const qty = Math.max(0, Math.floor(Number(amount) || 0));
    const gain = this.getGiftGain(qty, giftType);
    if (qty <= 0 || gain <= 0) {
      return { ok: false, msg: "Gift amount must be positive." };
    }
    this.adjustScore(cityName, gain);
    r.lastGiftDay = day;
    if (giftType === "wine") {
      return { ok: true, msg: `Sent ${qty} Wine to ${cityName}. Relations +${gain}.` };
    }
    return { ok: true, msg: `Sent ${qty}g gift to ${cityName}. Relations +${gain}.` };
  }

  sendWineGift(cityName, amount, day) {
    return this.sendGift(cityName, amount, day, { giftType: "wine" });
  }

  /** Propose a pact */
  proposePact(cityName, pactKey, day) {
    const def = DiplomacySystem.PACTS[pactKey];
    if (!def) return { ok: false, msg: "Unknown pact type." };
    const r = this._ensure(cityName);
    if (r.pacts[pactKey]) return { ok: false, msg: `${def.name} already active with ${cityName}.` };

    // Check if relations are good enough
    if (pactKey === "trade_pact" && r.score < 10) return { ok: false, msg: "Need Friendly relations (10+) for a trade pact." };
    if (pactKey === "alliance" && r.score < 40) return { ok: false, msg: "Need strong relations (40+) for an alliance." };

    // Rivalry/embargo always works
    if (pactKey === "rivalry" || pactKey === "embargo") {
      // Cancel positive pacts
      delete r.pacts.trade_pact;
      delete r.pacts.alliance;
      this.adjustScore(cityName, -15);
    }

    r.pacts[pactKey] = day + def.duration;
    return { ok: true, msg: `${def.name} established with ${cityName} for ${def.duration} days.` };
  }

  cancelPact(cityName, pactKey) {
    const r = this._ensure(cityName);
    if (!r.pacts[pactKey]) return false;
    delete r.pacts[pactKey];
    // Breaking a positive pact hurts relations
    if (pactKey === "trade_pact" || pactKey === "alliance") {
      this.adjustScore(cityName, -10);
    }
    return true;
  }

  hasPact(cityName, pactKey) {
    return !!(this._ensure(cityName).pacts[pactKey]);
  }

  canAIDecide(cityName, day, cooldownDays = 4) {
    const r = this._ensure(cityName);
    return (Number(day) || 0) - (Number(r.lastAIDecisionDay) || -999) >= Math.max(1, Number(cooldownDays) || 4);
  }

  markAIDecision(cityName, day, note = "") {
    const r = this._ensure(cityName);
    r.lastAIDecisionDay = Number(day) || 0;
    r.strategicNote = typeof note === "string" ? note : "";
    return r.lastAIDecisionDay;
  }

  getStrategicNote(cityName) {
    return this._ensure(cityName).strategicNote || "";
  }

  getActivePacts(cityName) {
    const r = this._ensure(cityName);
    const out = [];
    for (const [k, expires] of Object.entries(r.pacts)) {
      if (DiplomacySystem.PACTS[k]) out.push({ key: k, ...DiplomacySystem.PACTS[k], expires });
    }
    return out;
  }

  /** Trade route income modifier for a given destination city */
  getRouteIncomeMod(destCityName) {
    let mod = 1.0;
    if (this.hasPact(destCityName, "trade_pact")) mod += 0.15;
    if (this.hasPact(destCityName, "embargo")) mod = 0; // blocked
    if (this.hasPact(destCityName, "rivalry")) mod *= 0.70;
    return mod;
  }

  /** Is trade blocked with this city? */
  isEmbargoed(cityName) {
    return this.hasPact(cityName, "embargo");
  }

  /** Daily tick: decay relations toward 0, expire pacts */
  processDaily(day) {
    for (const [name, r] of Object.entries(this.relations)) {
      // Drift toward 0 by 0.3/day
      if (r.score > 0) r.score = Math.max(0, r.score - 0.3);
      else if (r.score < 0) r.score = Math.min(0, r.score + 0.3);

      // Expire pacts
      for (const [pk, expires] of Object.entries(r.pacts)) {
        if (day >= expires) {
          delete r.pacts[pk];
        }
      }

      // Alliance passive relation boost
      if (r.pacts.alliance) r.score = Math.min(100, r.score + 0.2);
      // Rivalry passive drain
      if (r.pacts.rivalry) r.score = Math.max(-100, r.score - 0.2);
    }
  }

  /** Insult: declare rivalry, lower relations sharply */
  insult(cityName, day) {
    this.adjustScore(cityName, -20);
    return this.proposePact(cityName, "rivalry", day);
  }

  toJSON() {
    const out = {};
    for (const [name, r] of Object.entries(this.relations)) {
      out[name] = {
        score: r.score,
        pacts: { ...r.pacts },
        lastGiftDay: r.lastGiftDay,
        lastAIDecisionDay: Number(r.lastAIDecisionDay) || -999,
        strategicNote: typeof r.strategicNote === "string" ? r.strategicNote : "",
      };
    }
    return out;
  }

  static fromJSON(data) {
    const d = new DiplomacySystem();
    if (data && typeof data === "object") {
      for (const [name, r] of Object.entries(data)) {
        d.relations[name] = {
          score: Number(r.score) || 0,
          pacts: (r.pacts && typeof r.pacts === "object") ? { ...r.pacts } : {},
          lastGiftDay: Number(r.lastGiftDay) || -999,
          lastAIDecisionDay: Number(r.lastAIDecisionDay) || -999,
          strategicNote: typeof r.strategicNote === "string" ? r.strategicNote : "",
        };
      }
    }
    return d;
  }
}

window.DiplomacySystem = DiplomacySystem;
