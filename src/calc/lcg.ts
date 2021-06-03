// https://en.wikipedia.org/wiki/Linear_congruential_generator#Parameters_in_common_use
// logic mimics D3, but produces processes that are random but have fixed realisation
import { fmap, Process, stateful } from "./processes";

const mul = 0x19660d;
const inc = 0x3c6ef35f;
const eps = 1 / 0x100000000;

export function lcg(seed = Math.random()): Process<number> {
  type El = { state: number; rnd: number };
  return fmap((el: El) => el.rnd)(
    stateful((prev: El) => {
      const state = (mul * prev.state + inc) | 0;
      return { state, rnd: eps * (state >>> 0) };
    })({
      state: (0 <= seed && seed < 1 ? seed / eps : Math.abs(seed)) | 0,
      rnd: NaN,
    })
  );
}
