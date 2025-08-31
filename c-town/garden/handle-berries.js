import { load } from "cheerio";
import { headers, WAIT_TIMES } from "../../a-shared/const.js";
import { logMsg, logErr, logLevels } from "../../a-shared/logger.js";
import { delay } from "../../a-shared/utils.js";
import { getBerryBag, getBerryToCreate, reduceSeedAmount } from "./berries-get-berries.js";
import {
  getSeedBag,
  getSeedToPlant,
  reduceBerryAmount,
  getHighestLevelSeed as getHighestLevelSeeds,
} from "./berries-get-seeds.js";

const tag = "BERRY";
// eslint-disable-next-line no-magic-numbers
const MAKER_SIZES = [75, 50, 20];
// eslint-disable-next-line no-magic-numbers
const GARDEN_SIZES = [24, 60, 96, 27, 1];
const WATERING_BONUS = 0.9;

function collectBerriesFetch(gardenId = 1) {
  return fetch("https://pokeheroes.com/includes/ajax/berrygarden/harvest.php", {
    headers: headers,
    referrer: "https://pokeheroes.com/berrygarden",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: `garden=${gardenId}`,
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

function collectSeedsFetch(makerId = 1) {
  return fetch("https://pokeheroes.com/includes/ajax/berrygarden/claimSeedMaker.php", {
    headers: headers,
    referrer: "https://pokeheroes.com/toolshed",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: `maker=${makerId}`,
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

function waterPlantsFetch(pos = 0, gardenId = 1) {
  return fetch("https://pokeheroes.com/includes/ajax/berrygarden/water.php", {
    headers: headers,
    referrer: "https://pokeheroes.com/berrygarden",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: `id=${pos}&garden=${gardenId}`,
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

function plantSeedFetch(plant = "Cheri", lvl = 1, garden = 1, pos = 0) {
  return fetch("https://pokeheroes.com/includes/ajax/berrygarden/plant.php", {
    headers: headers,
    referrer: "https://pokeheroes.com/berrygarden",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: `plant=${plant}&lvl=${lvl}&garden=${garden}&pos=${pos}`,
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

function checkSeedMakersFetch() {
  return fetch("https://pokeheroes.com/toolshed", {
    headers: headers,
    referrer: "https://pokeheroes.com/berrygarden",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function fillSeedMakerFetch(berries = "Cheri", amount = 1, level = 1, maker = 1) {
  return fetch("https://pokeheroes.com/includes/ajax/berrygarden/fillSeedMaker.php", {
    headers: headers,
    referrer: "https://pokeheroes.com/toolshed",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: `berries=${berries}%2C&amount=${amount}%2C&level=${level}%2C&maker=${maker}`,
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

async function loadGarden(gardenId = 1) {
  return fetch("https://pokeheroes.com/includes/ajax/berrygarden/load_garden.php", {
    headers: headers,
    referrer: "https://pokeheroes.com/berrygarden",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: `garden=${gardenId}`,
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

function getSeedMakerQueuesFromHTML(html) {
  const now = Math.floor(Date.now() / 1000);

  const $ = load(html);
  const productionQueues = [];

  $("[id^=prodQueue]").each((_, prodQueueElem) => {
    const prodQueueDiv = $(prodQueueElem);
    const seedmakerId = parseInt(prodQueueDiv.attr("data-prodid"), 10);

    prodQueueDiv.find(".innerProd .innerinner").each((_, item) => {
      const el = $(item);
      const amountText = el.find(".seedMakerBerryAmount").text();
      const amount = parseInt(amountText, 10);
      const bText = el.find("b").text().trim();
      const name = bText.replace(`${amount}x `, "").trim();

      const levelText = el.find("span").last().text();
      const levelMatch = levelText.match(/Berry Level:\s*(?<level>\d+)/i);
      const level = parseInt(levelMatch?.groups?.level, 10) || 0;

      const finishTimestamp = parseInt(el.find(".prodProgress").attr("data-finish"), 10);

      const remainingSeconds = Math.max(0, finishTimestamp - now);

      productionQueues.push({
        seedmakerId,
        amount,
        name,
        level,
        finishTimestamp,
        remainingSeconds,
      });
    });
  });
  return productionQueues;
}

function findLatestFinishForSeedmaker(queues, seedmakerId) {
  const filteredQueues = queues.filter((q) => q.seedmakerId === seedmakerId);

  const maxRemaining = filteredQueues.reduce(
    (max, item) => (item.remainingSeconds > max ? item.remainingSeconds : max),
    0,
  );

  return maxRemaining;
}

async function handleSeedMaker(makerId = 1) {
  while (true) {
    try {
      await collectSeedsFetch(makerId);

      let berryBag = await getBerryBag();
      if (berryBag === null) {
        logErr(tag, `berry empty`, berryBag);
        await delay(WAIT_TIMES.FIVE_MINUTES);
        continue;
      }

      const seedBag = await getSeedBag();
      if (seedBag === null) {
        logErr(tag, `seed empty`, seedBag);
        await delay(WAIT_TIMES.FIVE_MINUTES);
        continue;
      }

      const html = await (await checkSeedMakersFetch()).text();
      const queues = getSeedMakerQueuesFromHTML(html);
      // Console.log(queues);

      const earliestSeedmaker = findLatestFinishForSeedmaker(queues, makerId);

      logMsg(
        tag,
        logLevels.Interesting,
        `Waiting [${earliestSeedmaker}] seconds for seed maker [${makerId}] to finish.`,
      );
      if (earliestSeedmaker > 0) {
        // TODO: Maybe do check more often to collect ready seeds and prevent other seed makers not knowing about them?
        // Or do separat function just trying to collect seeds. Same for watering plants maybe.
        await delay((earliestSeedmaker + 1) * 1000);
        continue;
      }

      const highLevelSeeds = getHighestLevelSeeds(seedBag); // Only make seeds out of berries that are at least this level.
      const amount = 3; // Batch size for better performance / fewer requests
      const maximumInMaker = 9; // Total berries to process at a time

      let currentInMaker = 0;

      while (currentInMaker < maximumInMaker) {
        const berry = getBerryToCreate(berryBag, highLevelSeeds);
        if (!berry || berry.level === 0) break; // No berry to process

        let amountProcessable = amount <= berry.amount ? amount : berry.amount;
        if (currentInMaker + amountProcessable > maximumInMaker) {
          amountProcessable = maximumInMaker - currentInMaker;
        }

        berryBag = reduceSeedAmount(berryBag, berry, amountProcessable);

        await fillSeedMakerFetch(berry.berry, amountProcessable, berry.level, makerId);

        logMsg(
          tag,
          logLevels.Interesting,
          `Seedmaker [${berry.berry}] plant of level [${berry.level}] with an amount of [${amountProcessable}/${berry.amount}] in [${makerId}].`,
        );

        currentInMaker += amountProcessable;
      }
    } catch (error) {
      logErr(tag, ``, error);
      await delay(WAIT_TIMES.FIVE_MINUTES);
    }
  }
}

// Function to collect berries from a garden
async function handleGarden(gardenId = 1) {
  while (true) {
    try {
      await collectBerriesFetch(gardenId);
      logMsg(tag, logLevels.Debug, `Harvested berries of garden [${gardenId}].`);

      // Refill garden
      const html = await (await loadGarden(gardenId)).text();

      if (!html.includes("zoomBerrygarden")) return; // TODO: Premium, check how we can determin if it is NOT available

      const matches = [
        ...html.matchAll(
          /addPlant\('(?<name>[^']+)',\s*(?<level>\d+),\s*(?<pos>\d+),\s*(?<timeStart>\d+),\s*(?<timeFinish>\d+),\s*'(?<dryness>[^']*)',\s*(?<fertilizer>\d+)\);/g,
        ),
      ];

      const now = Math.floor(Date.now() / 1000);
      const occupiedPositions = matches.map((match) => {
        const timeStart = parseInt(match.groups.timeStart, 10);
        const timeFinish = parseInt(match.groups.timeFinish, 10);
        const timeRemaining = Math.min(3600, timeFinish - now); // Wait an hour at max to water plants regularly.
        // TODO: Could also do a separate watering function running every ten minutes.

        return {
          name: match.groups.name ?? "",
          level: parseInt(match.groups.level, 10),
          pos: parseInt(match.groups.pos, 10),
          timeStart,
          timeFinish,
          timeRemaining,
          dryness: match.groups.dryness ?? "",
          fertilizer: parseInt(match.groups.fertilizer, 10),
        };
      });

      let seedBag = await getSeedBag();
      for (let pos = 0; pos < GARDEN_SIZES[gardenId - 1]; pos++) {
        const plant = occupiedPositions.find((p) => p.pos === pos);
        if (plant) {
          if (plant.dryness === "dry") {
            logMsg(
              tag,
              logLevels.Debug,
              `Position [${pos}] of garden [${gardenId}] is occupied and [${plant.dryness}]. Watering now!`,
            );
            waterPlantsFetch(pos, gardenId); // Reduces the remaining time by 10 %.
            plant.timeRemaining = Math.ceil(plant.timeRemaining * WATERING_BONUS);
            continue;
          }
        } else {
          const seed = await getSeedToPlant(seedBag, gardenId);
          if (!seed) continue;
          seedBag = reduceBerryAmount(seedBag, seed);
          logMsg(
            tag,
            logLevels.Debug,
            `Planting [${seed.berry}] plant of level [${seed.level}] with an amount of [${seed.amount}] in [${gardenId}] at [${pos}].`,
          );

          const html = await (await plantSeedFetch(seed.berry, seed.level, gardenId, pos)).text();
          const plantedSeedFinish = html.match(/<span class='plantFinishTime'>(?<timeFinish>\d+)<\/span>/);
          if (plantedSeedFinish) {
            const timeFinish = parseInt(plantedSeedFinish?.groups?.timeFinish, 10);
            const timeStart = now;
            const timeRemaining = Math.max(0, Math.ceil((timeFinish - timeStart) * WATERING_BONUS));

            occupiedPositions.push({
              name: seed.berry,
              level: seed.level,
              pos,
              timeStart,
              timeFinish,
              timeRemaining,
              dryness: "dry",
              fertilizer: 0,
            });
            waterPlantsFetch(pos, gardenId);
          }
        }
      }

      const minRemainingTime = occupiedPositions.reduce(
        (min, plant) => (plant.timeRemaining < min ? plant.timeRemaining : min),
        Infinity,
      );

      logMsg(tag, logLevels.Interesting, `Waiting [${minRemainingTime}] seconds in garden [${gardenId}].`);
      await delay(minRemainingTime * 1000);
    } catch (error) {
      logErr(tag, ``, error);
      await delay(WAIT_TIMES.FIVE_MINUTES);
    }
  }
}

export async function handleSeedMakers() {
  try {
    logMsg(tag, logLevels.Interesting, `Collecting and reproducing seeds...`);

    for (let i = MAKER_SIZES.length - 1; i >= 0; i--) {
      // Start with last seed maker because it is the fastest.
      handleSeedMaker(i);
    }
  } catch (error) {
    logErr(tag, ``, error);
  }
}

export async function handleGardens() {
  logMsg(tag, logLevels.Interesting, `Harvesting and planting berries...`);
  for (let i = 1; i <= GARDEN_SIZES.length; i++) {
    handleGarden(i);
  }
}
