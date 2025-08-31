import { load } from "cheerio";
import fs from "fs";
import { headers } from "../const.js";
import { logErr, logLevels, logVal } from "../logger.js";
import { delay } from "../utils.js";

const tag = "POKEDEX";
// Current best option for new entries is to run the tunnel, get an answer wrong, and then fix it based on the question

function getPokedexEntry(pkdxnr = 1, spechar = "") {
  return fetch("https://pokeheroes.com/includes/ajax/pokedex/view_entry.php", {
    headers: headers,
    referrer: "https://pokeheroes.com/pokedex",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: `pkdxnr=${pkdxnr}&spechar=${spechar}`,
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

async function getPokedexRegion(region = "", OT = 0) {
  return fetch("https://www.pokeheroes.com/includes/ajax/pokedex/show_pkdx.php", {
    headers: headers,
    referrer: "https://www.pokeheroes.com/pokedex",
    body: `region=${region}&nat_dex=18&nat_dex_total=1&eggdex=1&eggdex_total=1&otmode=${OT}`,
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

function getJSONfromEntry(html) {
  const $ = load(html);
  const pokemonData = {};

  // Extract data
  pokemonData.number = parseInt($('span:contains("#")').text().match(/\d+/)[0], 10);
  pokemonData.name = $('span:contains("#")').text().split(" ")[1];

  if (pokemonData.name.length <= 0) {
    return null;
  }

  pokemonData.types = [];
  // Extract types with named group
  $('b:contains("Type(s):")')
    .nextAll('img[src^="//staticpokeheroes.com/img/type_icons/"]')
    .each((index, element) => {
      const typeMatch = $(element)
        .attr("src")
        .match(/\/(?<type>[^/]+)\.gif$/);
      pokemonData.types.push(typeMatch?.groups.type);
    });

  // Extract species with direct text access
  pokemonData.species = $('b:contains("Species:") + text').text().trim();

  // Extract egg groups with array operations
  pokemonData.egggroups = $('b:contains("Egggroup:") + text')
    .text()
    .trim()
    .split(/\s*\/\s*/)
    .filter(Boolean);

  // Extract numeric values with named groups and unified parsing
  const extractNumber = (text, regex) => {
    const match = text?.match(regex);
    return match ? parseInt(match.groups.value.replace(/,/g, ""), 10) : null;
  };

  pokemonData.EHP = extractNumber($('span[title="Egg Hatch Points"] + text').text(), /(?<value>\d{1,3}(?:,\d{3})*)/);

  pokemonData.EXP = extractNumber(
    $('b:contains("EXP. to Level 100:") + text').text(),
    /(?<value>\d+)/, // Original code already removes commas
  );

  // Extract measurements with unit handling
  const extractMeasurement = (text, unit) => {
    const match = text?.match(new RegExp(`(?<value>\\d+\\.?\\d*)\\s*${unit}`));
    return match ? parseFloat(match.groups.value) : null;
  };

  pokemonData.height = extractMeasurement($('b:contains("Height:") + text').text(), "m");

  pokemonData.weight = extractMeasurement($('b:contains("Weight:") + text').text(), "kg");

  // Extract description with simplified selector
  pokemonData.description = $("i:first").text().trim();

  return pokemonData;
}

async function getDex() {
  try {
    const pokedex = [];
    const lastPokedexEntry = 1030;
    let spechar = "";
    for (let i = 1; i < lastPokedexEntry; i++) {
      if (i > lastPokedexEntry) {
        //TODO: For certain pkdx numbers, special variantions exist. those are not important for the royal tunnel, but possibly for other means
        // However, brute forcing every possible char for all 1000 pokemons is not feasable, so maybe find a complete list of all pokemon images elsewhere, like in the boxes of a user who has all of them based on ranklist
        spechar = "g";
      }
      let success = false;

      while (!success) {
        try {
          await delay(1000);
          const response = await getPokedexEntry(i, spechar);
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
          const html = await response.text();
          const pjson = getJSONfromEntry(html);

          success = true; // Mark as successful if no error occurs here, exit retry loop

          if (pjson === null) {
            // PokeDex entry does not exist. Skip.
            // Example: 201, Unown, cause it has different "kinds"
            console.log(i, "does not exist");
          } else {
            pokedex.push(pjson);
            console.log(pjson.number, pjson.name);
          }
        } catch (error) {
          logErr(tag, `Error fetching/parsing entry ${i}.`, error);
          console.log(`Retrying entry ${i} in a bit...`);
          await delay(1000); // Wait before retrying (optional)
        }
      }

      if (!success) {
        console.warn(`Skipping entry ${i} after multiple failed attempts.`);
        // Optionally, push a placeholder or error object to the array
        // Pokedex.push({ number: i, error: "Skipped after retries" });
      }
    }

    // eslint-disable-next-line no-magic-numbers
    fs.writeFileSync("pokedex.json", JSON.stringify(pokedex, null, 2), "utf-8");
  } catch (error) {
    logErr(tag, ``, error);
  }
}

export function doDex() {
  getDex();
}

export async function getInfosFromPokedex(pkdxnr = 1, spechar = "") {
  const html = await (await getPokedexEntry(pkdxnr, spechar)).text();
  const pjson = getJSONfromEntry(html);
  console.log(pjson);
}

export async function getAllRegions() {
  const html = await (await getPokedexRegion("test", 0)).text();
  const $ = load(html);

  const regions = [];
  $("a[onclick]").each((_, elem) => {
    const onclickValue = $(elem).attr("onclick");
    // Extract the region name inside loadRegion("...")
    const match = onclickValue.match(/loadRegion\("(?<region>[^"]+)"\)/);
    if (match && match.groups) {
      regions.push(match.groups.region);
    }
  });

  return regions;
}

export async function getPlayerPokdex() {
  const regions = await getAllRegions();

  const pokedex = [];

  for (const region of regions) {
    const html = await (await getPokedexRegion(region, 1)).text();
    const $ = load(html);

    $(".pkdx_button").each((_, elem) => {
      const el = $(elem);

      const pkdxnr = parseInt(el.attr("pkdxnr"), 10);
      const spechar = el.attr("spechar") || "";
      const name = el.attr("pkmn_name") || "";

      const stars = [];
      el.find("img[src*='star.png']").each((_, img) => {
        const src = $(img).attr("src");
        if (src.includes("shiny_star")) stars.push("shiny");
        else if (src.includes("shadow_star")) stars.push("shadow");
      });

      // Egg dex flag based on opacity of egg image
      const eggImg = el.find("img[src*='egg_borderless.png']").first();
      const inEggDex = eggImg.length && !(eggImg.attr("style") || "").includes("opacity: 0.2");

      const baseImage = `//staticpokeheroes.com/img/pokemon/bw_front/0${pkdxnr}${spechar}.png`;

      pokedex.push({
        region,
        pkdxnr,
        spechar,
        name,
        stars,
        bwImage: baseImage,
        inEggDex,
      });
    });
  }

  return pokedex;
}

export async function logMissingPerRegion() {
  const pokedex = await getPlayerPokdex();

  const missingByRegion = pokedex.reduce((acc, entry) => {
    if (entry.pkdxnr < 0) {
      acc[entry.region] = (acc[entry.region] || 0) + 1;
    }
    return acc;
  }, {});

  logVal(tag, logLevels.Valuable, "Missing Pokémon", missingByRegion);
}
