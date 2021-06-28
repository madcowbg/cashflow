import {
  count,
  fmap,
  take,
  constant,
  sample,
  aggregate,
} from "../../src/calc/processes";
import { expect } from "chai";
import _ = require("lodash");

describe("unit", () => {
  it("should always produce the same value", () => {
    let u = constant(5);
    for (const i of _.range(0, 100)) {
      expect(u.v).to.eq(5);
      u = u.evolve;
    }
  });
});

describe("fmap", () => {
  it("should get the value and evolve at each step", () => {
    const counter = count(0);

    const lifted = fmap<number, number>((a) => a + 3);
    expect(take(5)(lifted(counter))).to.deep.eq([3, 4, 5, 6, 7]);
  });

  it("should combine values", () => {
    const counter = count(0);
    const counter5 = count(5);
    const func = fmap<number, number, number>((a, b) => 2 * a - b);

    expect(take(5)(func(counter, counter5))).to.deep.eq([-5, -4, -3, -2, -1]);
  });
});

describe("sample", () => {
  it("should throw exception when frequency is not positive", function () {
    expect(() => sample(0)).to.throw(
      "need positive frequency to sample, got 0"
    );
  });
  it("should start with frequency + 1", function () {
    expect(sample(3)(count(0)).v).to.eq(2);
  });
  it("should sample every several turns", () => {
    expect(take(5)(sample(3)(count(2)))).to.deep.eq([4, 7, 10, 13, 16]);
  });
});

describe("aggregate", () => {
  it("should call callback once at start", () => {
    let ncalls = 0;
    const aggregator = (...args: number[]) => {
      ncalls++;
      return _.sum(args);
    };
    aggregate(5, aggregator)(count(0)); // note: no actual taking happening here!
    expect(ncalls).to.eq(1);
  });

  it("should call (number of taken elements + 1) calls", () => {
    let ncalls = 0;
    const aggregator = (...args: number[]) => {
      ncalls++;
      return _.sum(args);
    };
    const taken = take(4)(aggregate(5, aggregator)(count(0)));
    expect(taken).to.deep.eq([10, 35, 60, 85]);
    expect(ncalls).to.eq(5);
  });

  it("should call the aggregator with number of elements equal to frequency", () => {
    const aggregator = (...args: number[]) => {
      expect(args.length).to.eq(7);
      return -1;
    };
    expect(_.sum(take(5)(aggregate(7, aggregator)(count(0))))).to.eq(-5);
  });

  it("should call aggregator with all elements in batches", () => {
    const nels = 11;
    const freq = 7;
    const aggregatedSum = _.sum(
      take(nels)(aggregate(freq, (...e: number[]) => _.sum(e))(count(1)))
    );
    const simpleSum = _.sum(take(nels * freq)(count(1)));
    expect(aggregatedSum).to.eq(
      simpleSum,
      "aggregate sum is not equal to simple sum!"
    );
    expect(simpleSum).to.eq((nels * freq * (nels * freq + 1)) / 2);
  });
});

describe("take", () => {
  it("should return empty array when take count is not positive", function () {
    expect(take(0)(count(0)).length).to.eq(0);
  });
  it("should take the first count of elements", function () {
    expect(take(4)(count(0)).length).to.eq(4);
  });
});
