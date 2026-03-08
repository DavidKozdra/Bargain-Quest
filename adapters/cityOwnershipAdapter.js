(function initCityOwnershipAdapter(root, factory) {
  const api = factory(root);

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.BQLib = root.BQLib || {};
    root.BQLib.adapters = root.BQLib.adapters || {};
    root.BQLib.adapters.bargainQuest = root.BQLib.adapters.bargainQuest || {};
    root.BQLib.adapters.bargainQuest.cityOwnership = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createCityOwnershipAdapter(root) {
  function _staged() {
    return root?.BQLib?.progression?.stagedAcquisition || null;
  }

  function getOwnershipStageCosts(input) {
    const staged = _staged();
    if (staged && typeof staged.computeStageCosts === "function") {
      return staged.computeStageCosts({
        baseValue: Number(input && input.marketValue) || 0,
        baseFloor: 300,
        stages: [
          { key: "bank", ratio: 0.20, min: 200, max: 20000 },
          { key: "buildings", ratio: 0.35, min: 350 },
          { key: "shop", ratio: 0.45, min: 500, max: 15000 },
        ],
      });
    }

    const base = Math.max(300, Math.floor(Number(input && input.marketValue) || 0));
    return {
      bank: Math.min(20000, Math.max(200, Math.floor(base * 0.20))),
      buildings: Math.max(350, Math.floor(base * 0.35)),
      shop: Math.min(15000, Math.max(500, Math.floor(base * 0.45))),
    };
  }

  function getOwnershipAcquisitionState(input) {
    const deal = (input && input.deal) || { ownerName: "City Council", offerAccepted: false, purchased: {} };
    const isOwned = !!(input && input.isOwned);
    const staged = _staged();

    let stepKey = "offer";
    let progressCount = 0;
    const ordered = ["offer", "bank", "buildings", "shop"];
    if (staged && typeof staged.resolveCurrentStage === "function") {
      const completedKeys = [];
      if (deal.offerAccepted) completedKeys.push("offer");
      if (deal.purchased && deal.purchased.bank) completedKeys.push("bank");
      if (deal.purchased && deal.purchased.buildings) completedKeys.push("buildings");
      if (deal.purchased && deal.purchased.shop) completedKeys.push("shop");
      const resolved = staged.resolveCurrentStage({
        stages: ordered,
        completedKeys,
        forceComplete: isOwned || (deal.purchased && deal.purchased.shop),
      });
      stepKey = resolved.key;
      progressCount = resolved.completedCount;
    } else {
      if (deal.offerAccepted) stepKey = "bank";
      if (deal.purchased && deal.purchased.bank) stepKey = "buildings";
      if (deal.purchased && deal.purchased.buildings) stepKey = "shop";
      if ((deal.purchased && deal.purchased.shop) || isOwned) stepKey = "complete";
      progressCount = (deal.offerAccepted ? 1 : 0)
        + ((deal.purchased && deal.purchased.bank) ? 1 : 0)
        + ((deal.purchased && deal.purchased.buildings) ? 1 : 0)
        + ((deal.purchased && deal.purchased.shop) ? 1 : 0);
    }

    const reputation = Math.round(Number(input && input.reputation) || 50);
    const charm = Math.round(Number(input && input.charm) || 0);
    const hasNegotiationBonus = !!(input && input.hasNegotiationBonus);
    const offerRequirement = Math.max(35, 55 - Math.floor((reputation - 50) / 2));
    const offerScore = reputation + (charm * 5) + (hasNegotiationBonus ? 5 : 0);
    const costs = getOwnershipStageCosts({ marketValue: Number(input && input.marketValue) || 0 });
    const labels = {
      offer: "Convince Owner",
      bank: "Buy City Bank",
      buildings: "Buy Buildings",
      shop: "Buy Main Shop",
    };

    return {
      isOwned,
      ownerName: deal.ownerName || "City Council",
      stepKey,
      stepLabel: labels[stepKey] || "Complete",
      cost: (stepKey === "bank" || stepKey === "buildings" || stepKey === "shop") ? costs[stepKey] : 0,
      progressCount,
      progressTotal: 4,
      offerRequirement,
      offerScore,
      canOfferNow: offerScore >= offerRequirement,
    };
  }

  return {
    getOwnershipStageCosts,
    getOwnershipAcquisitionState,
  };
});
