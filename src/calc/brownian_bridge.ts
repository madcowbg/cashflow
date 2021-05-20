import * as d3 from "d3-random";
import * as _ from "lodash";

export function random_discrete_bridge(
  T: number,
  start: number,
  end: number,
  std: number,
  seed?: number
): number[] {
  if (seed === undefined) {
    seed = d3.randomInt(1000000)();
  }

  const normalRNG = d3.randomNormal.source(d3.randomLcg(seed))(0, std);
  const returnsData = _.map(_.range(0, T - 1), normalRNG);

  const levels: number[] = [0];
  for (let i = 1; i < T; i++) {
    levels.push(levels[levels.length - 1] + returnsData[i - 1]);
  }

  const startOffset = start - levels[0],
    slope = end - startOffset - levels[levels.length - 1];
  return _.map(
    levels,
    (v, i: number) => v + startOffset + slope * (i / (T - 1))
  );
}
