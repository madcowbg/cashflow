import { random_mean_reverting } from "../src/calc/random_processes";
import { expect } from "chai";
import { take } from "../src/calc/processes";
import _ = require("lodash");

describe("mean_reversion", () => {
  it("should have specific value", () => {
    const sample = take(10)(random_mean_reverting(2, 3, 0.2, 0.2).pick(124123));
    expect(sample).to.deep.eq([
      2.349380593420502, 2.399949297523361, 2.378355250649687,
      2.6128482208689516, 2.8922108348886013, 2.9029131056041457,
      3.1242627426767573, 2.9367520820429442, 3.060323057636653,
      3.3956841970260214,
    ]);
  });

  it("should return the same process for the same seed", () => {
    expect(
      take(100)(random_mean_reverting(2, 3, 0.2, 0.2).pick(123))
    ).to.deep.eq(take(100)(random_mean_reverting(2, 3, 0.2, 0.2).pick(123)));
  });

  it("should return processes with uncorrelated shocks for (seed) vs (seed + 1)", () => {
    const diff = (a: number[]) =>
      _.map(_.range(a.length - 1), (i) => a[i + 1] - a[i]);

    const a = diff(take(1000)(random_mean_reverting(2, 3, 0.2, 0.2).pick(123)));
    const b = diff(take(1000)(random_mean_reverting(2, 3, 0.2, 0.2).pick(124)));

    const meanA = _.mean(a);
    const meanB = _.mean(b);
    const stdA = Math.sqrt(_.mean(_.map(a, (v) => (v - meanA) ** 2)));
    const stdB = Math.sqrt(_.mean(_.map(b, (v) => (v - meanA) ** 2)));

    const corr = _.mean(
      _.map(
        _.range(a.length),
        (i) => ((a[i] - meanA) * (b[i] - meanB)) / (stdA * stdB)
      )
    );

    expect(corr).to.approximately(0, 0.05);
  });

  it("should take the same random values if called several times (stabilized)", () => {
    const process = random_mean_reverting(2, 3, 0.2, 0.2).pick(123);
    expect(take(10)(process)).to.deep.eq(take(10)(process));
  });
});
