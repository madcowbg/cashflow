// Maximum likelihood estimation of mean reverting processes
// http://www.investmentscience.com/Content/howtoArticles/MLE_for_OR_mean_reverting.pdf

import { fmap, Process, stateful } from "./processes";
import { lcg } from "./lcg";

export type Random<A> = {
  pick(seed: number): A;
};

/**
 * A mean-reverting process.
 * @param x_0 the current level of the process
 * @param ltm the long-term mean of the process
 * @param nu the mean-reversion strength parameter
 * @param std_resid the standard deviation of the residual
 */
export function random_mean_reverting(
  x_0: number,
  ltm: number,
  nu: number,
  std_resid: number
): Random<Process<number>> {
  return rmap(
    (driver: Process<number>) =>
      stateful(
        (prevNumber: number, residual: number) =>
          prevNumber + nu * (ltm - prevNumber) + std_resid * residual
      )(x_0, driver).evolve // note: skipping x_0 when we return, as it is not random
  )(white_noise(0, 1));
}

function randomNormal(mu: number, sigma: number): (seed: number) => number {
  let x: number, r: number, y: number;

  mu = mu == null ? 0 : +mu;
  sigma = sigma == null ? 1 : +sigma;

  return (seed: number) => {
    let source = lcg(seed);
    do {
      x = source.v * 2 - 1;
      source = source.evolve;
      y = source.v * 2 - 1;
      source = source.evolve;
      r = x * x + y * y;
    } while (!r || r > 1);

    return mu + sigma * y * Math.sqrt((-2 * Math.log(r)) / r);
  };
}

/**
 * A white-noise process
 * @param mean
 * @param stdev
 */
export function white_noise(
  mean: number,
  stdev: number
): Random<Process<number>> {
  return {
    pick(seed: number) {
      const masterLcg: Process<number> = lcg(seed);

      // FIXME this can backfire with quasi-random numbers due to the dimension problem
      return fmap(randomNormal(mean, stdev))(masterLcg);
    },
  };
}

export function rmap<A, R>(f: (a: A) => R): (ra: Random<A>) => Random<R> {
  return (ra: Random<A>) => ({
    pick(seed: number) {
      return f(ra.pick(seed));
    },
  });
}
