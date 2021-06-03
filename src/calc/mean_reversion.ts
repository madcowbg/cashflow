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
  return {
    pick(seed: number) {
      const masterLcg: Process<number> = lcg(seed);

      const normalRandomProcess: Process<number> = fmap((stepSeed: number) =>
        // FIXME this can backfire with quasi-random numbers due to the dimension problem
        d3.randomNormal.source(d3.randomLcg(stepSeed))(0, 1)()
      )(masterLcg);

      return stateful(
        (prevNumber: number, normalRandom: number) =>
          prevNumber + nu * (ltm - prevNumber) + std * normalRandom
      )(x_0, normalRandomProcess).evolve();
    },
  };
}
