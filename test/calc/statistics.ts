import { correlation, sampleStats } from "../../src/calc/statistics";
import { expect } from "chai";
import { take } from "../../src/calc/processes";
import _ = require("lodash");

describe("sampleStats", () => {
  it("should produce a particular number for a sample", () => {
    const { mean, std } = sampleStats([-1, 0, 1]);
    expect(mean, "mean").to.eq(0);
    expect(std, "std").to.approximately(0.8164965809, 1e-9);
  });

  it("should return std of 0 when sample is of length 1", () => {
    expect(sampleStats([1])).to.deep.eq({ mean: 1, std: 0 });
  });
});

describe("correlation", () => {
  it("should return perfect correlation for the same sample", () => {
    const sample = _.map(_.range(10), (i) => _.random());
    expect(correlation(sample, sample)).to.approximately(1, 1e-10);
  });

  it("should have perfect reverse correlation for the sample with negative sign", function () {
    const sample = _.map(_.range(10), (i) => _.random());
    const sampleInv = _.map(sample, (v) => -v);
    expect(correlation(sample, sampleInv)).to.approximately(-1, 1e-10);
    expect(correlation(sampleInv, sample)).to.approximately(-1, 1e-10);
  });

  it("should be 0 for uncorrelated sample", () => {
    const sampleA = [-1, 0, 1];
    const sampleB = [1, -2, 1];
    expect(correlation(sampleA, sampleB)).to.approximately(0, 1e-10);
  });

  it("should have specific value", () => {
    expect(correlation([1, 0, 1], [0, 0, 1])).to.eq(0.5);
  });
});
