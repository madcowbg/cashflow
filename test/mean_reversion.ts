import { random_mean_reverting } from "../src/calc/mean_reversion";
import { expect } from "chai";
import { asArray } from "../src/calc/esg";

describe("mean_reversion", () => {
  it("should have specific value", () => {
    const sample = asArray(random_mean_reverting(2, 3, 0.2, 0.2, 124123), 10);
    expect(sample).to.deep.eq([
      2.4555390471450083, 2.3623352722243194, 2.4103130405664146,
      2.6443342208050433, 2.8256313969932365, 2.7101018429434753,
      2.757225912048045, 2.8296802681859368, 2.701086102450288,
      2.9354080492394625,
    ]);
  });
});
