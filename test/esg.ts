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
} from "../src/esg";

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
      statistics: {
        pv: 600,
        paidDividends: 5,
        reinvestedDividends: 0,
      },
    });
  });

  it("should have one-step fullReinvestmentStrategy with a particular outcome", () => {
    const outcome = fullReinvestmentStrategy(
      200,
      investmentVehicle,
      investment
    );
    expect(outcome).to.deep.eq({
      time: 1000,
      investment: { numberOfShares: 3.025 },
      statistics: {
        pv: 600,
        paidDividends: 0,
        reinvestedDividends: 5,
      },
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
        statistics: {
          pv: 600,
          paidDividends: 0,
          reinvestedDividends: 5,
        },
      },
      evolvedVehicle: {
        time: 1001,
        currentPrice: 200,
        currentAnnualDividends: 20.03833333333333,
      },
    });
  });
});
