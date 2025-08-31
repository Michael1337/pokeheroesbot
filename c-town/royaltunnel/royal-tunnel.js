import fs from "fs";
import { headers, WAIT_TIMES } from "../../a-shared/const.js";
import { logMsg, logErr, logLevels } from "../../a-shared/logger.js";
import { delay } from "../../a-shared/utils.js";
import { handlePuzzle } from "../../b-home/puzzle.js";
import { sendMail } from "../../a-shared/email.js";

//TODO: Wait until this is updated: https://www.pokeheroes.com/forum_thread?id=99131
// Sometimes, new Pokemon are added to the game that are not yet in this Pokedex. In that case, add them manually.
// Also, check this out for move evos: https://wiki.pokeheroes.com/wiki/Evolving_Pokemon

// TODO: If we ever are allowed to get regis again, check for full party befor every 100(0) levels and if(await createSpaceInParty()) before answering.

const tag = "ROYAL TUNNEL";
const ANSWER_DELAY = 500;
const pokedex = JSON.parse(fs.readFileSync("./b-home/pokedex/pokedex.json", "utf-8"));

const FINAL_LEVELS = {
  beginner: 20,
  advanced: 50,
  pro: 100,
  split: 250,
};

function startTunnel(type = "beginner") {
  return fetch(`https://pokeheroes.com/royal_tunnel?start=${type}`, {
    headers: headers,
    referrer: "https://pokeheroes.com/royal_tunnel",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function viewTunnel() {
  return fetch("https://pokeheroes.com/royal_tunnel", {
    headers: headers,
    referrer: "https://pokeheroes.com/royal_tunnel",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function continueTunnel() {
  return fetch("https://pokeheroes.com/royal_tunnel?cont", {
    headers: headers,
    referrer: "https://pokeheroes.com/royal_tunnel",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function answerTunnel(ans = 1, level = 1) {
  return fetch(`https://pokeheroes.com/royal_tunnel?ans=${ans}&level=${level}`, {
    headers: headers,
    referrer: "https://pokeheroes.com/royal_tunnel",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

/**
 * Compares two array to check if they have the same elements in the same order.
 * @param {array} a First array.
 * @param {array} b Second ARray.
 * @returns True if both arrays have the same elements in the same order. Otherwise false.
 */
function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Determines the correct Pokemon based on the question in the HTML.
 * @param {string} html - The HTML content of the tunnel question page.
 * @returns {[number, number]} An array containing:
 *   - The index of the correct Pokemon in the candidates array.
 *   - The Pokedex number of the correct Pokemon.
 */
function getCorrectPokemon(html) {
  // Get the three cadidate Pokemons from their images.
  const regexPattern = /\/bw_front\/(?<pokemonNumber>\d+)\.png/g;
  const matches = [...html.matchAll(regexPattern)];
  const candidates = matches.map((match) => parseInt(match.groups.pokemonNumber, 10));
  const pkdx = pokedex.filter((pokemon) => candidates.includes(pokemon.number));

  let pokemon;

  if (html.includes("Which of these is a ")) {
    const regex = /<img src="\/\/staticpokeheroes\.com\/?img\/type_icons\/(?<type>\w+)\.gif"/g;
    const types = [];
    let match;
    while ((match = regex.exec(html)) !== null) {
      types.push(match.groups.type.trim());
    }
    pokemon = pkdx.find((pokemon) => {
      return arraysEqual(pokemon.types, types);
    });
  } else if (html.includes("considered as a")) {
    const regex = /<b>(?<species>.*?)<\/b>-Pokémon/;
    const species = html.match(regex).groups.species.trim();
    pokemon = pkdx.find((pokemon) => pokemon.species === species);
  } else if (html.includes(" Entry:")) {
    const regex = /<b>PokéDex Entry:<\/b>\s*(?<entry>.*?)\s*</;
    const entry = html.match(regex).groups.entry.trim();
    pokemon = pkdx.find((pokemon) => {
      // Check if a pokedex entry matches the question of given the Pokemon name instead of the placeholder asterisks.
      const modifiedEntry = entry.replace(/\*+/g, pokemon.name);

      // Remove apostrophes from both strings before comparing since sources may use different ones
      const cleanModified = modifiedEntry.replace(/['’]/g, "");
      const cleanDescription = pokemon.description.replace(/['’]/g, "");

      return cleanModified === cleanDescription;
    });
  } else if (html.includes("egggroup(s)")) {
    const regex = /"<i>(?<egggroup>.*?)<\/i>"/g;
    const egggroups = [];
    let match;
    while ((match = regex.exec(html)) !== null) {
      egggroups.push(match.groups.egggroup.trim());
    }
    pokemon = pkdx.find((pokemon) => {
      return arraysEqual(pokemon.egggroups, egggroups);
    });
  } else if (html.includes("these needs ")) {
    const regex = /<b>(?<steps>[\d,]+)\sSteps\/EHP<\/b>/;
    const steps = parseInt(html.match(regex).groups.steps.trim().replace(",", ""), 10);
    pokemon = pkdx.find((pokemon) => pokemon.EHP === steps);
  } else if (html.includes("evolves when")) {
    const regex = /<b>Level (?<level>\d+)<\/b>/;
    const level = parseInt(html.match(regex).groups.level.trim(), 10);
    pokemon = pkdx.find((pokemon) => pokemon.evolution === level);
  } else if (html.includes("heaviest")) {
    pokemon = pkdx.reduce((heaviest, current) => {
      return current.weight > heaviest.weight ? current : heaviest;
    });
  } else if (html.includes("largest")) {
    pokemon = pkdx.reduce((heaviest, current) => {
      return current.height > heaviest.height ? current : heaviest;
    });
  } else {
    console.log(html);
    console.log("NO QUESTION FOUND");
  }

  if (pokemon == undefined) {
    logErr(tag, "Royal Tunnel HIGHEST", html);
    // Return highest number Pokemon as it was likely added recently and thus was not found.
    const highestNumber = Math.max(...candidates);
    // TODO: Instead of getting highest number, we could make a request to the online pokedex for all three mons, get their data, and compare again, and then dynamically add the data to the pokedex even.
    const index = candidates.indexOf(highestNumber);
    return [index, highestNumber];
  }

  return [candidates.indexOf(pokemon.number), pokemon.number];
}

/**
 * Handles the Royal Tunnel activity, progressing through levels and answering questions.
 * @param {string} [type="beginner"] - The difficulty level of the tunnel ("beginner", "advanced", "pro"). Defaults to "beginner".
 */
export async function handleTunnel(type = "beginner", desiredLevelProgress = 0) {
  try {
    // Start the Royal Tunnel activity with the specified difficulty
    await startTunnel(type);
    logMsg(tag, logLevels.Debug, `Started tunnel.`);

    let finished = false;
    let level = 0;
    const ranklistHighestLevel = 9000;
    let startLevel = null; // Startlevel is used for desirgedLevelProgress and is set during first iteration.

    // Continue while the tunnel is not finished
    while (!finished) {
      // View the current tunnel page (either start page, a question, or result page)
      const html = await (await viewTunnel()).text();

      if (html.includes("Cloudflare")) {
        await delay(WAIT_TIMES.ONE_SECOND);
        continue; // If Cloudflare is detected (i.e. server is unreachable), wait and try again
      }

      // Check if the tunnel has been completed and is at the start page
      if (html.includes("The Royal Tunnel is a long and gloomy tunnel near Emera Town.")) {
        logMsg(tag, logLevels.Valuable, `Finished tunnel completely.`);
        return;
      }

      // Check for milestone (continue page)
      if (html.includes("You can either take a break or continue your exploration!")) {
        if (desiredLevelProgress > 0 && startLevel !== null && level - startLevel >= desiredLevelProgress) {
          logMsg(tag, logLevels.Interesting, `Reached desired ${desiredLevelProgress} levels. Stopping.`);
          return;
        }
        logMsg(tag, logLevels.Interesting, `Reached a milestone at level [${level}]. Continuing in a few seconds...`);
        await delay(WAIT_TIMES.TEN_SECONDS);
        await continueTunnel();
        continue;
      }

      // We are in a question it seems!
      const match = html.match(/Question - Level (?<level>\d+)<\/legend>/);
      if (match && match.groups && match.groups.level) {
        level = parseInt(match.groups.level.trim(), 10);
        if (startLevel === null) {
          startLevel = level;
        }
      }

      if (level > ranklistHighestLevel) {
        logMsg(
          tag,
          logLevels.Important,
          `Reached level [${level}] which is higher than the highest ranklist level [${ranklistHighestLevel}]. Waiting one minute to lose on purpose`,
        );
        await delay(WAIT_TIMES.ONE_MINUTE); // Wait a minute to lose on purpose.
        await startTunnel(type);
        logMsg(tag, logLevels.Valuable, `Restarted tunnel.`);
        desiredLevelProgress = desiredLevelProgress > 0 ? desiredLevelProgress - (level - startLevel) : 0; // If some progress is desired, reduce by already made progress.
        startLevel = 0;
        level = 0;
        continue;
      }

      // Log the HTML content for specific levels (20, 50, 100, 250) - these are final questions, depending on the difficulty
      if (FINAL_LEVELS[type] === level) {
        console.log(html);
      }

      // Get the correct answer and Pokemon number from the tunnel page
      const [ans, pokemon] = getCorrectPokemon(html);
      logMsg(tag, logLevels.Debug, `Answer for level [${level}] is [${ans}] (Pokémon [${pokemon}])`); // Log the level, answer (0, 1, 2), and Pokemon number

      if (FINAL_LEVELS[type] === level) {
        await delay(WAIT_TIMES.TEN_SECONDS); // Wait for 10 seconds to answer manually
      }

      await delay(ANSWER_DELAY); // Wait for 1 second before answering to prevent any errors due to spam. We have 20 seconds to answer a question.
      const response2 = await answerTunnel(ans, level); // Answer the tunnel question
      const html2 = await response2.text(); // Get the HTML response

      // Log the HTML response for specific levels (20, 50, 100, 250) - response after answering final question. Should be congratulating page or next question.
      if (FINAL_LEVELS[type] === level) {
        console.log(html);
      }

      if (html2.includes("Oh no, ") || html2.includes("err=wrong&level=")) {
        logMsg(tag, logLevels.Necessary, `Answer wrong for level [${level}]. Was [${ans}] (Pokémon [${pokemon}])!`);
        sendMail(`Royal Tunnel WRONG, not ${ans}:${pokemon}!`, html);
        finished = true; // Set finished to true to exit the tunnel run
      }

      if (html2.includes("Congratulations")) {
        await handlePuzzle(html2);
        logMsg(tag, logLevels.Important, `Won tunnel.`);
        finished = true; // Set finished to true to exit the tunnel run
      }

      level++;
    }
  } catch (error) {
    logErr(tag, ``, error);
  }
}

export async function doTunnel() {
  const questionsPerHour = 200;
  await handleTunnel("endless", questionsPerHour);
}
