import { headers } from "../../a-shared/const.js";
import { logErr } from "../../a-shared/logger.js";

const tag = "BERRY SHED";

function getBerries() {
  return fetch("https://pokeheroes.com/includes/ajax/berrygarden/openBerryMover.php", {
    headers: headers,
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

export function getBerryToCreate(bag, highLevelSeeds) {
  const maxSeedsOfHighLevel = 100;

  // Step 0: For each berry type, consider only the berry with the highest level
  const highestLevelBerries = Object.values(
    bag.reduce((acc, berry) => {
      if (!acc[berry.berry] || berry.level > acc[berry.berry].level) {
        acc[berry.berry] = berry;
      }
      return acc;
    }, {}),
  );

  // Step 1: Filter the berries to find only berries where no seeds exists or where only lower level seeds exist
  const berriesToSeed = highestLevelBerries.filter((berry) => {
    const existingSeeds = highLevelSeeds.filter((seed) => seed.berry === berry.berry);

    if (existingSeeds.length === 0) {
      return true;
    }

    const maxSeedLevel = Math.max(...existingSeeds.map((seed) => seed.level));

    if (berry.level < maxSeedLevel) {
      return false;
    }

    const seedsAtThisLevel = existingSeeds.find((seed) => seed.level === berry.level);
    if (seedsAtThisLevel && seedsAtThisLevel.amount >= maxSeedsOfHighLevel) {
      return false;
    }

    return true;
  });

  // Step 2: Consider only berries with the lowest level
  const minLevel = Math.min(...berriesToSeed.map((berry) => berry.level));
  const lowestLevelBerries = berriesToSeed.filter((berry) => berry.level === minLevel);

  // Step 3: From those, pick the one with the lowest amount
  const selectedBerry = lowestLevelBerries.reduce((minBerry, currentBerry) => {
    if (!minBerry || currentBerry.amount < minBerry.amount) {
      return currentBerry;
    }
    return minBerry;
  }, null);

  return selectedBerry;
  // This finally returnes the berry that
  // - has a level that is lower than the highest-level seed of that berry
  // - not already has 100 seeds of the required level
  // - has the lowest berry level among those
}

export function reduceSeedAmount(bag, berry, amount) {
  return bag.reduce((result, item) => {
    if (item.berry === berry.berry && item.level === berry.level) {
      if (item.amount > 1) {
        result.push({ ...item, amount: item.amount - amount });
      }
    } else {
      result.push(item);
    }
    return result;
  }, []);
}

export async function getBerryBag() {
  const bag = [];

  // eslint-disable-next-line no-unused-vars
  function addBerryToBag(berry, level, amount, unknown, unknownB) {
    // Used by pokeheroes, calls come through GET request
    bag.push({ berry: berry, level: level, amount: amount });
  }
  
  // GetBerryLevels...
  try {
    const html = await (await getBerries()).text();

    //AddBerryToBag('Bluk', 1, 100, true, '#seedMakerBerryBag');
    const linesToAddSeedToBag = html.match(/addBerryToBag\(.+?\);/g);
    // This basically copies what pokeheroes does in the browser

    //PrepareBerryInBag('Aguav', '#seedMakerBerryBag', 717);
    //Const linesToAddSeedToBag = html.match(/prepareBerryInBag\(.+?\);/g);
    // This might be necessary as a backup

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
    return null; // If an empty bag is returned, that would potentially lead to unwanted results
  }
}
