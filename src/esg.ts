import { EconomicParams } from "./econometric";

export interface InvestmentVehicleAtTime {
  time: number;
  currentPrice: number;
  currentAnnualDividends: number;
}

export interface Investment {
  numberOfShares: number;
}

export interface Outcome {
  time: number;
  investment: Investment;
  investmentPrice: number;
  paidDividends: number;
  reinvestedDividends: number;
}

function dividendGrowth(economy: EconomicParams) {
  return economy.realDividendGrowth + economy.inflation;
}

export function noReinvestmentStrategy(
  economy: EconomicParams,
  vehicle: InvestmentVehicleAtTime,
  investment: Investment
): Outcome {
  const dividends =
    (investment.numberOfShares * vehicle.currentAnnualDividends) / 12;
  const futurePrice = priceViaGordonEquation(
    vehicle.currentAnnualDividends,
    marketReturn(economy),
    dividendGrowth(economy)
  );
  return {
    time: vehicle.time,
    investment: { numberOfShares: investment.numberOfShares },
    investmentPrice: investment.numberOfShares * futurePrice,
    paidDividends: dividends,
    reinvestedDividends: 0,
  };
}

/**
 * https://www.investopedia.com/terms/g/gordongrowthmodel.asp
 * @param annualDividends
 * @param discountRate
 * @param dividendGrowth
 */
function priceViaGordonEquation(
  annualDividends: number,
  discountRate: number,
  dividendGrowth: number
): number {
  return discountRate < dividendGrowth
    ? Number.POSITIVE_INFINITY
    : annualDividends / (discountRate - dividendGrowth);
}

export function fullReinvestmentStrategy(
  economy: EconomicParams,
  vehicle: InvestmentVehicleAtTime,
  investment: Investment
): Outcome {
  const dividends =
    (investment.numberOfShares * vehicle.currentAnnualDividends) / 12;
  const futurePrice = priceViaGordonEquation(
    vehicle.currentAnnualDividends,
    marketReturn(economy),
    dividendGrowth(economy)
  );
  const futureShares = investment.numberOfShares + dividends / futurePrice;
  return {
    time: vehicle.time,
    investment: { numberOfShares: futureShares },
    investmentPrice: investment.numberOfShares * futurePrice,
    paidDividends: 0,
    reinvestedDividends: dividends,
  };
}

export function investOneMoreTime(
  economy: EconomicParams,
  vehicle: InvestmentVehicleAtTime,
  investment: Investment,
  strategy: (
    economy: EconomicParams,
    vehicle: InvestmentVehicleAtTime,
    investment: Investment
  ) => Outcome
): { outcome: Outcome; evolvedVehicle: InvestmentVehicleAtTime } {
  return {
    outcome: strategy.call(this, economy, vehicle, investment),
    evolvedVehicle: {
      time: vehicle.time + 1,
      currentPrice: vehicle.currentPrice,
      currentAnnualDividends:
        vehicle.currentAnnualDividends * (1 + dividendGrowth(economy) / 12),
    },
  };
}

export function marketReturn(params: EconomicParams) {
  return (
    params.currentDividendYield + params.realDividendGrowth + params.inflation
  );
}
