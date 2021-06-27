import { expect } from "chai";
import {
  calculateStatistics,
  currentYield,
  nominalDividendGrowth,
  evaluateSecurity,
  evolveSecurity,
  impliedSentiment,
  inflationAdjustedSavings,
  investOverTime,
  MarketParams,
  MarketSentiment,
  Allocation,
  priceDDM,
  SavingsParams,
  Security,
  fullRebalancing,
  SecurityAtTime,
  Pricing,
  toTrades,
  diff,
  pricePositions,
} from "../src/calc/esg/esg";
import _ = require("lodash");
import { constant, fmap } from "../src/calc/processes";

describe("ESG", () => {
  const params: MarketParams = {
    inflation: 0.02,
  };
  const investmentSecurity: Security = {
    currentAnnualDividends: 1.1,
    realDividendGrowth: 0.003,
  };
  it("should compute nominal dividend growth as sum of real plus inflation", () => {
    expect(nominalDividendGrowth(investmentSecurity, params)).to.approximately(
      0.023,
      1e-10
    );
  });
  it("should have currentYield a specific number", () => {
    expect(currentYield(investmentSecurity, 100)).to.approximately(
      0.011,
      1e-10
    );
  });

  const investmentVehicle: Security = {
    currentAnnualDividends: 20,
    realDividendGrowth: 0.003,
  };
  const investment: Allocation = {
    numberOfShares: 3,
  };

  const savingsParams: SavingsParams = { monthlyInvestment: 1000 };
  it("should have one-step fullReinvestmentStrategy with a particular outcome", () => {
    const futurePrice = 200;
    const securityAtTplus1 = {
      dummy: { time: 1001, price: futurePrice, security: investmentVehicle },
    };
    const portfolio = { dummy: investment };
    const futurePortfolio = fullRebalancing(
      1000,
      portfolio,
      { dummy: { time: 1001, price: 100, security: investmentVehicle } },
      securityAtTplus1,
      3.025 * futurePrice
    );

    const trades = toTrades(diff(portfolio, futurePortfolio), securityAtTplus1);
    const decision = {
      time: 1001,
      transactions: trades.concat({ dividend: 5 }),
    };

    expect(futurePortfolio).to.deep.eq({
      dummy: {
        numberOfShares: 3.025,
      },
    });
    expect(
      calculateStatistics(
        { dummy: { time: 1001, price: futurePrice, security: security } },
        futurePortfolio,
        decision.transactions,
        savingsParams,
        99
      )
    ).to.deep.eq({
      fv: 605,
      totalDividends: 5,
      numberOfShares: { dummy: 3.025 },
      totalBoughtDollar: 4.999999999999982,
      totalBoughtNumShares: 0.02499999999999991,
      externalCashflow: 1000,
      shortfall: 99,
    });
  });

  it("should have investOneMoreTime produce a particular result", () => {
    const sentiment = impliedSentiment(investmentVehicle, 200);
    const securityAtTime = fmap<SecurityAtTime, Pricing<"dummy">>((s) => ({
      dummy: s,
    }))(
      evaluateSecurity(
        params,
        investmentVehicle,
        constant(sentiment),
        constant(1),
        0
      )
    );
    const result = investOverTime(
      0,
      inflationAdjustedSavings(params, savingsParams),
      securityAtTime,
      { dummy: investment },
      fullRebalancing
    );
    expect(_.assign({}, result, { evolve: "ignored" })).to.be.deep.eq({
      v: {
        time: 0,
        outcome: {
          decision: {
            time: 0,
            transactions: [
              {
                id: "dummy",
                bought: 5.01548685617864,
                cost: 1004.9999999999998,
              },
              { dividend: 5 },
            ],
          },
          investment: { dummy: { numberOfShares: 8.01548685617864 } },
        },
        statistics: {
          fv: 1606.138052288141,
          numberOfShares: { dummy: 8.01548685617864 },
          totalBoughtNumShares: 5.01548685617864,
          totalBoughtDollar: 1004.9999999999998,
          totalDividends: 5,
          externalCashflow: 1000,
          shortfall: 0,
        },
      },
      evolve: "ignored",
    });
  });
  describe("calculateStatistics", () => {
    it("should have produce zeros on empty inputs", () => {
      const statistics = calculateStatistics(
        { dummy: { time: 1001, price: 100, security: security } },
        { dummy: investment },
        [],
        savingsParams,
        99
      );
      expect(statistics).to.deep.eq({
        totalBoughtDollar: 0,
        fv: 300,
        numberOfShares: { dummy: 3 },
        totalBoughtNumShares: 0,
        totalDividends: 0,
        externalCashflow: 1000,
        shortfall: 99,
      });
    });
    it("should aggregate all dividends", () => {
      const statistics = calculateStatistics(
        { dummy: { time: 1001, price: 100, security: security } },
        { dummy: investment },
        [{ dividend: 5 }, { dividend: 3 }],
        savingsParams,
        99
      );
      expect(statistics.totalDividends).to.eq(8);
      expect(statistics).to.deep.eq({
        fv: 300,
        totalBoughtDollar: 0,
        totalBoughtNumShares: 0,
        numberOfShares: { dummy: 3 },
        totalDividends: 8,
        externalCashflow: 1000,
        shortfall: 99,
      });
    });
    it("should say what is bought are reinvested dividends", () => {
      const statistics = calculateStatistics(
        { dummy: { time: 1001, price: 100, security: security } },
        { dummy: investment },
        [
          { dividend: 5 },
          { dividend: 3 },
          { id: "dummy", bought: 3, cost: 4 },
          { id: "dummy", bought: 1, cost: 2 },
        ],
        savingsParams,
        99
      );
      expect(statistics).to.deep.eq({
        totalDividends: 8,
        fv: 300,
        totalBoughtDollar: 6,
        totalBoughtNumShares: 4,
        numberOfShares: { dummy: 3 },
        externalCashflow: 1000,
        shortfall: 99,
      });
    });
    it("should subtract sold from reinvested", () => {
      const statistics = calculateStatistics(
        { dummy: { time: 1001, price: 100, security: security } },
        { dummy: investment },
        [
          { dividend: 5 },
          { dividend: 3 },
          { id: "dummy", bought: 3, cost: 4 },
          { id: "dummy", bought: 1, cost: 2 },
          { id: "dummy", sold: 2, proceeds: 3 },
          { id: "dummy", sold: 2, proceeds: 1 },
        ],
        savingsParams,
        99
      );
      expect(statistics).to.deep.eq({
        totalDividends: 8,
        fv: 300,
        totalBoughtDollar: 2,
        numberOfShares: { dummy: 3 },
        totalBoughtNumShares: 0,
        externalCashflow: 1000,
        shortfall: 99,
      });
    });
  });

  const security: Security = {
    currentAnnualDividends: 1,
    realDividendGrowth: 0.003,
  };
  describe("evolveMarket", () => {
    it("should have implied sentiment a particular value", () => {
      expect(impliedSentiment(security, 10)).to.deep.eq({
        discountRate: 0.10300000000000001,
      });
    });

    it("should have implied discountRate equal to the marketReturn", () => {
      const newSecurity = evolveSecurity(params, security, 1);

      expect(newSecurity).to.deep.eq({
        currentAnnualDividends: 1.0018967538135684,
        realDividendGrowth: 0.003,
      });
    });

    it("should change required dividend yield by market sentiment", () => {
      const newSecurity = evolveSecurity(params, security, 1);

      expect(newSecurity).to.deep.eq({
        currentAnnualDividends: 1.0018967538135684,
        realDividendGrowth: 0.003,
      });

      const sentiment: MarketSentiment = { discountRate: 0.055 };
      const newPrice = priceDDM(security, params, sentiment);
      expect(newPrice).to.approximately(19.23076923076923, 1e-10);
      expect(currentYield(newSecurity, newPrice)).to.approximately(
        0.05209863119830556,
        1e-10
      );
    });
  });
});

describe("fullRebalancing", () => {
  it("should produce a particular value", function () {
    const equity: Security = {
      currentAnnualDividends: 1,
      realDividendGrowth: 2,
    };
    const cash: Security = {
      currentAnnualDividends: 0,
      realDividendGrowth: 0,
    };
    const portfolio = {
      equity: { numberOfShares: 3 },
      cash: { numberOfShares: 1 },
    };
    const tPricing = {
      equity: { time: 0, price: 100, security: equity },
      cash: { time: 0, price: 200, security: cash },
    };
    const tPlus1Pricing = {
      equity: { time: 0, price: 200, security: equity },
      cash: { time: 0, price: 100, security: cash },
    };
    const rebalancedPortfolio = fullRebalancing(
      0,
      portfolio,
      tPricing,
      tPlus1Pricing,
      1000
    );
    expect(rebalancedPortfolio).to.deep.eq({
      cash: { numberOfShares: 4 },
      equity: { numberOfShares: 3 },
    });
    expect(
      _.sum(_.values(pricePositions(rebalancedPortfolio, tPlus1Pricing)))
    ).approximately(1000, 1e-12);
  });
});
