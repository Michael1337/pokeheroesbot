import { headers } from "../a-shared/const.js";
import { logMsg, logErr, logLevels } from "../a-shared/logger.js";

const tag = "SHADOW HUNT";
const REGIONS = ["Kanto", "Johto", "Hoenn"];

function startHunt(region = "Kanto") {
  return fetch("https://pokeheroes.com/shadowradar", {
    headers: headers,
    referrer: "https://pokeheroes.com/shadowradar",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: `region=${region}`,
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

function viewHunt() {
  return fetch("https://pokeheroes.com/shadowradar", {
    headers: headers,
    referrer: "https://pokeheroes.com/shadowradar",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function cancelHunt() {
  return fetch("https://pokeheroes.com/shadowradar?cancelHunt", {
    headers: headers,
    referrer: "https://pokeheroes.com/shadowradar",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function clickTile(x = 0, y = 0) {
  return fetch("https://pokeheroes.com/includes/ajax/shadowradar/fight.php", {
    headers: headers,
    referrer: "https://pokeheroes.com/shadowradar?",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: `x=${x}&y=${y}`,
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

function throwBall(pb = "Poké Ball") {
  return fetch("https://pokeheroes.com/includes/ajax/shadowradar/throw_pokeball.php", {
    headers: headers,
    referrer: "https://pokeheroes.com/shadowradar?",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: `pb=${pb}`,
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

function countUnknownPokemon(html) {
  const regionRegex = new RegExp(
    `<div class="bluecell region_box region_(?<region>${REGIONS.join("|")})"[^>]*>(?<content>.*?)<form`,
    "gis",
  );

  const results = Object.fromEntries(REGIONS.map((r) => [r, 0]));

  let match;
  while ((match = regionRegex.exec(html)) !== null) {
    const region = match.groups.region;
    results[region] = (match.groups.content.match(/missingno\.png/g) || []).length;
  }

  return results;
}

async function chooseRegionToHunt(html) {
  const unknownPokemon = countUnknownPokemon(html);
  for (const currentRegion of REGIONS) {
    if (unknownPokemon[currentRegion] > 0) {
      return { region: currentRegion, allKnown: false };
    }
    logMsg(
      tag,
      logLevels.Interesting,
      `No unknown Pokémon in [${currentRegion}].${currentRegion === REGIONS.at(-1) ? "" : ` Checking [${REGIONS[REGIONS.indexOf(currentRegion) + 1]}]...`}`,
    );
  }
  const randomRegion = REGIONS[Math.floor(Math.random() * REGIONS.length)];
  logMsg(tag, logLevels.Interesting, `No new Pokémon found in any region. Randomly choosing [${randomRegion}] region.`);
  return { region: randomRegion, allKnown: true };
}

async function findPokemonInRegion(allKnown) {
  const middleCoord = 5;
  await clickTile(middleCoord, middleCoord);
  const html = await (await viewHunt()).text();

  if (html.includes("var has_dex = false;")) {
    logMsg(tag, logLevels.Valuable, `New Pokémon found. Starting to hunt a shadow version...`);
    return true;
  } else if (allKnown) {
    logMsg(
      tag,
      logLevels.Interesting,
      `Pokémon is already known, but no new Pokémon are available, so starting hunt anyways...`,
    );
    return true;
  } else {
    logMsg(tag, logLevels.Interesting, `Pokémon is already known. Searching again...`);
    await cancelHunt();
    return false;
  }
}

async function findAndCatchShadowVersion() {
  const fieldStart = 0;
  const fieldEnd = 9;
  let [x, y] = [fieldStart, fieldStart]; // Initialize search at Top Left
  const toggleCoord = (coord) => (coord === fieldStart ? fieldEnd : fieldStart); // Switch to Bottom Right and toggle back and forth
  let ball = "Poké Ball";
  let chainLength;
  let pkdxnr;

  while (true) {
    x = toggleCoord(x);
    y = toggleCoord(y);
    let html = await (await clickTile(x, y)).text();

    if (html.includes("An error occured! You are currently not on a hunt.")) {
      break;
    }

    if (html.includes("This Pokémon is different to your current Chain!")) {
      logMsg(tag, logLevels.Important, `Shadow hunt lost because a different pokemon was encountered.`);
      break;
    }

    if (html.includes("<b>Shadow Radar</b> recorded its data.<br>")) {
      // Choose ball to throw.
      const chainLengthMatch = html.match(/chain_length\s*=\s*(?<chain>\d+)/);
      chainLength = chainLengthMatch ? parseInt(chainLengthMatch.groups.chain, 10) : null;
      // Deoxys took a chain length of 1600, so if chain length is greater than 500, use Great ball, and if greater than 1000, us Ultra ball.
      const greateThreshold = 500;
      const ultraThreshold = 1000;
      ball = chainLength >= ultraThreshold ? "Ultra Ball" : chainLength >= greateThreshold ? "Great Ball" : "Poké Ball";
      const nth = 100;
      const pkdxnrMatch = html.match(/chain_pkdxnr\s*=\s*(?<nr>\d+)/);
      pkdxnr = pkdxnrMatch ? parseInt(pkdxnrMatch.groups.nr, 10) : null;
      if (chainLength % nth === 0) {
        logMsg(
          tag,
          logLevels.Interesting,
          `Hunt for pokemon [${pkdxnr}] ongoing with chain length of [${chainLength}]...`,
        );
      }
      continue;
    }

    if (html.includes("Choose a Pokéball")) {
      // Throw ball.
      logMsg(
        tag,
        logLevels.Interesting,
        `Shadow version found at chain [${chainLength}]. Attempting to catch using [${ball}]...`,
      );
      html = await (await throwBall(ball)).text();
      if (html.includes(`-ball.png'>", 5, true, false);</script>`)) {
        // For Pokeball it is `<script>pokeballAnimation("<img src='//staticpokeheroes.com/img/items/poke-ball.png'>", 5, true, false);</script>`
        logMsg(
          tag,
          logLevels.Valuable,
          `Hunt over. Pokémon [${pkdxnr}] was caught at chain length [${chainLength}] using [${ball}]!`,
        );
        break;
      } else {
        logMsg(
          tag,
          logLevels.Interesting,
          `Pokémon [${pkdxnr}] could not be caught at chain length [${chainLength}] using [${ball}]. Continue hunt...`,
        );
      }
      continue;
    }
  }
}

export async function handleShadowHunt() {
  try {
    let foundPokemonToHunt = false;
    while (!foundPokemonToHunt) {
      const html = await (await viewHunt()).text();

      if (html.includes("You have reached your daily maximum.")) {
        logMsg(tag, logLevels.Debug, `Reached daily maximum. No more hunts possible.`);
        return;
      }

      const { region, allKnown } = await chooseRegionToHunt(html);

      logMsg(tag, logLevels.Interesting, `Starting hunt in [${region}].`);
      await startHunt(region);

      foundPokemonToHunt = await findPokemonInRegion(allKnown);
    }

    await findAndCatchShadowVersion();
    return;
  } catch (error) {
    logErr(tag, ``, error);
  }
}
