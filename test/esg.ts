import { expect } from "chai";
import {
  calculateStatistics,
  consolidateInvestment,
  currentYield,
  dividendGrowth,
  evaluateSecurity,
  evolveVehicle,
  fullReinvestmentStrategy,
  impliedSentiment,
  inflationAdjustedSavings,
  investCashflow,
  investOverTime,
  MarketParams,
  MarketSentiment,
  noReinvestmentStrategy,
  Position,
  priceDDM,
  SavingsParams,
  Security,
} from "../src/calc/esg";
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
    expect(dividendGrowth(investmentSecurity, params)).to.approximately(
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
      totalBoughtDollar: 5,
      totalSoldDollar: 0,
      externalCashflow: 1000,
    });
  });

  it("should have investOneMoreTime produce a particular result", () => {
    const sentiment = impliedSentiment(investmentVehicle, 200, params);
    const securityAtTime = evaluateSecurity(
      params,
      constant(sentiment),
      investmentVehicle,
      0
    );
    const result = investOverTime(
      0,
      securityAtTime,
      investment,
      inflationAdjustedSavings(params, savingsParams),
      investCashflow(fullReinvestmentStrategy)
    );
    expect(_.assign({}, result, { next: "ignored" })).to.be.deep.eq({
      current: {
        time: 0,
        outcome: {
          decision: {
            time: 0,
            transactions: [
              {
                bought: 0.024952174997920656,
                cost: 5,
              },
              { dividend: 5 },
              {
                bought: 4.9904349995841315,
                cost: 1000,
              },
            ],
          },
          investment: { numberOfShares: 8.015387174582052 },
        },
        statistics: {
          fv: 1606.15,
          totalBoughtDollar: 1005,
          totalDividends: 5,
          totalSoldDollar: 0,
          externalCashflow: 1000,
        },
        evolvedVehicle: {
          currentAnnualDividends: 20.03833333333333,
          realDividendGrowth: 0.003,
        },
      },
      next: "ignored",
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
        totalDividends: 0,
        totalSoldDollar: 0,
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
        totalDividends: 8,
        totalSoldDollar: 0,
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
        totalSoldDollar: 0,
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
        totalBoughtDollar: 6,
        totalSoldDollar: 4,
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
      expect(impliedSentiment(security, 10, params)).to.deep.eq({
        discountRate: 0.12300000000000001,
      });
    });

    it("should have implied discountRate equal to the marketReturn", () => {
      const newSecurity = evolveVehicle(params, security);

      expect(newSecurity).to.deep.eq({
        currentAnnualDividends: 1.0019166666666666,
        realDividendGrowth: 0.003,
      });
    });

    it("should change required dividend yield by market sentiment", () => {
      const newSecurity = evolveVehicle(params, security);

      expect(newSecurity).to.deep.eq({
        currentAnnualDividends: 1.0019166666666666,
        realDividendGrowth: 0.003,
      });

      const sentiment: MarketSentiment = { discountRate: 0.055 };
      const newPrice = priceDDM(security, params, sentiment);
      expect(newPrice).to.approximately(31.25, 1e-10);
      expect(currentYield(newSecurity, newPrice)).to.approximately(
        0.0320613333333,
        1e-10
      );
    });
  });
});
