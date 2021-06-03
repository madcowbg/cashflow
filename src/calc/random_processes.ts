// Maximum likelihood estimation of mean reverting processes
// http://www.investmentscience.com/Content/howtoArticles/MLE_for_OR_mean_reverting.pdf

import * as d3 from "d3-random";
import { fmap, Process, stateful } from "./processes";
import { lcg } from "./lcg";

export type Random<A> = {
  pick(seed: number): A;
};

export function random_mean_reverting(
  x_0: number,
  ltm: number,
  nu: number,
  std: number
): Random<Process<number>> {
  return rmap(
      (driver: Process<number>) =>
          stateful(
              (prevNumber: number, residual: number) =>
                  prevNumber + nu * (ltm - prevNumber) + std * residual
          )(x_0, driver).evolve() // note: skipping x_0 when we return, as it is not random
  )(white_noise(0, 1));
}

export function white_noise(
    mean: number,
    stdev: number
): Random<Process<number>> {
  return {
    pick(seed: number) {
      const masterLcg: Process<number> = lcg(seed);

      return fmap((stepSeed: number) =>
          // FIXME this can backfire with quasi-random numbers due to the dimension problem
          d3.randomNormal.source(d3.randomLcg(stepSeed))(mean, stdev)()
      )(masterLcg);
    }
  };
}

export function rmap<A, R>(f: (a: A) => R): (ra: Random<A>) => Random<R> {
  return (ra: Random<A>) => ({
    pick(seed: number) {
      return f(ra.pick(seed));
    },
  });
}
