import { lcg } from "../src/calc/lcg";
import { expect } from "chai";
import { take } from "../src/calc/processes";

describe("lcg", () => {
  it("should produce the same process if taken twice", () => {
    const generator = lcg(5);
    expect(take(5)(generator)).to.deep.eq(take(5)(generator));
  });
});
