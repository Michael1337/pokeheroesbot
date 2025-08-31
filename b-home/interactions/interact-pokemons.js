/* eslint-disable camelcase */
import { headers, WAIT_TIMES } from "../../a-shared/const.js";
import { logMsg, logErr, logLevels } from "../../a-shared/logger.js";
import getConfig from "../../a-shared/config.js";
import { delay } from "../../a-shared/utils.js";
import { shayminEventActive } from "../../e-events/shaymin.js";

const tag = "INTERACTION";
const FEED_MINUTES_PER_HOUR = await getConfig("INT_FEED_MINUTES_PER_HOUR");
const NUMBER_OF_RANDOMS_TO_TRAIN = await getConfig("INT_NUMBER_OF_RAND_TO_TRAIN");
const PERCENTAGE_OF_RANDOMS_TO_TRAIN = await getConfig("INT_PERCENT_OF_RAND_TO_TRAIN");

async function getSCS() {
  return fetch("https://pokeheroes.com/scs", {
    headers: headers,
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function secondsUntilNextEvenHour() {
  const now = new Date();
  let nextHour = now.getHours() + 1;
  const even = 2;

  if (nextHour % even !== 0) {
    nextHour += 1;
  }

  const nextEvenHour = new Date(now);
  nextEvenHour.setHours(nextHour, 0, 0, 0);

  const diffMilliseconds = nextEvenHour - now;
  return Math.round(diffMilliseconds / 1000);
}

export async function getSecondsToSCS() {
  const html = await (await getSCS()).text();
  const isToday = html.includes("It's Speed Click Saturday today!");
  if (!isToday) return null;

  const secondsToSCSHour = secondsUntilNextEvenHour();

  const oneHour50Minutes = 6600;
  const waitTimeInSCS = 0.8;

  if (secondsToSCSHour > oneHour50Minutes) {
    return waitTimeInSCS;
  } else {
    return secondsToSCSHour;
  }
}

async function getDesiredInteractionsPerDay() {
  let result;

  if (await shayminEventActive()) {
    // TODO: Also check for other events like zerora
    result = await getConfig("INT_DESIRED_PER_DAY_EVENT");
  }

  if (!result) {
    const defaultValue = await getConfig("INT_DESIRED_PER_DAY");

    if (defaultValue) {
      result = defaultValue;
    } else {
      throw new Error("INT_DESIRED_PER_DAY is not defined in the config.");
    }
  }

  return result;
}

async function calculateInteractionTiming() {
  // If a SCS is ongoing, wait until the next ten minute slot and then do interactions every two seconds for those ten minutes.
  // This will result in 27*(600/2)*12 = 97200 interactions on that day, on average.
  const secondsToSCS = await getSecondsToSCS();
  if (secondsToSCS !== null) {
    logMsg(tag, logLevels.Interesting, `SCS ongoing! Waiting [${secondsToSCS}] seconds before clicking again.`);
    return secondsToSCS;
  }
  // If not SCS, evenly split all interactions in 27-interactions chunks
  const secondsPerDay = 86400; // Total seconds in a day
  const clicksPerBatch = 27; // Average number of Pokémon in a clicklist (~25-30)

  const DESIRED_INTERACTIONS_PER_DAY = await getDesiredInteractionsPerDay();
  const batchesPerDay = DESIRED_INTERACTIONS_PER_DAY / clicksPerBatch;
  const SECONDS_BETWEEN_INTERACTIONS = secondsPerDay / batchesPerDay;

  return SECONDS_BETWEEN_INTERACTIONS; // Return the calculated timing
}

async function getUnreturnedFavors() {
  const response = await fetch("https://pokeheroes.com/clicklist", {
    headers: headers,
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
  const html = await response.text();
  const match = html.match(
    /<td>Unreturned Favors<\/td>\s*<td><a href="pokemon_lite\?cl_type=unreturned">Start<\/a><\/td>\s*<td>(?<number>[\d,]+)<\/td>/,
  );

  if (match) {
    // Remove commas from the number string and parse it as an integer
    const interactions = parseInt(match.groups.number.replace(/,/g, ""), 10);
    return interactions;
  } else {
    return 0;
  }
}

async function getDailyInteractions() {
  const response = await fetch("https://pokeheroes.com/includes/ajax/notifications/load_stats.php", {
    headers: headers,
    referrer: "https://pokeheroes.com/notifications",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
  const html = await response.text();
  const match = html.match(
    /<b>Interactions made<\/b>\s*<\/td>\s*<td style='text-align: right'>(?<interactions>[\d,]+)<\/td>/,
  );

  if (match) {
    // Remove commas from the number string and parse it as an integer
    const interactions = parseInt(match.groups.interactions.replace(/,/g, ""), 10);
    return interactions;
  } else {
    return 0;
  }
}

/**
 * Fetches the berry bag for a given click list type.
 * @param {string} [clType="unreturned"] - The click list type.
 * @returns {Promise<Response>} - The response from the fetch request.
 */
async function getBerryBagFetch(clType = "newest") {
  const url = `https://pokeheroes.com/pokemon_lite?cl_type=${clType}`;
  const referrer = `https://pokeheroes.com`;

  return fetch(url, {
    headers: headers,
    referrer: referrer,
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

/**
 * Fetches the click list for a given click list type.
 * @param {string} [clType="newest"] - The click list type.
 * @returns {Promise<Response>} - The response from the fetch request.
 */
async function getClickListFetch(clType = "newest") {
  const url = `https://pokeheroes.com/includes/ajax/pokemon/load_clicklist?cl_type=${clType}`;
  const referrer = `https://pokeheroes.com/pokemon_lite?cl_type=${clType}`;

  return fetch(url, {
    headers: headers,
    referrer: referrer,
    referrerPolicy: "strict-origin-when-cross-origin",
    body: `type=${clType}&inarow=0&ret=clicklist%3Ferr%3Ddone`,
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

/**
 * Interacts with a Pokémon.
 * @param {string} [clType="newest"] - The click list type. Newest always works and rarely requires berries.
 * @param {number} [pkmnid=0] - The Pokémon ID.
 * @param {number} [pkmnsid=0] - The Pokémon secondary ID.
 * @param {boolean} [egg=true] - Whether the Pokémon is an egg.
 * @param {string} [berry="Oran+Berry"] - The berry to use. Oran Berry is cheapest berry that works for all pokemon.
 * @returns {Promise<Response>} - The response from the fetch request.
 */
async function interactPokeFetch(clType = "newest", pkmnid = 0, pkmnsid = 0, egg = true, berry = "Oran+Berry") {
  // Inarow = Integer of how many interactions were made in a row. should go up to 30 or even higher I think.

  /**
   * From wiki:
   * There are two ways of interacting with a Pokémon.
   * Training: Training will award experience to the Pokémon and possibly boost a random stat.
   * Feeding: Feeding will award more experience to the Pokémon than training would do. The chances of finding  Pokédollar and Golden Game Chips are higher than when training.
   * Note that you can feed Pokémon only if you own berries in your inventory and that the berry will be expended once the interaction is made.
   */
  const minutesOfTheHour = new Date().getMinutes();

  const method = egg ? "warm" : minutesOfTheHour < FEED_MINUTES_PER_HOUR ? "feed" : "train";

  const url = `https://pokeheroes.com/includes/ajax/pokemon/lite_interact.php`;
  const referrer = `https://pokeheroes.com/pokemon_lite?cl_type=${clType}`;

  return fetch(url, {
    headers: headers,
    referrer: referrer,
    referrerPolicy: "strict-origin-when-cross-origin",
    body: `pkmnid=${pkmnid}&pkmnsid=${pkmnsid}&method=${method}&berry=${berry}&timeclick=${Date.now()}&inarow=1`,
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

async function getClicklistType() {
  const unreturnedFavors = await getUnreturnedFavors();
  const clicklistLength = 30;
  logMsg(tag, logLevels.Debug, `[${unreturnedFavors}] unreturned favors left.`);
  if (unreturnedFavors > clicklistLength) {
    return "unreturned";
  }

  const dailyInteractions = await getDailyInteractions();
  logMsg(tag, logLevels.Debug, `[${dailyInteractions}] interactions made today.`);

  if (dailyInteractions % (NUMBER_OF_RANDOMS_TO_TRAIN * PERCENTAGE_OF_RANDOMS_TO_TRAIN) < NUMBER_OF_RANDOMS_TO_TRAIN) {
    // For every 10 interactions, do 1 for the random list, which will likely include feeding berries
    return "random";
  }

  return "newest";
}

/**
 * Gets the berry bag.
 * @returns {Promise<Array<any>|null>} - The berry bag as an array of arrays, or null if an error occurs.
 */
async function getBerryBag() {
  const berry_bag = [];

  try {
    const response = await getBerryBagFetch();
    const html = await response.text();

    //Berry_bag.push(new Array('Spelon Berry', 2, 'Spicy'));
    const linesToAddBerriesToBag = html.match(/berry_bag\.push\(.+?\);/g);
    // This basically copies what pokeheroes does in the browser
    if (linesToAddBerriesToBag) {
      linesToAddBerriesToBag.forEach((line) => {
        try {
          eval(line);
        } catch (error) {
          logErr(tag, `Error executing line [${line}]`, error);
        }
      });
    }
    return berry_bag;
  } catch (error) {
    logErr(tag, ``, error);
    return null; // If an empty bag is returned, that would potentially lead to unwanted results
  }
}

/**
 * Gets a berry that meets the given taste and has the highest stock.
 * @param {string} preferredTaste - The taste to search for.
 * @returns {Promise<string>} - The name of the berry, or an empty string if no berry is found.
 */
async function getBerry(berryBag, preferredTaste) {
  if (!berryBag) {
    return ""; // Return empty string if berry bag is null
  }
  let tmpStock = 0;
  let tmpBerry = "";
  const nameIndex = 0;
  const amountIndex = 1;
  const tasteIndex = 2;
  for (let i = 0; i < berryBag.length; i++) {
    if (berryBag[i][tasteIndex] == preferredTaste || preferredTaste == "Mild") {
      if (berryBag[i][amountIndex] > 0) {
        if (tmpStock < berryBag[i][amountIndex]) {
          tmpStock = berryBag[i][amountIndex];
          tmpBerry = berryBag[i][nameIndex];
        }
      }
    }
  }
  return tmpBerry;
}

/**
 * Clicks through a list of Pokémon.
 * @param {Array<Array<any>>} clicklist - The list of Pokémon to click.
 * @returns {Promise<boolean>} - A promise that resolves to true if the interaction limit is reached, false otherwise.
 */
async function clickPokes(clType, clicklist) {
  let money = 0;
  let interactionLimitReached = false;
  try {
    const berry_bag = await getBerryBag();

    await Promise.all(
      clicklist.map(async (poke) => {
        const [pkmnid, pkmnsid, egg, taste] = poke;
        const berry = await getBerry(berry_bag, taste);

        try {
          const response = await interactPokeFetch(clType, pkmnid, pkmnsid, egg, berry);
          const html = await response.text();
          const match = html.match(/setPokedollarBalance\((?<dollars>\d+)\);/);
          money = match ? match.groups.dollars : 0;

          if (html.includes("You have reached the maximum amount of interactions today")) {
            interactionLimitReached = true;
          }
        } catch (error) {
          logErr(tag, `1`, error);
        }
      }),
    );

    const loggingThrsholdA = 100;
    const loggingThrsholdB = 5;
    if (money % loggingThrsholdA <= loggingThrsholdB)
      logMsg(tag, logLevels.Debug, `Money after clicking through list: [${money}]`);
    // %100 <= 5 means: only if the last two digits are between 00 and 05.
    return interactionLimitReached;
  } catch (error) {
    logErr(tag, `2`, error);
    return false;
  }
}

/**
 * Interacts with Pokémon on the site.
 */
export async function interactWithPokemons() {
  while (true) {
    logMsg(tag, logLevels.Debug, `Getting new list of Pokemons.`);
    try {
      const clType = await getClicklistType();
      logMsg(tag, logLevels.Debug, `Interacting with list [${clType}].`);
      const response = await getClickListFetch(clType);
      const html = await response.text();

      const responseHtml = html
        .replace("<script>", "")
        .replace("displayCheatValidator();", "")
        .replace("</script>", "");
      if (!html.includes("pkmn_arr")) {
        await delay(WAIT_TIMES.ONE_MINUTE);
        continue;
      }
      const pkmn_arr = [];
      eval(responseHtml);
      // Pokemon = pkmn_arr.push(new Array("1007046","30134","1","93,596/112,884","Rare","<a href='userprofile?name=EpicFailure'>EpicFailure</a>","<a href='userprofile?name=Whale'>Whale</a>","10 Years and 6 Months ago","Adopted from the Lab","Salamence","Salamence","Salamence","<i>No item</i>","173","373","m","10 Years and 6 Months ago","Sa-Sa-Salamence","Dry","poke","//staticpokeheroes.com/img/pokemon/img.php?c=0373"));
      // Egg = ...
      const maxArrLengthIfEgg = 12;
      const tasteId = 18;
      const clicklist = pkmn_arr.map((innerArray) => {
        const pkmnid = innerArray[0];
        const pkmnsid = innerArray[1];
        const isEgg = innerArray.length <= maxArrLengthIfEgg;
        const taste = innerArray[tasteId] || "Mild";

        return [pkmnid, pkmnsid, isEgg, taste];
      });

      const interactionLimitReached = await clickPokes(clType, clicklist);

      if (interactionLimitReached) {
        logMsg(tag, logLevels.Interesting, `It seems we can't interact anymore, waiting 1 hour...`);
        await delay(WAIT_TIMES.SIXTY_MINUTES);
        continue;
      } else {
        const SECONDS_BETWEEN_INTERACTIONS = await calculateInteractionTiming();
        logMsg(tag, logLevels.Debug, `Waiting ${SECONDS_BETWEEN_INTERACTIONS} seconds before interacting again...`);
        await delay(SECONDS_BETWEEN_INTERACTIONS * 1000);
        continue;
      }
    } catch (error) {
      logErr(tag, `3`, error);
      await delay(WAIT_TIMES.TWO_MINUTES);
      continue;
    }
  }
}
