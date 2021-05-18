import { expect } from "chai";
import {
  calculateStatistics,
  currentYield,
  dividendGrowth,
  evolveVehicle,
  fullReinvestmentStrategy,
  impliedSentiment,
  investOneMoreTime,
  MarketParams,
  MarketSentiment,
  noReinvestmentStrategy,
  Position,
  priceDDM,
  Security,
} from "../src/calc/esg";
import _ = require("lodash");

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
      investment: { numberOfShares: 3 },
      transactions: [{ dividend: 5 }],
      statistics: {
        fv: 600,
        paidDividends: 5,
        reinvestedDividends: 0,
      },
    });
  });

  it("should have one-step fullReinvestmentStrategy with a particular outcome", () => {
    const futurePrice = 200;
    const outcome = fullReinvestmentStrategy(
      1000,
      futurePrice,
      investmentVehicle,
      investment
    );
    expect(outcome).to.deep.eq({
      time: 1000,
      investment: { numberOfShares: 3.025 },
      transactions: [{ bought: 0.025, cost: 5 }, { dividend: 5 }],
    });
    expect(
      calculateStatistics(futurePrice, outcome.investment, outcome.transactions)
    ).to.deep.eq({
      fv: 605,
      paidDividends: 0,
      reinvestedDividends: 5,
    });
  });

  it("should have investOneMoreTime produce a particular result", () => {
    const sentiment = impliedSentiment(investmentVehicle, 200, params);
    const result = investOneMoreTime(
      1000,
      params,
      investmentVehicle,
      investment,
      sentiment,
      fullReinvestmentStrategy
    );
    expect(result).to.be.deep.eq({
      outcome: {
        time: 1000,
        investment: { numberOfShares: 3.0249521749979205 },
        transactions: [
          {
            bought: 0.024952174997920656,
            cost: 5,
          },
          { dividend: 5 },
        ],
      },
      statistics: {
        fv: 606.1499999999999,
        paidDividends: 0,
        reinvestedDividends: 5,
      },
      evolvedVehicle: {
        currentAnnualDividends: 20.03833333333333,
        realDividendGrowth: 0.003,
      },
    });
  });
  describe("calculateStatistics", () => {
    it("should have produce zeros on empty inputs", () => {
      const statistics = calculateStatistics(100, investment, []);
      expect(statistics).to.deep.eq({
        paidDividends: 0,
        fv: 300,
        reinvestedDividends: 0,
      });
    });
    it("should aggregate all dividends", () => {
      const statistics = calculateStatistics(100, investment, [
        { dividend: 5 },
        { dividend: 3 },
      ]);
      expect(statistics.paidDividends).to.eq(8);
      expect(statistics).to.deep.eq({
        paidDividends: 8,
        fv: 300,
        reinvestedDividends: 0,
      });
    });
    it("should say what is bought are reinvested dividends", () => {
      const statistics = calculateStatistics(100, investment, [
        { dividend: 5 },
        { dividend: 3 },
        { bought: 3, cost: 4 },
        { bought: 1, cost: 2 },
      ]);
      expect(statistics.reinvestedDividends).to.eq(6);
      expect(statistics.paidDividends).to.eq(2);
      expect(statistics).to.deep.eq({
        paidDividends: 2,
        fv: 300,
        reinvestedDividends: 6,
      });
    });
    it("should subtract sold from reinvested", () => {
      const statistics = calculateStatistics(100, investment, [
        { dividend: 5 },
        { dividend: 3 },
        { bought: 3, cost: 4 },
        { bought: 1, cost: 2 },
        { sold: 2, proceeds: 3 },
        { sold: 2, proceeds: 1 },
      ]);
      expect(statistics.reinvestedDividends).to.eq(2);
      expect(statistics.paidDividends).to.eq(6);
      expect(statistics).to.deep.eq({
        paidDividends: 6,
        fv: 300,
        reinvestedDividends: 2,
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
