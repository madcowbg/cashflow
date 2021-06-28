import _ = require("lodash");

/**
 * Sample statistics. Standard deviation is population-based, i.e. 1/N.
 * @param sample the sample
 * @return {mean, std}
 */
export function sampleStats(sample: number[]): { mean: number; std: number } {
  const mean = _.mean(sample);
  const std = Math.sqrt(_.mean(_.map(sample, (v) => (v - mean) ** 2)));
  return { mean, std };
}

export function correlation(sampleA: number[], sampleB: number[]): number {
  const { mean: meanA, std: stdA } = sampleStats(sampleA);
  const { mean: meanB, std: stdB } = sampleStats(sampleB);

  return _.mean(
    _.map(
      _.range(sampleA.length),
      (i) => ((sampleA[i] - meanA) * (sampleB[i] - meanB)) / (stdA * stdB)
    )
  );
}
