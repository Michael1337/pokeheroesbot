import { headers } from "../../a-shared/const.js";
import { logMsg, logErr, logLevels } from "../../a-shared/logger.js";

const tag = "HIGHERLOWER";
const DEFAULT_BET_AMOUNT = 100;
const MINIMUM_STREAK_TO_REPORT = 30;

function startHOL(bet = DEFAULT_BET_AMOUNT) {
  return fetch("https://pokeheroes.com/gc_hol.php", {
    headers: headers,
    referrer: "https://pokeheroes.com/gc_hol",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: `bet=${bet}`,
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

function guessHOL(guess = "lower", round = 1) {
  return fetch(`https://pokeheroes.com/gc_hol?guess=${guess}&round=${round}`, {
    headers: headers,
    referrer: "https://pokeheroes.com/gc_hol.php?",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function getNewNumber(html) {
  const match = html.match(/<span style="font-size: 3em">(?<number>\d+)<\/span>/);
  return match ? parseInt(match.groups.number, 10) : -1;
}

async function playHOLGame(bet = DEFAULT_BET_AMOUNT, reportMinStreak = MINIMUM_STREAK_TO_REPORT) {
  const middleNumber = 6;

  // Start the game once and get initial number
  const startHtml = await (await startHOL(bet)).text();
  let newNumber = getNewNumber(startHtml);

  logMsg(tag, logLevels.Debug, `Started with number [${newNumber}].`);

  let roundsPlayed = 1;
  let lost = false;

  while (!lost) {
    const guess = newNumber < middleNumber ? "higher" : "lower";
    const html = await (await guessHOL(guess, roundsPlayed)).text();

    const gameContinues = html.match(/Okay, so my /);

    if (gameContinues) {
      newNumber = getNewNumber(html);
      logMsg(tag, logLevels.Debug, `Continue against number [${newNumber}].`);
      roundsPlayed++;
    } else {
      lost = true;
      logMsg(tag, logLevels.Debug, `Lost at streak [${roundsPlayed}].`);
      if (roundsPlayed >= reportMinStreak) {
        logMsg(tag, logLevels.Interesting, `Lost at a streak of [${roundsPlayed}].`);
      }
    }
  }

  return roundsPlayed;
}

export function doHigherLower() {
  playHOLGame(DEFAULT_BET_AMOUNT).catch((error) => logErr(tag, "", error));
}

export async function doSomeHoL(targetStreak = 1) {
  let reached = 0;
  while (reached < targetStreak) {
    try {
      const streak = await playHOLGame(DEFAULT_BET_AMOUNT);
      reached = Math.max(reached, streak);
      logMsg(tag, logLevels.Debug, `Game ended with streak ${streak}.`);
    } catch (error) {
      logErr(tag, "Error during Higher or Lower game", error);
      break; // Or continue, depending on your error tolerance
    }
  }
  logMsg(tag, logLevels.Valuable, `Reached target streak ${targetStreak}. Stopping.`);
}
