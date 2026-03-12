// BankingSystem.js — Deposits, loans, insurance, investments

class BankingSystem {
  constructor() {
    // Deposit account
    this.balance = 0;
    this.depositInterestRate = 0.01; // 1% weekly

    // Loans
    this.loanAmount = 0;
    this.loanInterestRate = 0.08;    // 8% weekly
    this.loanWeeksUnpaid = 0;
    this.loanDefaulted = false;
    this.maxLoanRatio = 0.30;        // 30% of gold target

    // Investments
    this.investments = [];  // { cityName, amount, startDay, durationDays, returnMul }
    this.maxInvestments = 2;

    // Insurance
    this.insurancePolicy = null; // { premium, cargoValue, dayPurchased, expiresDay }

    this._onDayChanged = () => this.onDayChanged();
    window.addEventListener('dayChanged', this._onDayChanged);
  }

  // Compatibility getters for UI
  get deposits() { return this.balance; }
  get loanWeeks() { return this.loanWeeksUnpaid; }
  get insuranceActive() { return this.insurancePolicy !== null; }
  get insuranceCoverage() { return this.insurancePolicy ? this.insurancePolicy.cargoValue : 0; }
  get insuranceDaysLeft() {
    if (!this.insurancePolicy) return 0;
    const day = typeof dayNight !== 'undefined' ? dayNight.getDaysElapsed() : 0;
    return Math.max(0, this.insurancePolicy.expiresDay - day);
  }

  destroy() {
    window.removeEventListener('dayChanged', this._onDayChanged);
  }

  /** Check if a city has a bank */
  static cityHasBank(city) {
    return city && city.hasBank === true;
  }

  // ─── Deposits ───────────────────────────────────────────

  deposit(amount) {
    if (typeof player === 'undefined') return false;
    // Always keep at least 1g so the player isn't stranded at 0
    const maxAffordable = Math.max(0, player.gold - 1);
    if (amount <= 0 || amount > maxAffordable) {
      if (typeof notificationManager !== 'undefined') {
        const msg = player.gold <= 1 ? "You need to keep at least 1g on hand!" : "Not enough gold to deposit!";
        notificationManager.log(msg, 'warning');
      }
      return false;
    }
    const maxDeposit = (window._newGameGoldTarget || 5000) * 2;
    if (this.balance + amount > maxDeposit) {
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log(`Max deposit is ${maxDeposit}g.`, 'warning');
      }
      return false;
    }
    player.spendGold(amount);
    this.balance += amount;
    if (typeof notificationManager !== 'undefined') {
      notificationManager.log(`Deposited ${amount}g. Balance: ${this.balance}g`, 'success');
    }
    return true;
  }

  withdraw(amount) {
    if (typeof player === 'undefined') return false;
    if (amount <= 0 || amount > this.balance) {
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log('Not enough in your account!', 'warning');
      }
      return false;
    }
    // Must be at a bank city
    if (!this._isAtBank()) {
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log('You must be at a city with a bank to withdraw!', 'warning');
      }
      return false;
    }
    this.balance -= amount;
    player.earnGold(amount);
    if (typeof notificationManager !== 'undefined') {
      notificationManager.log(`Withdrew ${amount}g. Balance: ${this.balance}g`, 'success');
    }
    return true;
  }

  // ─── Loans ──────────────────────────────────────────────

  takeLoan(amount) {
    if (this.loanAmount > 0) {
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log('You already have an outstanding loan! Repay it first.', 'warning');
      }
      return false;
    }
    const maxLoan = Math.floor((window._newGameGoldTarget || 5000) * this.maxLoanRatio);
    if (amount > maxLoan || amount <= 0) {
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log(`Max loan: ${maxLoan}g`, 'warning');
      }
      return false;
    }
    if (!this._isAtBank()) {
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log('You must be at a bank city to take a loan!', 'warning');
      }
      return false;
    }

    this.loanAmount = amount;
    this.loanWeeksUnpaid = 0;
    this.loanDefaulted = false;
    player.earnGold(amount);

    if (typeof notificationManager !== 'undefined') {
      notificationManager.log(`Loan taken: ${amount}g. Repay at any bank. 8% weekly interest!`, 'info');
    }
    return true;
  }

  repayLoan(amount) {
    if (this.loanAmount <= 0) return false;
    if (!this._isAtBank()) {
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log('Visit a bank city to repay your loan!', 'warning');
      }
      return false;
    }
    const repay = Math.min(amount, this.loanAmount, player.gold);
    if (repay <= 0) {
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log('Not enough gold to repay!', 'warning');
      }
      return false;
    }

    player.spendGold(repay);
    this.loanAmount -= repay;

    if (this.loanAmount <= 0) {
      this.loanAmount = 0;
      this.loanWeeksUnpaid = 0;
      // Early repayment bonus
      if (typeof player.currentCity !== 'undefined' && player.currentCity?.adjustReputation) {
        player.currentCity.adjustReputation(5);
      }
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log('Loan fully repaid! +5 reputation at this city.', 'success');
      }
    } else {
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log(`Repaid ${repay}g. Remaining: ${this.loanAmount}g`, 'info');
      }
    }
    return true;
  }

  // ─── Investments ────────────────────────────────────────

  invest(cityName, amount) {
    if (this.investments.length >= this.maxInvestments) {
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log('Max 2 active investments!', 'warning');
      }
      return false;
    }
    if (amount < 50 || amount > 500) {
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log('Investment must be 50-500g.', 'warning');
      }
      return false;
    }
    if (player.gold < amount) {
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log('Not enough gold!', 'warning');
      }
      return false;
    }

    player.spendGold(amount);
    const day = typeof dayNight !== 'undefined' ? dayNight.getDaysElapsed() : 0;
    const duration = 10 + Math.floor(Math.random() * 11); // 10-20 days

    // Return multiplier: 0.8-3× based on luck and city prosperity
    const city = typeof cities !== 'undefined' ? cities.find(c => c.name === cityName) : null;
    const prosperityBonus = city ? (city.population || 500) / 1200 : 0.5;
    const baseMul = Math.min(2.5, 0.8 + Math.random() * (1.5 + prosperityBonus));
    const returnMul = Math.round(baseMul * 100) / 100;

    this.investments.push({
      cityName,
      amount,
      startDay: day,
      durationDays: duration,
      returnMul,
      matured: false,
    });

    if (typeof notificationManager !== 'undefined') {
      notificationManager.log(`Invested ${amount}g in ${cityName} trade route. Returns in ~${duration} days.`, 'info');
    }
    return true;
  }

  // ─── Insurance ──────────────────────────────────────────

  purchaseInsurance() {
    if (this.insurancePolicy) {
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log('You already have an active insurance policy!', 'warning');
      }
      return false;
    }
    if (!this._isAtBank()) {
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log('Visit a bank city to buy insurance!', 'warning');
      }
      return false;
    }

    // Calculate cargo value
    let cargoValue = 0;
    if (typeof player !== 'undefined') {
      for (const [key, entry] of player.inventory) {
        const lib = typeof ItemLibrary !== 'undefined' ? ItemLibrary[key] : null;
        if (lib && !lib.tags?.has('book')) {
          cargoValue += (lib.baseValue || 10) * entry.quantity;
        }
      }
    }

    if (cargoValue <= 0) {
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log('No insurable cargo!', 'warning');
      }
      return false;
    }

    const premium = Math.floor(cargoValue * 0.10); // 10% of value
    if (player.gold < premium) {
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log(`Insurance costs ${premium}g — not enough gold!`, 'warning');
      }
      return false;
    }

    player.spendGold(premium);
    const day = typeof dayNight !== 'undefined' ? dayNight.getDaysElapsed() : 0;
    this.insurancePolicy = {
      premium,
      cargoValue,
      dayPurchased: day,
      expiresDay: day + 7,
    };

    if (typeof notificationManager !== 'undefined') {
      notificationManager.log(`Insurance purchased for ${premium}g! Covers 70% of ${cargoValue}g cargo for 7 days.`, 'success');
    }
    return true;
  }

  /** Claim insurance payout when cargo is lost. Auto-claims don't require a bank visit. Returns gold reclaimed. */
  claimInsurance(lostValue, autoClaim = false) {
    if (!this.insurancePolicy) return 0;
    if (!autoClaim && !this._isAtBank()) {
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log('Visit a bank city to claim insurance!', 'warning');
      }
      return 0;
    }

    const day = typeof dayNight !== 'undefined' ? dayNight.getDaysElapsed() : 0;
    if (day > this.insurancePolicy.expiresDay) {
      this.insurancePolicy = null;
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log('Your insurance policy has expired!', 'error');
      }
      return 0;
    }

    const payout = Math.floor(Math.min(lostValue, this.insurancePolicy.cargoValue) * 0.70);
    player.earnGold(payout);
    this.insurancePolicy = null;

    if (typeof notificationManager !== 'undefined') {
      notificationManager.log(`Insurance claim: received ${payout}g!`, 'success');
    }
    return payout;
  }

  // ─── Weekly processing ──────────────────────────────────

  /** Called from player.applyWeeklyCosts() */
  processWeekly() {
    const summary = {
      depositInterest: 0,
      loanInterest: 0,
      investmentReturns: 0,
    };

    // Deposit interest
    if (this.balance > 0) {
      const interest = Math.floor(this.balance * this.depositInterestRate);
      this.balance += interest;
      summary.depositInterest = interest;
    }

    // Loan interest
    if (this.loanAmount > 0) {
      const interest = Math.ceil(this.loanAmount * this.loanInterestRate);
      this.loanAmount += interest;
      this.loanWeeksUnpaid++;
      summary.loanInterest = interest;

      if (this.loanWeeksUnpaid >= 3 && !this.loanDefaulted) {
        this.loanDefaulted = true;
        // Reputation tank at ALL cities
        if (typeof cities !== 'undefined') {
          for (const c of cities) {
            if (c.adjustReputation) c.adjustReputation(-10);
          }
        }
        if (typeof notificationManager !== 'undefined') {
          notificationManager.log('⚠ LOAN DEFAULT! Reputation lost everywhere! Bounty hunters dispatched!', 'error');
        }
        // Spawn bounty hunter raider
        this._spawnBountyHunter();
      }
    }

    return summary;
  }

  /** Called daily to check investment maturity */
  onDayChanged() {
    const day = typeof dayNight !== 'undefined' ? dayNight.getDaysElapsed() : 0;

    // Check investment maturity
    for (let i = this.investments.length - 1; i >= 0; i--) {
      const inv = this.investments[i];
      if (!inv.matured && day >= inv.startDay + inv.durationDays) {
        inv.matured = true;
        const returns = Math.floor(inv.amount * inv.returnMul);

        // Check if city is under raider threat (reduces returns)
        let riskPenalty = 1.0;
        if (typeof raiderManager !== 'undefined' && typeof cities !== 'undefined') {
          const city = cities.find(c => c.name === inv.cityName);
          if (city) {
            const nearbyRaiders = raiderManager.raiders.filter(r =>
              Math.abs(r.x - city.location.x) + Math.abs(r.y - city.location.y) < 10
            ).length;
            if (nearbyRaiders > 0) riskPenalty = Math.max(0.3, 1 - nearbyRaiders * 0.2);
          }
        }

        const finalReturns = Math.floor(returns * riskPenalty);
        player.earnGold(finalReturns);

        this.investments.splice(i, 1);

        const profit = finalReturns - inv.amount;
        if (typeof notificationManager !== 'undefined') {
          const msg = riskPenalty < 1
            ? `📈 Investment matured: ${finalReturns}g (reduced by raider activity). Profit: ${profit >= 0 ? '+' : ''}${profit}g`
            : `📈 Investment matured: ${finalReturns}g! Profit: ${profit >= 0 ? '+' : ''}${profit}g`;
          notificationManager.log(msg, profit >= 0 ? 'success' : 'warning');
        }
      }
    }

    // Check insurance expiry
    if (this.insurancePolicy && day > this.insurancePolicy.expiresDay) {
      this.insurancePolicy = null;
      if (typeof notificationManager !== 'undefined') {
        notificationManager.log('Your insurance policy has expired. Renew at a bank!', 'info');
      }
    }
  }

  _spawnBountyHunter() {
    if (typeof raiderManager === 'undefined' || typeof player === 'undefined') return;
    const maxX = (typeof cols !== 'undefined' ? cols : 100) - 1;
    const maxY = (typeof rows !== 'undefined' ? rows : 100) - 1;
    const hunter = new Raider({
      x: Math.max(0, Math.min(maxX, player.x + (Math.random() > 0.5 ? 15 : -15))),
      y: Math.max(0, Math.min(maxY, player.y + (Math.random() > 0.5 ? 15 : -15))),
      strength: 5 + Math.floor(Math.random() * 3),
      patrolPoints: [{ x: player.x, y: player.y }],
      type: 'boss',
    });
    hunter.isBountyHunter = true;
    raiderManager.raiders.push(hunter);
  }

  _isAtBank() {
    if (typeof player === 'undefined' || !player.currentCity) return false;
    return BankingSystem.cityHasBank(player.currentCity);
  }

  // ─── Serialization ──────────────────────────────────────

  toJSON() {
    return {
      balance: this.balance,
      loanAmount: this.loanAmount,
      loanWeeksUnpaid: this.loanWeeksUnpaid,
      loanDefaulted: this.loanDefaulted,
      investments: this.investments,
      insurancePolicy: this.insurancePolicy,
    };
  }

  static fromJSON(data) {
    const bs = new BankingSystem();
    bs.balance = data.balance || 0;
    bs.loanAmount = data.loanAmount || 0;
    bs.loanWeeksUnpaid = data.loanWeeksUnpaid || 0;
    bs.loanDefaulted = data.loanDefaulted || false;
    bs.investments = data.investments || [];
    bs.insurancePolicy = data.insurancePolicy || null;
    return bs;
  }
}
