import { expect } from "chai";
import {
  calculateStatistics,
  consolidateInvestment,
  currentYield,
  nominalDividendGrowth,
  evaluateSecurity,
  evolveSecurity,
  fullReinvestmentStrategy,
  impliedSentiment,
  inflationAdjustedSavings,
  investOverTime,
  MarketParams,
  MarketSentiment,
  noReinvestmentStrategy,
  Position,
  priceDDM,
  SavingsParams,
  Security,
} from "../src/calc/esg/esg";
import _ = require("lodash");
import { constant } from "../src/calc/processes";

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
  const investment: Position = {
    numberOfShares: 3,
  };
  it("should have one-step noReinvestmentStrategy with a particular outcome", () => {
    const outcome = noReinvestmentStrategy(
      1000,
      200,
      investmentVehicle,
      investment
    );
    expect(outcome).to.deep.equal({
      time: 1000,
      transactions: [{ dividend: 5 }],
    });
  });

  const savingsParams: SavingsParams = { monthlyInvestment: 1000 };
  it("should have one-step fullReinvestmentStrategy with a particular outcome", () => {
    const futurePrice = 200;
    const decision = fullReinvestmentStrategy(
      1000,
      futurePrice,
      investmentVehicle,
      investment
    );
    expect(decision).to.deep.eq({
      time: 1000,
      transactions: [{ bought: 0.025, cost: 5 }, { dividend: 5 }],
    });
    expect(consolidateInvestment(investment, decision)).to.deep.eq({
      numberOfShares: 3.025,
    });
    expect(
      calculateStatistics(
        futurePrice,
        consolidateInvestment(investment, decision),
        decision.transactions,
        savingsParams
      )
    ).to.deep.eq({
      fv: 605,
      totalDividends: 5,
      numberOfShares: 3.025,
      totalBoughtDollar: 5,
      totalBoughtNumShares: 0.025,
      externalCashflow: 1000,
    });
  });

  it("should have investOneMoreTime produce a particular result", () => {
    const sentiment = impliedSentiment(investmentVehicle, 200);
    const securityAtTime = evaluateSecurity(
      params,
      investmentVehicle,
      constant(sentiment),
      constant(1),
      0
    );
    const result = investOverTime(
      0,
      inflationAdjustedSavings(params, savingsParams),
      securityAtTime,
      investment,
      fullReinvestmentStrategy
    );
    expect(_.assign({}, result, { evolve: "ignored" })).to.be.deep.eq({
      v: {
        time: 0,
        outcome: {
          decision: {
            time: 0,
            transactions: [
              {
                bought: 0.024952670926261897,
                cost: 5,
              },
              { dividend: 5 },
              {
                bought: 4.990534185252379,
                cost: 1000,
              },
            ],
          },
          investment: { numberOfShares: 8.01548685617864 },
        },
        statistics: {
          fv: 1606.138052288141,
          numberOfShares: 8.01548685617864,
          totalBoughtNumShares: 5.015486856178641,
          totalBoughtDollar: 1005,
          totalDividends: 5,
          externalCashflow: 1000,
        },
        evolvedVehicle: {
          currentAnnualDividends: 20.037935076271367,
          realDividendGrowth: 0.003,
        },
      },
      evolve: "ignored",
    });
  });
  describe("calculateStatistics", () => {
    it("should have produce zeros on empty inputs", () => {
      const statistics = calculateStatistics(
        100,
        investment,
        [],
        savingsParams
      );
      expect(statistics).to.deep.eq({
        totalBoughtDollar: 0,
        fv: 300,
        numberOfShares: 3,
        totalBoughtNumShares: 0,
        totalDividends: 0,
        externalCashflow: 1000,
      });
    });
    it("should aggregate all dividends", () => {
      const statistics = calculateStatistics(
        100,
        investment,
        [{ dividend: 5 }, { dividend: 3 }],
        savingsParams
      );
      expect(statistics.totalDividends).to.eq(8);
      expect(statistics).to.deep.eq({
        fv: 300,
        totalBoughtDollar: 0,
        totalBoughtNumShares: 0,
        numberOfShares: 3,
        totalDividends: 8,
        externalCashflow: 1000,
      });
    });
    it("should say what is bought are reinvested dividends", () => {
      const statistics = calculateStatistics(
        100,
        investment,
        [
          { dividend: 5 },
          { dividend: 3 },
          { bought: 3, cost: 4 },
          { bought: 1, cost: 2 },
        ],
        savingsParams
      );
      expect(statistics).to.deep.eq({
        totalDividends: 8,
        fv: 300,
        totalBoughtDollar: 6,
        totalBoughtNumShares: 4,
        numberOfShares: 3,
        externalCashflow: 1000,
      });
    });
    it("should subtract sold from reinvested", () => {
      const statistics = calculateStatistics(
        100,
        investment,
        [
          { dividend: 5 },
          { dividend: 3 },
          { bought: 3, cost: 4 },
          { bought: 1, cost: 2 },
          { sold: 2, proceeds: 3 },
          { sold: 2, proceeds: 1 },
        ],
        savingsParams
      );
      expect(statistics).to.deep.eq({
        totalDividends: 8,
        fv: 300,
        totalBoughtDollar: 2,
        numberOfShares: 3,
        totalBoughtNumShares: 0,
        externalCashflow: 1000,
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
