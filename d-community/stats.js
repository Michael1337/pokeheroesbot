import { headers } from "../a-shared/const.js";
import { logMsg, logErr, logLevels } from "../a-shared/logger.js";
import { delay, removeWhitespace } from "../a-shared/utils.js";
import { sendGotify } from "../a-shared/gotify.js";

const tag = "STATS";

// TODO: Only important stats is pokedex: https://pokeheroes.com/pokedex
// Also, this wasn't updated for a long time and probabaly doesn't work anymore anyways.

// Generic extractor function
const extract = (html, regex, groupName, processor = (v) => v) => {
  const match = html.match(regex);
  return match?.groups?.[groupName] ? processor(match.groups[groupName]) : null;
};

// Specific data extractors
const getLevel = (html) => extract(html, />Level: (?<level>\d+)</, "level", Number);
const getTP = (html) => extract(html, /"Trainerpoints: (?<tp>\d+\/\d+)">/, "tp");
const getMoney = (html) =>
  extract(html, /"userbar_pd">(?<money>\d{1,3}(?:,\d{3})*|\d+)</, "money", (v) => v.replace(/,/g, ""));
const getInts = (html) =>
  extract(html, /Total interactions:<\/b>(?<interactions>.*)<br>/, "interactions", removeWhitespace);

const getParty = (html) => {
  const regex = /<td>(?<name>[^<]+)<\/td>\s*<td>\s*<b>(?<level>[^<]+)<\/b>\s*<\/td>\s*<td>(?<exp>[^<]+)<\/td>/g;
  return [...html.matchAll(regex)].map((match) => match.groups);
};

const getRanks = (html) => {
  const regex = new RegExp(
    `${process.env.APP_USERNAME}</i>\\s*</a>\\s*</td>\\s*<td style='text-align: right'>(?<rank>.*?)</td>\\s*</tr>\\s*</table>`,
    "g",
  );
  return [...html.matchAll(regex)].map((match) => match.groups.rank?.trim());
};

const getStats = (html) => {
  const regexes = {
    // Pokémon & Eggs
    eggsHatched: /<b>Eggs hatched:<\/b>\s*(?<eggsHatched>[\d,]+)/,
    adoptedLabEggs: /<b>Adopted lab eggs:<\/b>\s*(?<adoptedLabEggs>[\d,]+)/,
    adoptedDaycareEggs: /<b>Adopted daycare eggs:<\/b>\s*(?<adoptedDaycareEggs>[\d,]+)/,
    caughtBeach: /<b>Pokémon caught at the Beach:<\/b>\s*(?<caughtBeach>[\d,]+)/,

    // Interacting
    totalInteractions: /<b>Total interactions:<\/b>\s*(?<totalInteractions>[\d,]+)/,
    berriesFed: /<b>Berries fed:<\/b>\s*(?<berriesFed>[\d,]+)/,

    // Game Center
    coinflips: /<b>Coinflips:<\/b>\s*(?<coinflips>[\d,]+)/,
    concentrationMatchedPairs: /<b>Concentration matched pairs:<\/b>\s*(?<concentrationMatchedPairs>[\d,]+)/,
    boughtLotteryTickets: /<b>Bought lottery tickets:<\/b>\s*(?<boughtLotteryTickets>[\d,]+)/,
    higherOrLowerAttempts: /<b>Higher or Lower attempts:<\/b>\s*(?<higherOrLowerAttempts>[\d,]+)/,
    higherOrLowerCorrectGuesses: /<b>Higher or Lower correct guesses:<\/b>\s*(?<higherOrLowerCorrectGuesses>[\d,]+)/,
    solvedHangmen: /<b>Solved hangmen:<\/b>\s*(?<solvedHangmen>[\d,]+)/,
    openedTreasureBoxes: /<b>Opened treasure boxes:<\/b>\s*(?<openedTreasureBoxes>[\d,]+)/,
    spentGoldenGameChips: /<b>Spent Golden Game Chips:<\/b>\s*(?<spentGoldenGameChips>[\d,]+)/,

    // Rumbling
    completedRumbleMissions: /<b>Completed rumble missions:<\/b>\s*(?<completedRumbleMissions>[\d,]+)/,

    // Berry Garden
    harvestedBerries: /<b>Harvested berries:<\/b>\s*(?<harvestedBerries>[\d,]+)/,
    wateredPlants: /<b>Watered plants:<\/b>\s*(?<wateredPlants>[\d,]+)/,
    producedSeeds: /<b>Produced seeds:<\/b>\s*(?<producedSeeds>[\d,]+)/,
    cookedProducts: /<b>Cooked products:<\/b>\s*(?<cookedProducts>[\d,]+)/,

    // Miscellaneous
    setUpAuctions: /<b>Set up auctions:<\/b>\s*(?<setUpAuctions>[\d,]+)/,
    royalTunnelAttempts: /<b>Royal Tunnel attempts:<\/b>\s*(?<royalTunnelAttempts>[\d,]+)/,
    royalTunnelCorrectAnswers: /<b>Royal Tunnel correct answers:<\/b>\s*(?<royalTunnelCorrectAnswers>[\d,]+)/,
  };

  return Object.entries(regexes).reduce((stats, [key, pattern]) => {
    stats[key] = extract(html, pattern, key, (v) => v.replace(/,/g, ""));
    return stats;
  }, {});
};

function getStatsNotifications() {
  return fetch("https://pokeheroes.com/includes/ajax/notifications/load_stats.php", {
    headers: headers,
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function getStatsProfile() {
  return fetch(`https://pokeheroes.com/userprofile?name=${process.env.APP_USERNAME}`, {
    headers: headers,
    referrer: "https://pokeheroes.com",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function getStatsRanks() {
  return fetch(`https://pokeheroes.com/ranklist`, {
    headers: headers,
    referrer: "https://pokeheroes.com",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function getStatsStats() {
  return fetch(`https://pokeheroes.com/stats`, {
    headers: headers,
    referrer: "https://pokeheroes.com",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

async function handleStats() {
  while (true) {
    try {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();

      // Get stats from /userprofile
      const responseProfile = await getStatsProfile();
      const htmlProfile = await responseProfile.text();
      const level = getLevel(htmlProfile);
      const trainerpoints = getTP(htmlProfile);
      const pokedollars = getMoney(htmlProfile);
      const interactions = getInts(htmlProfile);
      const party = getParty(htmlProfile);

      // Get stats from /ranklist
      const responseRanks = await getStatsRanks();
      const htmlRanks = await responseRanks.text();
      const ranks = getRanks(htmlRanks);
      if (hours === 0 && minutes === 0) {
        logMsg(
          tag,
          logLevels.Interesting,
          `Level: [${level}] ([${trainerpoints}]); Money: [${pokedollars}]; Ints (Total): [${interactions}]`,
        );
        logMsg(
          tag,
          logLevels.Interesting,
          // eslint-disable-next-line no-magic-numbers
          `Ints (30): [${ranks[0]}]; Ints (Ever): [${ranks[1]}]; Berries Fed: [${ranks[2]}]; Pokémons: [${ranks[3]}]; Pokédex: [${ranks[4]}]; Eggs Hatched: [${ranks[5]}]; Eggdex: [${ranks[6]}]; Time: [${ranks[8]}]; HoL: [${ranks[10]}]`,
        );
      }

      // Get stats from /stats
      const responseSsats = await getStatsStats();
      const htmlStats = await responseSsats.text();
      const stats = getStats(htmlStats);
      const decimals = 2;
      const logEveryXHours = 2;
      const logEveryXMinutes = 10;
      if (hours % logEveryXHours === 0 && minutes === 0) {
        logMsg(
          tag,
          logLevels.Interesting,
          `Adopted: [${stats.adoptedLabEggs}]; Hatched: [${stats.eggsHatched}]; Interacted: [${stats.totalInteractions}]; Fed: [${stats.berriesFed}]; Rumble Missions: [${stats.completedRumbleMissions}]`,
        );
        logMsg(
          tag,
          logLevels.Interesting,
          `Flips: [${stats.coinflips}]; Pairs: [${stats.concentrationMatchedPairs}]; Tickets: [${stats.boughtLotteryTickets}]; HoL Attempts: [${stats.higherOrLowerAttempts}]; HoL Correct: [${stats.higherOrLowerCorrectGuesses}]; HoL Average: [${(stats.higherOrLowerCorrectGuesses / stats.higherOrLowerAttempts).toFixed(decimals)}]; Hangman: [${stats.solvedHangmen}]; Treasure: [${stats.openedTreasureBoxes}]; Golden: [${stats.spentGoldenGameChips}]`,
        );

        party.forEach((pokemon, index) => {
          logMsg(tag, logLevels.Debug, `${index}, [${pokemon.name}]: Level: [${pokemon.level}] ([${pokemon.exp}])`);
        });
      }

      if (minutes % logEveryXMinutes === 0) {
        // Compact log
        logMsg(
          tag,
          logLevels.Valuable,
          logLevels.Interesting,
          `Money: [${pokedollars}]; Ints: [${interactions}]; Hatched: [${stats.eggsHatched}]; Rumble: [${stats.completedRumbleMissions}]; Hangman: [${stats.solvedHangmen}]; Berries: [${stats.harvested}]`,
        );
      }

      if (minutes === 0) {
        // SendGotify(null,`Level: [${level}] ([${trainerpoints}]); Money: [${pokedollars}]; Ints (Total): [${interactions}]`, null);
      }

      await delay(1 * 60 * 1000);
    } catch (error) {
      logErr(tag, ``, error);
      await delay(1 * 60 * 1000);
    }
  }
}

export function doHandleStats() {
  handleStats();
}

export async function getImportantStats() {
  const response = await getStatsNotifications();
  const html = await response.text();
  const interactionsMatch = html.match(
    /<b>Interactions made<\/b>.*?<td style='text-align: right'>(?<interactions>[\d,]+)<\/td>/s,
  );
  const eggsMatch = html.match(/<b>Eggs hatched<\/b>.*?<td style='text-align: right'>(?<eggs>[\d,]+)<\/td>/s);

  const interactionsMade = interactionsMatch ? interactionsMatch.groups.interactions : null;
  const eggsHatched = eggsMatch ? eggsMatch.groups.eggs : null;

  return {
    interactionsMade: interactionsMade,
    eggsHatched: eggsHatched,
  };
}

export async function reportStats() {
  const importantStats = await getImportantStats();
  logMsg(
    tag,
    logLevels.Important,
    `Interactions: ${importantStats.interactionsMade}; Eggs: ${importantStats.eggsHatched}`,
  );
  sendGotify(
    `Pokeheroes Stats`,
    `[${new Date().toLocaleDateString()}] Interactions: ${importantStats.interactionsMade}; Eggs: ${importantStats.eggsHatched}`,
  );
}

// PD, nuggets, bagvalue: https://pokeheroes.com/bagvalue
// Interactions, trainerlevel, trainerpoints, party (names, EXP/EHP): https://pokeheroes.com/userprofile?name=Riako
// Interactions, trainerlevel, trainerpoints, some other stats: https://pokeheroes.com/ranklist
// Stats... https://pokeheroes.com/stats
// Game coins, dream points, beach energy, rumble timer, clicklist unreturned favors
