import * as d3 from "d3-random";
import * as _ from "lodash";

export interface RandomSeriesData {
    returnsData: number[],
    pricesData: number[],
    days: string[]
}

export function calcRandom(mean: number, std: number): RandomSeriesData {
    const normalRNG = d3.randomNormal.source(d3.randomLcg(1251241))(mean, std);

    const returnsData = _.map(_.range(0, 100), normalRNG);

    const pricesData = [100];
    for (let i = 0; i < returnsData.length; i++) {
        pricesData.push(pricesData[pricesData.length - 1] * (1 + returnsData[i]));
    }

    const days = _.map(_.range(0, 100), (v) => "day " + (v + 1));

    return {returnsData, pricesData, days}
}