// Maximum likelihood estimation of mean reverting processes
// http://www.investmentscience.com/Content/howtoArticles/MLE_for_OR_mean_reverting.pdf

import * as d3 from "d3-random";
import { Recursive } from "./esg";

export function random_mean_reverting(
  x_0: number,
  ltm: number,
  nu: number,
  std: number,
  seed?: number
): Recursive<number> {
  if (seed === undefined) {
    seed = d3.randomInt(1000000)();
  }

  const normalRNG = d3.randomNormal.source(d3.randomLcg(seed))(0, 1);
  const genNext = (prevNumber: number) => {
    const currentNumber =
      prevNumber + nu * (ltm - prevNumber) + std * normalRNG();
    return {
      current: currentNumber,
      next: () => genNext(currentNumber),
    };
  };
  return genNext(x_0);
}
