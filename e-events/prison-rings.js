import { headers, URLs } from "../a-shared/const.js";
import { logErr, logLevels, logMsg } from "../a-shared/logger.js";

const tag = "PRISON RINGS";

async function checkForHoopa() {
  return fetch("https://pokeheroes.com/lab", {
    headers,
    referrer: "https://pokeheroes.com/",
    referrerPolicy: "strict-origin-when-cross-origin",
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

async function collectRing(url = "") {
  return fetch(`https://pokeheroes.com/${url}`, {
    headers,
    referrer: "https://pokeheroes.com/lab",
    referrerPolicy: "strict-origin-when-cross-origin",
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

async function collectHoopa() {
  return fetch("https://pokeheroes.com/lab?taskCont", {
    headers,
    referrer: "https://pokeheroes.com/lab",
    referrerPolicy: "strict-origin-when-cross-origin",
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

async function getHoopaURLs() {
  const hoopaURLs = new Set();
  const fetchPromises = URLs.map(async (url) => {
    try {
      const response = await fetch(url, {
        headers,
        referrer: "https://pokeheroes.com/",
        referrerPolicy: "strict-origin-when-cross-origin",
        method: "GET",
        mode: "cors",
        credentials: "include",
      });
      const html = await response.text();

      const match = html.match(/<a\s+href="(?<hoopaUrl>lab\?hoopa[^"]*)"/);
      if (match?.groups?.hoopaUrl) {
        hoopaURLs.add(match.groups.hoopaUrl);
      }
    } catch (error) {
      logErr(tag, `Error fetching ${url}:`, error);
    }
  });

  await Promise.all(fetchPromises);

  return hoopaURLs;
}

export async function doPrisonRings() {
  const html = await (await checkForHoopa()).text();
  if (html.includes("The Mischief Pokémon") && html.includes("Prison Rings")) {
    logMsg(tag, logLevels.Valuable, "Hoopa quest is active.");
    const hoopaURLs = await getHoopaURLs();
    for (const hoopaUrl of hoopaURLs) {
      await collectRing(hoopaUrl);
      logMsg(tag, logLevels.Interesting, `Collected Hoopa ring from [${hoopaUrl}].`);
    }
    await collectHoopa();
    return true;
  } else {
    logMsg(tag, logLevels.Debug, "No Hoopa quest active.");
    return false;
  }
}
