export interface MarketParams {
  currentDividendYield: number;
  realDividendGrowth: number;
  inflation: number;
}

export interface Security {
  time: number;
  currentPrice: number;
  currentAnnualDividends: number;
}

export interface Position {
  numberOfShares: number;
}

export interface Statistics {
  pv: number;
  paidDividends: number;
  reinvestedDividends: number;
}

export interface Outcome {
  time: number;
  investment: Position;
  statistics: Statistics;
}

export function dividendGrowth(economy: MarketParams) {
  return economy.realDividendGrowth + economy.inflation;
}

export function noReinvestmentStrategy(
  futurePrice: number,
  vehicle: Security,
  investment: Position
): Outcome {
  const dividends =
    (investment.numberOfShares * vehicle.currentAnnualDividends) / 12;
  return {
    time: vehicle.time,
    investment: { numberOfShares: investment.numberOfShares },
    statistics: {
      pv: investment.numberOfShares * futurePrice,
      paidDividends: dividends,
      reinvestedDividends: 0,
    },
  };
}

export function fullReinvestmentStrategy(
  futurePrice: number,
  vehicle: Security,
  investment: Position
): Outcome {
  const dividends =
    (investment.numberOfShares * vehicle.currentAnnualDividends) / 12;

  const futureShares = investment.numberOfShares + dividends / futurePrice;
  return {
    time: vehicle.time,
    investment: { numberOfShares: futureShares },
    statistics: {
      pv: investment.numberOfShares * futurePrice,
      paidDividends: 0,
      reinvestedDividends: dividends,
    },
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

export function investOneMoreTime(
  economy: MarketParams,
  vehicle: Security,
  investment: Position,
  strategy: (
    futurePrice: number,
    vehicle: Security,
    investment: Position
  ) => Outcome
): { outcome: Outcome; evolvedVehicle: Security } {
  const futurePrice = priceViaGordonEquation(
    vehicle.currentAnnualDividends,
    marketReturn(economy),
    dividendGrowth(economy)
  );
  return {
    outcome: strategy(futurePrice, vehicle, investment),
    evolvedVehicle: {
      time: vehicle.time + 1,
      currentPrice: futurePrice,
      currentAnnualDividends:
        vehicle.currentAnnualDividends * (1 + dividendGrowth(economy) / 12),
    },
  };
}

export function marketReturn(params: MarketParams) {
  return (
    params.currentDividendYield + params.realDividendGrowth + params.inflation
  );
}
