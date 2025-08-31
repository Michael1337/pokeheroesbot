import fs from "fs";
import { load } from "cheerio";
import { headers, WAIT_TIMES } from "../../a-shared/const.js";
import { logMsg, logErr, logLevels } from "../../a-shared/logger.js";
import { delay } from "../../a-shared/utils.js";
import { getAllPokemonDataBasicFromBox } from "../../b-home/pokemon-storage.js";
import { interactWithArrayAnon } from "../../b-home/interactions/interact-anon.js";

const tag = "BUG CONTEST";
const pokedex = JSON.parse(fs.readFileSync("./b-home/pokedex/pokedex.json", "utf-8"));

function viewBugContest() {
  return fetch("https://pokeheroes.com/bugcontest", {
    headers: headers,
    referrer: "https://pokeheroes.com/square",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function startBugContest() {
  return fetch("https://pokeheroes.com/includes/ajax/square/startBugGame.php", {
    headers: headers,
    referrer: "https://pokeheroes.com/bugcontest",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function endContest() {
  return fetch("https://pokeheroes.com/bugcontest?endGame", {
    headers: headers,
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function claimEgg(id) {
  return fetch(`https://pokeheroes.com/bugcontest?endGame&claimBug=${id}`, {
    headers: headers,
    referrer: "https://pokeheroes.com/bugcontest?endGame",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function ratePokemon(pkmnid) {
  return fetch("https://pokeheroes.com/bugcontest", {
    headers: headers,
    referrer: "https://pokeheroes.com/bugcontest",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: `pkmn_select=${pkmnid}`,
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

function getPokemonFromID(id) {
  return fetch(`https://pokeheroes.com/img/pkmnimage?id=${id}`, {
    headers: headers,
    referrer: "https://pokeheroes.com/bugcontest",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
    redirect: "manual",
  });
}

function catchBugPokemon(id) {
  return fetch("https://pokeheroes.com/includes/ajax/square/catchBugPkmn.php", {
    headers: headers,
    referrer: "https://pokeheroes.com/bugcontest",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: `id=${id}`,
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

async function getEggsAndPoints() {
  const html = await (await endContest()).text();
  const $ = load(html);

  const match = html.match(/reached (?<points>\d+) Points!/);
  const points = match ? parseInt(match.groups.points, 10) : null;

  const names = $("#blue_table:first tr:nth-child(3) td").toArray();
  const talents = $("#blue_table:first tr:nth-child(4) td").toArray();
  const beauties = $("#blue_table:first tr:nth-child(5) td").toArray();
  const claimLinks = $("#blue_table:first tr:last-child a").toArray();

  const eggs = names.map((el, i) => {
    // Extract claim ID from href, if available
    let claimId = null;
    if (claimLinks[i]) {
      const href = $(claimLinks[i]).attr("href");
      const idMatch = href && href.match(/claimBug=(?<claimId>\d+)/);
      if (idMatch && idMatch.groups && idMatch.groups.claimId) {
        claimId = idMatch.groups.claimId;
      }
    }
    return {
      nameValue: $(el).text().trim(),
      talentValue: $(talents[i]).text().replace("Talent:", "").trim(),
      beautyValue: $(beauties[i]).text().replace("Beauty:", "").trim(),
      claimId,
    };
  });

  return { eggs, points };
}

function checkEggs(eggs) {
  // Pinsir and Heracross have a slight chance of being megaable, similar for Scyther. Adjust these according to pokedex maybe.
  const goodEgg = eggs.find(
    (e) =>
      (["Scyther"].includes(e.nameValue) &&
        e.talentValue === "Super Talented" &&
        e.beautyValue === "Totally fabulous") ||
      (e.nameValue === "Larvesta" && (e.talentValue === "Super Talented" || e.beautyValue === "Totally fabulous")),
  );
  return goodEgg;
}

export async function earnBugToHatch() {
  while (true) {
    try {
      const html = await (await startBugContest()).text();
      logMsg(tag, logLevels.Debug, `Started.`);

      const matches = [...html.matchAll(/<div class="bugpkmnid">(?<id>\d+)<\/div>/g)];
      if (!matches.length) return null;

      const allIds = matches.map((m) => m.groups.id);

      const bugChecks = await Promise.all(
        allIds.map(async (id) => {
          const url = (await getPokemonFromID(id)).headers.get("location");
          const idMatch = url.match(/c=(?<id>\d+)/);
          const pokedexId = idMatch ? parseInt(idMatch.groups.id, 10) : null;
          const pokemon = pokedex.find((e) => e.number === pokedexId);
          return pokemon && pokemon.types.includes("bug");
        }),
      );

      const bugIds = allIds.filter((_, i) => bugChecks[i]);
      logMsg(tag, logLevels.Debug, `[${bugIds.length}] Bug Pokemon found. Catching...`);

      const remainingBugsForCheck = 10;

      for (let i = 0; i < bugIds.length; i++) {
        await catchBugPokemon(bugIds[i]);
        if (i >= bugIds.length - remainingBugsForCheck) {
          const { eggs, points } = await getEggsAndPoints();
          const goodEgg = checkEggs(eggs);
          if (goodEgg) {
            logMsg(tag, logLevels.Valuable, `Found a good egg with [${points}] points! Claiming it now...`);
            return goodEgg;
          }
        }
      }
    } catch (error) {
      logErr(tag, ``, error);
      return null;
    }
  }
}

function getMsToNextContest() {
  const now = new Date();
  const DAY_OF_CONTEST = 1;
  const DECEMBER = 11;

  let contestYear = now.getFullYear();
  let contestMonth = now.getMonth(); // 0-based: 0=Jan, ..., 11=Dec

  if (now.getDate() >= DAY_OF_CONTEST) {
    // Move to next month
    if (contestMonth === DECEMBER) {
      // December -> January next year
      contestMonth = 0;
      contestYear += 1;
    } else {
      // 27th this month -> 14th next month
      contestMonth += 1;
    }
  }

  const nextContest = new Date(contestYear, contestMonth, DAY_OF_CONTEST, 0, 0, 0, 0);
  const msToNextContest = nextContest - now;
  return msToNextContest;
}

function getLeadingPokemons(html) {
  const regex =
    /<td>\s*<a href=["']pokemon\?id=(?<pokeId>\d+)["']>.*?<img[^\d]+?(?<imgId>\d+m?)\.png["']>.*?<b>Points:<\/b>\s*(?<points>\d+)/gs;

  const results = [];
  let match;
  while ((match = regex.exec(html)) !== null) {
    results.push({
      id: match.groups.pokeId,
      imgId: match.groups.imgId,
      points: parseInt(match.groups.points, 10),
    });
  }
  return results;
}

export async function supportTopLarvestasAnon() {
  const html = await (await viewBugContest()).text();
  const bugs = getLeadingPokemons(html).filter((bug) => bug.imgId.includes("636"));
  if (bugs.length === 0) return;
  logMsg(tag, logLevels.Valuable, `[${bugs.length}] Larvestas still need to evolve.`);
  await interactWithArrayAnon(bugs);
  for (const bug of bugs) {
    await ratePokemon(bug.id);
  }
}

export async function handleBugContest() {
  while (true) {
    const html = await (await viewBugContest()).text();

    if (html.includes("The last Bug-Hatching contest has already ended! The next contest starts next month.")) {
      const msToNextMonth = getMsToNextContest();
      logMsg(
        tag,
        logLevels.Valuable,
        `Bug Contest is not active. Waiting [${Math.floor(msToNextMonth / 1000 / 3600)}] hours until next month.`,
      );
      await delay(msToNextMonth);
      continue;
    }
    if (html.includes("Please hatch the Egg before trying again at our minigame.")) {
      logMsg(tag, logLevels.Interesting, `Currently hatching an egg...`);
      await delay(WAIT_TIMES.THREE_MINUTES);
      continue;
    }
    if (html.includes("After starting the mini game")) {
      logMsg(tag, logLevels.Interesting, `Currently finding an egg to hatch...`);
      const bugs = await getAllPokemonDataBasicFromBox("Bugs");

      for (const bug of bugs) {
        if (bug.name == "Volcarona") continue; // Not rating Volcarona until end of contest.
        await ratePokemon(bug.id);
      }
      await supportTopLarvestasAnon();
      const egg = await earnBugToHatch();
      if (!egg) continue;
      await claimEgg(egg.claimId);
    }
    if (html.includes("The qualification stage of this contest has ended.")) {
      // Make sure the leading 5 Larvestas evolve and are rated as Volcaronas.
      await supportTopLarvestasAnon();
      await delay(WAIT_TIMES.TEN_MINUTES);
    }
  }
}
