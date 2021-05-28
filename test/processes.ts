import {
  count,
  fmap,
  Process,
  takeEager,
  constant,
} from "../src/calc/processes";
import { expect } from "chai";
import _ = require("lodash");

describe("unit", () => {
  it("should always produce the same value", () => {
    let u = constant(5);
    for (const i of _.range(0, 100)) {
      expect(u.v).to.eq(5);
      u = u.evolve();
    }
  });
});

describe("fmap", () => {
  it("should get the value and evolve at each step", () => {
    const counter = count(0);

    const lifted = fmap<number, number>((a) => a + 3);
    expect(takeEager(lifted(counter), 5)).to.deep.eq([3, 4, 5, 6, 7]);
  });

  it("should combine values", () => {
    const counter = count(0);
    const counter5 = count(5);
    const func = fmap<number, number, number>((a, b) => 2 * a - b);

    expect(takeEager(func(counter, counter5), 5)).to.deep.eq([
      -5, -4, -3, -2, -1,
    ]);
  });
});
