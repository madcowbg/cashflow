import { lcg } from "../../src/calc/lcg";
import { expect } from "chai";
import { take } from "../../src/calc/processes";
import * as _ from "lodash";

describe("lcg", () => {
  it("should produce the same process if taken twice", () => {
    const generator = lcg(5);
    expect(take(5)(generator)).to.deep.eq(take(5)(generator));
  });

  it("should return same values as the D3 implementation", () => {
    const mul = 0x19660d;
    const inc = 0x3c6ef35f;
    const eps = 1 / 0x100000000;

    function lcg_d3(seed = Math.random()) {
      let state = (0 <= seed && seed < 1 ? seed / eps : Math.abs(seed)) | 0;
      return () => ((state = (mul * state + inc) | 0), eps * (state >>> 0));
    }

    const lcg2r = lcg_d3(10);
    expect(take(20)(lcg(10))).to.deep.eq(_.map(_.range(0, 20), () => lcg2r()));
  });
});
