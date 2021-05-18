import { expect } from "chai";
import {
  dividendGrowth,
  fullReinvestmentStrategy,
  Position,
  Security,
  investOneMoreTime,
  MarketParams,
  marketReturn,
  noReinvestmentStrategy,
  calculateStatistics,
  evolveMarket,
} from "../src/calc/esg";
import _ = require("lodash");

describe("ESG", () => {
  const params: MarketParams = {
    currentDividendYield: 0.1,
    inflation: 0.02,
    realDividendGrowth: 0.003,
  };
  it("should compute marketReturn as sum of dividend return, dividend growth and inflation", () => {
    expect(marketReturn(params)).to.approximately(0.123, 1e-10);
  });
  it("should compute nominal dividend growth as sum of real plus inflation", () => {
    expect(dividendGrowth(params)).to.approximately(0.023, 1e-10);
  });

  const investmentVehicle: Security = {
    currentPrice: 100,
    currentAnnualDividends: 20,
    time: 1000,
  };
  const investment: Position = {
    numberOfShares: 3,
  };
  it("should have one-step noReinvestmentStrategy with a particular outcome", () => {
    const outcome = noReinvestmentStrategy(200, investmentVehicle, investment);
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
    const result = investOneMoreTime(
      params,
      investmentVehicle,
      investment,
      fullReinvestmentStrategy
    );
    expect(result).to.be.deep.eq({
      outcome: {
        time: 1000,
        investment: { numberOfShares: 3.025 },
        transactions: [
          {
            bought: 0.025,
            cost: 5,
          },
          { dividend: 5 },
        ],
      },
      statistics: {
        fv: 605,
        paidDividends: 0,
        reinvestedDividends: 5,
      },
      evolvedVehicle: {
        time: 1001,
        currentPrice: 200,
        currentAnnualDividends: 20.03833333333333,
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
    currentPrice: 100,
    time: 0,
  };
  describe("evolveMarket", () => {
    it("should have implied discountRate equal to the marketReturn", () => {
      const impliedSentiment = { discountRate: marketReturn(params) };
      const [newParams, newSecurity] = evolveMarket(
        params,
        impliedSentiment,
        security
      );

      expect(newParams).to.deep.eq(params);
      expect(newSecurity).to.deep.eq({
        currentAnnualDividends: 1.0019166666666666,
        currentPrice: 10,
        time: 1,
      });
      expect(impliedSentiment).to.deep.eq({
        discountRate: 0.12300000000000001,
      });
    });

    it("should change required dividend yield by market sentiment", () => {
      const [newParams, newSecurity] = evolveMarket(
        params,
        { discountRate: 0.055 },
        security
      );
      expect(newParams).to.deep.eq(
        _.assign({}, params, {
          currentDividendYield: 0.032,
        })
      );
      expect(newSecurity).to.deep.eq({
        currentAnnualDividends: 1.0019166666666666,
        currentPrice: 31.249999999999993,
        time: 1,
      });
    });
  });
});
