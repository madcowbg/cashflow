import { random_discrete_bridge } from "../../src/calc/brownian_bridge";
import { expect } from "chai";

const FIXED_SEED = 9881239;

describe("random_discrete_bridge", () => {
  it("should have beginning and end match", () => {
    const sample = random_discrete_bridge(100, -2, 2, 0.2, FIXED_SEED);
    expect(sample[0]).to.eq(-2);
    expect(sample[sample.length - 1]).to.approximately(2, 1e-10);
  });
  it("should generate exactly T numbers", () => {
    const sample = random_discrete_bridge(100, -2, 2, 0.2, FIXED_SEED);
    expect(sample.length).to.eq(100);
  });
  it("should generate exact sample with seed", () => {
    const sample = random_discrete_bridge(7, -2, 2, 0.2, FIXED_SEED);
    expect(sample).to.deep.eq([
      -2, -1.271420262599199, -0.5885040448117704, -0.02566586216310296,
      0.6244906893419837, 1.1164715064455515, 2,
    ]);
  });
});
