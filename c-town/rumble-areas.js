import { headers } from "../a-shared/const.js";
import { logMsg, logErr, logLevels } from "../a-shared/logger.js";
import getConfig from "../a-shared/config.js";
import { checkLostItemQuest } from "./rowan-lab/rowan.js";
import { load } from "cheerio";
import { delay } from "../a-shared/utils.js";

const tag = "RUMBLE AREA";

// TODO: In alola and galar, there might be eggs to adopt, so do if(await createSpaceInParty()) then.

const SPECIAL_AREA = 7; // The areas' IDs are dynamic, but everything greater than 6 is a special area.
export const AVAILABLE_EXPLORATION_DURATIONS = {
  FIVE_MINUTES: 5,
  THIRTY_MINUTES: 30,
  SIXTY_MINUTES: 60,
  TWO_HOURS: 120,
  SIX_HOURS: 360,
  TWELVE_HOURS: 720,
};
export const SPECIAL_AREAS = {
  "Mossy Forest": 10,
  "Snowy Mountains": 11,
  Playground: 12,
  "Lightstone Cave": 13,
};
export const HIGH_VALUE_AREAS = {
  Galar: 29,
  Alola: 30,
};
const HIGH_VALUE_AREAS_SET = new Set(Object.values(HIGH_VALUE_AREAS));
const DEFAULT_EXPLORATION_DURATION = AVAILABLE_EXPLORATION_DURATIONS.FIVE_MINUTES; // Five minutes yields most EXP and items in the long run.

async function rumbleOverview() {
  return fetch("https://www.pokeheroes.com/rumble_overview", {
    headers: headers,
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

/**
 * Fetches the Rumble Area page HTML.
 * @returns {Promise<Response>} - A promise that resolves to the response of the fetch request.
 */
async function viewAreas() {
  return fetch("https://pokeheroes.com/rumble_start", {
    headers: headers,
    referrer: "https://pokeheroes.com",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

/**
 * Sends a Pokémon to a specific Rumble Area for a given duration.
 * @param {number} [pkmid=0] - The ID of the Pokémon to send.
 * @param {number} [area=1] - The ID of the Rumble Area to send the Pokémon to.
 * @param {number} [duration=5] - The duration (as a category) for which to send the Pokémon.
 * @returns {Promise<Response>} - A promise that resolves to the response of the fetch request.
 */
export async function sendPokemonToRumble(pkmid = 0, area = 1, duration = DEFAULT_EXPLORATION_DURATION) {
  return fetch("https://pokeheroes.com/includes/ajax/rumble/send.php", {
    headers: headers,
    referrer: "https://pokeheroes.com/rumble_start.php",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: `rumble_pkmn=${pkmid}&area=${area}&duration=${duration}`,
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

/**
 * Retrieves a Pokémon from a Rumble Area.
 * @param {number} pkmnid - The ID of the Pokémon to retrieve.
 * @returns {Promise<Response>} - A promise that resolves to the response of the fetch request.
 */
async function retrieveRumbler(pkmnid) {
  return fetch("https://pokeheroes.com/includes/ajax/rumble/retrieve.php", {
    headers: headers,
    referrer: "https://pokeheroes.com/rumble_overview",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: `pkmnid=${pkmnid}`,
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

async function adoptRecruits(pkmnid, recruits) {
  const params = new URLSearchParams();
  params.append("pkmnid", pkmnid);
  recruits.forEach((id) => params.append("adopt_arr[]", id));

  return fetch("https://pokeheroes.com/includes/ajax/rumble/adopt_recruits.php", {
    headers: headers,
    referrer: "https://pokeheroes.com/rumble_overview",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: params.toString(),
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

fetch("https://pokeheroes.com/includes/ajax/rumble/adopt_recruits.php", {
  headers: {
    accept: "text/html, */*; q=0.01",
    "accept-language": "en-US,en;q=0.9,de-DE;q=0.8,de;q=0.7",
    "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
    priority: "u=1, i",
    "sec-ch-ua": '"Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "x-requested-with": "XMLHttpRequest",
  },
  referrer: "https://pokeheroes.com/rumble_overview",
  body: "pkmnid=47410518&adopt_arr%5B%5D=1553073&adopt_arr%5B%5D=1553074",
  method: "POST",
  mode: "cors",
  credentials: "include",
});

async function evolveRumbler(id = 0) {
  return fetch(`https://www.pokeheroes.com/rumble_evolve?pkmnid=${id}&evolve=true`, {
    headers: headers,
    referrer: "https://www.pokeheroes.com/rumble_overview",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

/**
 * Fetches information about all available Rumble Areas.
 * @async
 * @returns {Array<object>} - An array of Rumble Area objects, or an empty array if an error occurs.
 */
async function getAllAreas() {
  try {
    const html = await (await viewAreas()).text();

    // Define regex to match area information: name, exploration percentage, level and value
    const regex =
      /<div class="area">\s*(?<name>[^<]+?)<br>\s*<span.*?title="(?<percentExplored>[\d.]+)% explored".*?\(Level (?<level>\d+)\).*?value="(?<value>\d+)"/gs;

    // Extract all area matches from the HTML
    const areaMatches = [...html.matchAll(regex)];

    // Transform matches into structured objects
    const areaObjects = areaMatches.map((match) => ({
      name: match.groups.name,
      percentExplored: parseFloat(match.groups.percentExplored),
      level: parseInt(match.groups.level, 10),
      value: parseInt(match.groups.value, 10),
    }));

    return areaObjects; // Returns the Rumble Area objects
  } catch (error) {
    logErr(tag, ``, error);
    return []; // Returns an empty array if an error occurs
  }
}

export async function finishAllRumblers() {
  const html = await (await rumbleOverview()).text();

  const retrieveRegex = /retrieveRumbler\((?<id>\d+)\);/g;
  let match;
  while ((match = retrieveRegex.exec(html)) !== null) {
    await retrieveRumbler(match.groups.id);
  }

  const evolveRegex = /rumble_evolve\?pkmnid=(?<id>\d+)/g;
  while ((match = evolveRegex.exec(html)) !== null) {
    const html = await (await evolveRumbler(match.groups.id)).text();
    const successMatch = html.match(/Congratulations! (?<successMessage>Your .*? evolved into .*?!)/);
    if (successMatch && successMatch.groups) {
      logMsg(tag, logLevels.Valuable, successMatch.groups.successMessage);
    } else {
      logErr(tag, "Error evolving a Pokémon", html);
    }
  }

  // TODO: find href="rumble_boss?pkmnid=47295104" then do rumble_boss?pkmnid=47295104&battle
  // Then something comes back ??? and this is started:
  // fetch("https://www.pokeheroes.com/battle?id=282955", {
  //   "headers": headers,
  //   "referrer": "https://www.pokeheroes.com/rumble_boss?pkmnid=47295104&battle",
  //   "body": null,
  //   "method": "GET",
  //   "mode": "cors",
  //   "credentials": "include"
  // });
  /**
   * In battle:
   fetch("https://www.pokeheroes.com/includes/ajax/battle/perform_move.php?0.8821118211004187", {
      "headers": headers,
      "referrer": "https://www.pokeheroes.com/battle?id=282955",
      "body": "move=a_dragon&battle=282955&prev_timeout=1",
      "method": "POST",
      "mode": "cors",
      "credentials": "include"
    });

    // then some log is being downloaded.
   */
}

/**
 * Handles the logic for sending Pokémon to Rumble Areas and scheduling the next run.
 * @async
 */
export async function handleRumbleArea() {
  try {
    await finishAllRumblers();

    const AVAILABLE_POKEMONS = await getConfig("AVAILABLE_POKEMONS_RUMBLE");
    if (!AVAILABLE_POKEMONS || AVAILABLE_POKEMONS.length === 0) {
      logMsg(tag, logLevels.Debug, "No available Pokémon to send to Rumble Areas.");
      return;
    }

    const availableAreas = await getAllAreas(); // Gathers the data of the rumble areas.
    if (availableAreas.length === 0) {
      // No available areas (because all pokemon are on missions).
      return;
    }

    // Chooses the area with the lowest exploration level and percentage. Only includes areas where everyone can go.
    const leastExploredArea = availableAreas.reduce((lowestArea, currentArea) => {
      if (currentArea.value >= SPECIAL_AREA && !HIGH_VALUE_AREAS_SET.has(currentArea.value)) {
        return lowestArea;
      }

      // Prefer high value areas like Galar.
      const currentIsHighValue = HIGH_VALUE_AREAS_SET.has(currentArea.value);
      const lowestIsHighValue = lowestArea && HIGH_VALUE_AREAS_SET.has(lowestArea.value);
      if (currentIsHighValue && !lowestIsHighValue) {
        return currentArea;
      }
      if (!currentIsHighValue && lowestIsHighValue) {
        return lowestArea;
      }

      // Prefer areas that are least explored.
      if (!lowestArea) {
        return currentArea;
      }

      if (currentArea.level < lowestArea.level) {
        return currentArea;
      }

      if (currentArea.level === lowestArea.level && currentArea.percentExplored < lowestArea.percentExplored) {
        return currentArea;
      }

      return lowestArea;
    }, null);

    // List of the pokemon to send for rumble, where they need to be send and for how long.
    const lostItemQuestArea = await checkLostItemQuest();
    // CHeck Galar, and if available, send there...
    const areaToUse = availableAreas.find((area) => area.name === lostItemQuestArea)?.value || leastExploredArea.value;
    const missions = [
      {
        pkmnid: AVAILABLE_POKEMONS[0],
        area: areaToUse,
        duration: DEFAULT_EXPLORATION_DURATION,
      },
      {
        pkmnid: AVAILABLE_POKEMONS[1],
        area: areaToUse,
        duration: DEFAULT_EXPLORATION_DURATION,
      },
      {
        // eslint-disable-next-line no-magic-numbers
        pkmnid: AVAILABLE_POKEMONS[2],
        area: areaToUse,
        duration: DEFAULT_EXPLORATION_DURATION,
      },
      {
        // eslint-disable-next-line no-magic-numbers
        pkmnid: AVAILABLE_POKEMONS[3],
        area: areaToUse,
        duration: DEFAULT_EXPLORATION_DURATION,
      },
      {
        // eslint-disable-next-line no-magic-numbers
        pkmnid: AVAILABLE_POKEMONS[4],
        area: areaToUse,
        duration: DEFAULT_EXPLORATION_DURATION,
      },
      {
        // eslint-disable-next-line no-magic-numbers
        pkmnid: AVAILABLE_POKEMONS[5],
        area: areaToUse,
        duration: DEFAULT_EXPLORATION_DURATION,
      },
    ];
    // If have applicable pokemon for special mission, do that. Has to be done manually for now.
    // Special missions are only to evolve pokemon, so pertty much completely useless for us.

    for (const mission of missions) {
      const response = await sendPokemonToRumble(mission.pkmnid, mission.area, mission.duration);
      const html = await response.text();

      // eslint-disable-next-line no-negated-condition
      if (!html.includes(":false,")) {
        // If the rumble was started without error.
        const areaToExplore = availableAreas.find((obj) => obj.value === mission.area);
        logMsg(
          tag,
          logLevels.Debug,
          `Sent Pokemon [${mission.pkmnid}] to area [${areaToExplore.name}] ([${areaToExplore.level}/${areaToExplore.percentExplored}%] explored) for [${mission.duration}] minutes.`,
        );
      } else {
        const error = JSON.parse(html).error;
        if (
          error != "You don't have enough exploration bags!" &&
          error != "This Pokemon is currently on a Rumble Mission."
        ) {
          logMsg(
            tag,
            logLevels.Necessary,
            `Can't send Pokemon [${mission.pkmnid}] to area [${mission.area}] for [${mission.duration}] minutes, because [${error}].`,
          );
        }
      }
    }
  } catch (error) {
    logErr(tag, ``, error);
  }
}

function parseTimeToSeconds(timeStr) {
  const secondsPerMinute = 60;
  const secondsPerHour = 3600;
  const hoursPerDay = 24;
  // Handles formats like "HH:MM:SS"
  const hmsMatch = timeStr.match(/(?<hours>\d{1,2}):(?<minutes>\d{2}):(?<seconds>\d{2})/);
  if (hmsMatch && hmsMatch.groups) {
    const { hours, minutes, seconds } = hmsMatch.groups;
    return Math.ceil(
      parseInt(hours, 10) * secondsPerHour + parseInt(minutes, 10) * secondsPerMinute + parseInt(seconds, 10),
    );
  }
  // Handles "In about 1 day" (or anything not convertible)
  return hoursPerDay * secondsPerHour;
}

function getRumbleOverViewFromHTML(html) {
  // TODO: Update for normal rumbles and evolutions
  const $ = load(html);
  const result = [];

  $("#party_field").each((_, el) => {
    const areaText = $(el).find('b:contains("Area:")').parent().text();
    const areaMatch = areaText.match(/Area:\s*(?<name>[^\s(]+)\s*\(Level\s*(?<level>\d+)/);
    const area = areaMatch?.groups?.name;
    const level = parseInt(areaMatch?.groups?.level, 10);

    let returnTimeStr = $(el).find(".return_countdown").text().trim();
    if (!returnTimeStr) {
      // If missing "return_countdown" (like when finished or taking over a day)
      const raw = $(el).html();
      const m = raw.match(/<div style[^>]*><b>Return:<\/b><\/div>(.*?)<div style=/);
      if (m) {
        returnTimeStr = m[1].replace(/<.*?>/g, "").trim();
      }
    }
    const returnSeconds = parseTimeToSeconds(returnTimeStr);

    const collectedMoneyStr = $(el).find('b:contains("Collected money:")').parent().text();
    const moneyMatch = collectedMoneyStr.match(/Collected money:\s*(?<money>\d+)/);
    const collectedMoney = parseInt(moneyMatch?.groups?.money, 10) || 0;

    const bagStr = $(el).find('b:contains("Explorer Bag:")').parent().text();
    const itemsMatch = bagStr.match(/(?<items>\d+) Item/);
    const items = parseInt(itemsMatch?.groups?.items, 10) || 0;

    const recruits = [];
    const recruitsTextMatch = bagStr.match(/Recruits:\s*(?<recruit>.+)$/);
    if (recruitsTextMatch) recruits.push(recruitsTextMatch?.groups?.recruit.trim());

    const idMatch = $(el)
      .attr("class")
      .match(/rumbler_window(?<pkmnid>\d+)/);
    const rumblerId = parseInt(idMatch?.groups?.pkmnid, 10) || null;

    result.push({
      rumblerId,
      area,
      level,
      returnSeconds,
      collectedMoney,
      items,
      recruits,
    });
  });

  return result;
}

// TODO: Heavy work in progress. Do not use as is. Try to finish this code with Galar region unlogged.
export async function handleRumbleAreaB() {
  while (true) {
    const overviewHTML = await (await rumbleOverview()).text();

    const rumbles = getRumbleOverViewFromHTML(overviewHTML);

    // Console.log(rumbles);
    const finished = rumbles.filter((item) => item.returnSeconds === 0);
    for (const rumble of finished) {
      const html = await (await retrieveRumbler(rumble.rumblerId)).text();
      const regex = /value=(?<id>\d+)/g;
      const recruits = [];
      let match;
      while ((match = regex.exec(html)) !== null) {
        recruits.push(parseInt(match.groups.id, 10));
      }

      if (recruits.length > 0) {
        const finished = await (await adoptRecruits(rumble.rumblerId, recruits)).text();
        console.log(finished);
      }
    }
    return;

    // TODO: then, for each pkmn id from config, try to start a rumble as before

    // TODO: Then, get overview again to get the shortest countdown

    const shortestCountdown = rumbles.reduce(
      (min, obj) => (obj.returnSeconds < min.returnSeconds ? obj : min),
      rumbles[0],
    ).returnSeconds;
    logMsg(tag, logLevels.Valuable, `Waiting [${shortestCountdown}] seconds for the next rumble mission to end.`);
    await delay(shortestCountdown * 1000);
  }
}
