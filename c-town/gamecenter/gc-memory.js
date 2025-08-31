import { headers, WAIT_TIMES } from "../../a-shared/const.js";
import { logMsg, logErr, logLevels } from "../../a-shared/logger.js";
import getConfig from "../../a-shared/config.js";
import { delay } from "../../a-shared/utils.js";

const tag = "MEMORY";
let _;

/**
 * Fetches the HTML content of the Memory game page for a given board size.
 * @param {number} [boardSize=0] - The size of the Memory game board (0 for default).
 * @returns {Promise<string>} A Promise that resolves to the HTML content of the page.
 */
async function getMemoryFetch(boardSize = 0) {
  return fetch(`https://pokeheroes.com/gc_concentration?d=${boardSize}`, {
    headers: headers,
    referrer: "https://pokeheroes.com/gc_concentration",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

async function flipCardFetch(card = 0) {
  return fetch("https://pokeheroes.com/includes/ajax/game_center/concentration_flip.php", {
    headers: headers,
    referrer: "https://pokeheroes.com/gc_concentration?",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: `card=${card}`,
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

function viewFlippedCard(html) {
  const matchNr = html.match(/pkdxnr">(?<nr>\d+)</);
  const pkdxnr = matchNr ? parseInt(matchNr.groups.nr, 10) : null;
  const matchSucc = html.match(/succ">(?<success>\d+)</);
  const success = matchSucc ? parseInt(matchSucc.groups.success, 10) : false;
  return [pkdxnr, success];
}

/**
 * Attempts to solve the Memory game by flipping cards and matching pairs.
 * @param {number} [boardSize=0] - The size of the Memory game board (0 for default).
 * @returns {Promise<void>}
 */
async function solveMemory(boardSize = 0) {
  const BIG_BOARD_ID = 2;
  const BIG_BOARD_SIZE = 36;
  const MEDIUM_BOARD_SIZE = 32;
  const cardsPerPair = 2;

  const totalCards = boardSize === BIG_BOARD_ID ? BIG_BOARD_SIZE : MEDIUM_BOARD_SIZE;
  const numberOfPairs = totalCards / cardsPerPair;

  const revealedCards = []; // Store pokedex numbers by index
  let html;
  let cardIndex = 0;
  let pairsFound = 0;

  // Loop until all pairs found or run out of cards
  while (pairsFound < numberOfPairs && cardIndex < totalCards) {
    try {
      // Flip first of two cards and store its value and position
      html = await (await flipCardFetch(cardIndex)).text();
      const [currentCardValue, currentSuccess] = viewFlippedCard(html);
      revealedCards[cardIndex] = currentCardValue;

      // Check if we've seen this card's value before
      const prevIndex = revealedCards.indexOf(currentCardValue);

      if (currentSuccess === false && currentCardValue !== undefined) {
        if (prevIndex >= 0 && prevIndex < cardIndex && currentCardValue > 0) {
          // Flip previously seen card to attempt match
          html = await (await flipCardFetch(prevIndex)).text();
          const [_, matchSuccess] = viewFlippedCard(html);
          pairsFound += matchSuccess;
        } else {
          // No previous match attempt; Flip second of two cards
          cardIndex++;
          if (cardIndex >= totalCards) break;
          html = await (await flipCardFetch(cardIndex)).text();
          const [nextCardValue, _] = viewFlippedCard(html);
          revealedCards[cardIndex] = nextCardValue;

          // Check if second card could make a pair
          const nextPrevIndex = revealedCards.indexOf(nextCardValue);
          if (nextPrevIndex >= 0 && nextPrevIndex < cardIndex - 1 && nextCardValue > 0) {
            cardIndex--; // Check again next loop to flip both matching cards
          }
        }
      }
      cardIndex++;
    } catch (error) {
      logErr(tag, `Error in solveMemory loop:`, error);
      await delay(WAIT_TIMES.ONE_MINUTE);
      break; // Exit loop on error safely
    }
  }
}

/**
 * Initiates the Memory game.
 * @returns {Promise<void>}
 */
export async function handleMemory() {
  while (true) {
    try {
      const boardSize = (await getConfig("GC_MEMORY_BOARD_SIZE")) || 0;
      const html = await (await getMemoryFetch(boardSize)).text();

      const pointsExists = html?.match(/concPoints">(?<points>\d+)</);
      const points = pointsExists ? parseInt(pointsExists.groups.points, 10) : null;

      if (html?.includes("<script>location") || points !== null) {
        // Game started or points available
        await solveMemory(boardSize);
        continue;
      }

      const chipsWonExists = html?.match(/Game Chips Won: (?<chips>\S+) </);
      const wonChips = chipsWonExists ? chipsWonExists.groups.chips : null;

      const specialPrizeExists = html?.match(/Special Prize: (?<prize>[^<]+)</);
      const wonSpecialPrize = specialPrizeExists ? specialPrizeExists.groups.prize : null;

      if (wonChips || wonSpecialPrize) {
        logMsg(tag, logLevels.Debug, `Game won for [${wonChips}] chips! Restarting...`);
        if (wonSpecialPrize && !wonSpecialPrize.startsWith("None")) {
          logMsg(tag, logLevels.Valuable, `Special Prize won: [${wonSpecialPrize}]!`);
        }
        continue;
      }

      const timeToWaitExists = html?.match(/Please wait (?<seconds>\d+) more seconds before playing again/);
      const timeToWait = timeToWaitExists ? parseInt(timeToWaitExists.groups.seconds, 10) : null;

      if (timeToWait) {
        logMsg(tag, logLevels.Debug, `Waiting ${timeToWait} seconds before playing again...`);
        await delay(timeToWait * 1000 + WAIT_TIMES.THIRTY_SECONDS);
        continue;
      }

      // Default fallback: no game detected etc.
      logErr(tag, `Something unexpected in playMemory:`, html);
      await delay(WAIT_TIMES.TWO_MINUTES);
    } catch (error) {
      logErr(tag, `Error in playMemory:`, error);
      await delay(WAIT_TIMES.TWO_MINUTES);
    }
  }
}
