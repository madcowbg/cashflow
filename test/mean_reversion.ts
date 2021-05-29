import { random_mean_reverting } from "../src/calc/mean_reversion";
import { expect } from "chai";
import { take } from "../src/calc/processes";
import _ = require("lodash");

describe("mean_reversion", () => {
  it("should have specific value", () => {
    const sample = take(10, random_mean_reverting(2, 3, 0.2, 0.2).pick(124123));
    expect(sample).to.deep.eq([
      2.4555390471450083, 2.3623352722243194, 2.4103130405664146,
      2.6443342208050433, 2.8256313969932365, 2.7101018429434753,
      2.757225912048045, 2.8296802681859368, 2.701086102450288,
      2.9354080492394625,
    ]);
  });

  it("should return the same process for the same seed", () => {
    expect(
      take(100, random_mean_reverting(2, 3, 0.2, 0.2).pick(123))
    ).to.deep.eq(take(100, random_mean_reverting(2, 3, 0.2, 0.2).pick(123)));
  });

  it("should return processes with uncorrelated shocks for (seed) vs (seed + 1)", () => {
    const diff = (a: number[]) =>
      _.map(_.range(a.length - 1), (i) => a[i + 1] - a[i]);

    const a = diff(take(1000, random_mean_reverting(2, 3, 0.2, 0.2).pick(123)));
    const b = diff(take(1000, random_mean_reverting(2, 3, 0.2, 0.2).pick(124)));

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
});
