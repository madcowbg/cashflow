import { expect } from "chai";
import _ = require("lodash");

import { take } from "../../src/calc/processes";
import { mvnsims } from "../../src/calc/mvrandom";

describe("multivariate sims", () => {
  describe("mvnsims", () => {
    it("should produce exact values for first 10 elements as given", function () {
      const gen = mvnsims({ a: { a: 2, b: 0.7 }, b: { a: 0.7, b: 0.5 } });
      const processA = gen.pick(1231).a;
      const processB = gen.pick(1231).b;

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
  });
});
