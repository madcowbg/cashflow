import { expect } from "chai";
import _ = require("lodash");

import { take } from "../../src/calc/processes";
import { mvnsims } from "../../src/calc/mvrandom";
import { correlation, sampleStats } from "../../src/calc/statistics";

describe("multivariate sims", () => {
  describe("mvnsims", () => {
    const { a: processA, b: processB } = mvnsims({
      a: { a: 2, b: 0.7 },
      b: { a: 0.7, b: 0.5 },
    }).pick(1231);

    it("should produce exact values for first 10 elements as given", () => {
      expect(take(10)(processA)).to.deep.eq([
        -0.5483142656547735, -1.018622933940672, 0.7690219647553349,
        -0.041840302149941236, 1.9083393460489662, -0.041840302149941236,
        1.9083393460489662, -1.130593716893146, -2.0997092140093416,
        2.34587585224387,
      ]);
      expect(take(10)(processB)).to.deep.eq([
        -1.3124228485120881, 0.33696529205502684, -0.07943610871756454,
        0.12930266871087104, 0.08460550311954335, 0.12930266871087104,
        0.08460550311954335, -0.15149588701980823, -1.5395521396551024,
        1.64157265672558,
      ]);
    });

    it("should have correlation close to the provided in the cov matrix", () => {
      const corr = correlation(take(1000)(processA), take(1000)(processB));
      expect(corr).to.approximately(0.7, 0.01);
    });

    it("should produce samples with statistics close to the provided", () => {
      const sampleA = take(1000)(processA);
      const sampleB = take(1000)(processB);

      expect(sampleStats(sampleA).mean).to.approximately(0, 0.01);
      expect(sampleStats(sampleB).mean).to.approximately(0, 0.01);

      expect(sampleStats(sampleA).std).to.approximately(Math.sqrt(2.0), 0.05);
      expect(sampleStats(sampleB).std).to.approximately(Math.sqrt(0.5), 0.05);
    });
  });
});
