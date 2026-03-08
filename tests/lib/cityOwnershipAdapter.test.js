const staged = require("../../Koz_Engine_Lib/progression/stagedAcquisition");
global.KozEngine = { progression: { stagedAcquisition: staged } };

const {
  getOwnershipStageCosts,
  getOwnershipAcquisitionState,
} = require("../../adapters/cityOwnershipAdapter");

describe("adapters/cityOwnershipAdapter (game-specific)", () => {
  test("keeps Bargain Quest stage caps", () => {
    const costs = getOwnershipStageCosts({ marketValue: 999999999 });
    expect(costs.bank).toBe(20000);
    expect(costs.shop).toBe(15000);
  });

  test("returns offer step and persuasion gate", () => {
    const state = getOwnershipAcquisitionState({
      deal: {
        ownerName: "Lady Marrow",
        offerAccepted: false,
        purchased: { bank: false, buildings: false, shop: false },
      },
      isOwned: false,
      marketValue: 5000,
      reputation: 50,
      charm: 0,
      hasNegotiationBonus: false,
    });
    expect(state.stepKey).toBe("offer");
    expect(state.canOfferNow).toBe(false);
  });
});
