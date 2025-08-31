import { headers } from "../../a-shared/const.js";
import { logErr } from "../../a-shared/logger.js";
import getConfig from "../../a-shared/config.js";
import { findBerryForOrder } from "./cooking-pot.js";

const tag = "BERRY GARDEN";

function getSeeds() {
  return fetch("https://pokeheroes.com/berrygarden", {
    headers: headers,
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

export function getHighestLevelSeed(seedBag) {
  const highestLevel = {};

  seedBag.forEach((berry) => {
    if (!highestLevel[berry.berry] || berry.level > highestLevel[berry.berry].level) {
      highestLevel[berry.berry] = berry;
    }
  });

  return Object.values(highestLevel);
}

export async function getSeedToPlant(seedBag, gardenId) {
  const firstGardenID = 1;
  const lastGardenID = 4;
  const fastGardenID = 2;
  const slowGardenID = 3;
  const verySlow = 3;
  const slow = 2;
  const medium = 1;
  const fast = 0;
  // Step 0: Get specific berry for special purpose
  // Step 0.1: Get preferred berry for feeding
  const PREFERRED_BERRY = await getConfig("PREFERRED_BERRY");
  if (gardenId === firstGardenID && PREFERRED_BERRY) {
    return seedBag.find((seed) => seed.berry === PREFERRED_BERRY);
  }

  // Step 0.2: Get berry for bulletin board order
  const berryForOrder = await findBerryForOrder();
  if (gardenId === lastGardenID && berryForOrder) {
    const seedForOrder = seedBag.find((seed) => seed.berry === berryForOrder);
    if (seedForOrder) {
      return seedForOrder;
    }
  }

  // Step 1: Reduce seedBack to include berries based on garden and speed
  if (gardenId <= fastGardenID) {
    seedBag = seedBag.filter((seed) => seed.speed === fast || seed.speed === medium);
  }

  if (gardenId == slowGardenID) {
    seedBag = seedBag.filter((seed) => seed.speed === slow || seed.speed === verySlow);
  }

  if (gardenId == lastGardenID) {
    seedBag = seedBag.filter((seed) => seed.speed === fast);
  }

  // On last garden, to only very Fast

  // Step 2: Get only lowest level seeds
  // Step 2.1: Find the minimum level across all seeds
  let minLevel = 100;
  for (let i = 0; i < seedBag.length; i++) {
    if (seedBag[i].level < minLevel) {
      minLevel = seedBag[i].level;
    }
  }

  // Step 2.2: Filter the berries to include only those with the minimum level
  const lowestLevelSeeds = seedBag.filter((seed) => seed.level === minLevel);

  // Step 3: Find the seed with the lowest amount
  const lowestAmountLowestLevelSeed = lowestLevelSeeds.reduce((minSeed, seed) => {
    return seed.amount < (minSeed?.amount || Infinity) ? seed : minSeed;
  }, null);

  return lowestAmountLowestLevelSeed;
}

export function reduceBerryAmount(bag, berry) {
  return bag.reduce((result, item) => {
    if (item.berry === berry.berry && item.level === berry.level) {
      if (item.amount > 1) {
        result.push({ ...item, amount: item.amount - 1 });
      } else {
        // Don't include items with amount 0
      }
    } else {
      result.push(item);
    }
    return result;
  }, []);
}

export async function getSeedBag() {
  const bag = [];

  // eslint-disable-next-line no-unused-vars
  function addSeedToBag(berry, level, amount, speed) {
    // Used by pokeheroes, calls come through GET request
    bag.push({ berry: berry, level: level, amount: amount, speed: speed });
  }
  try {
    const html = await (await getSeeds()).text();
    // AddSeedToBag('Cheri', 1, 20, 0);
    const linesToAddSeedToBag = html.match(/addSeedToBag\(.+?\);/g);

    if (linesToAddSeedToBag) {
      linesToAddSeedToBag.forEach((line) => {
        try {
          eval(line);
        } catch (error) {
          logErr(tag, `Error executing line [${line}]`, error);
        }
      });
    }
    return bag;
  } catch (error) {
    logErr(tag, ``, error);
  }
}
