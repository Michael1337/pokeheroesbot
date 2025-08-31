import net from "net";
import { SocksProxyAgent } from "socks-proxy-agent";
import { HttpsProxyAgent } from "https-proxy-agent";
import { headersAnon, WAIT_TIMES } from "../../a-shared/const.js";
import { logMsg, logErr, logLevels } from "../../a-shared/logger.js";
import { delay } from "../../a-shared/utils.js";

const tag = "INTERACTION ANON";

async function sendNewnymSignal() {
  const host = process.env.TOR_CONTROL_HOST || "tor-privoxy";
  const port = parseInt(process.env.TOR_CONTROL_PORT || "9051", 10);

  await new Promise((resolve, reject) => {
    const socket = net.connect(port, host, () => {
      socket.write('AUTHENTICATE ""\r\n');
    });
    let authenticated = false;

    socket.on("data", (data) => {
      const response = data.toString();
      if (authenticated) {
        if (response.startsWith("250")) {
          socket.end();
          resolve();
        }
      } else {
        if (response.startsWith("250")) {
          authenticated = true;
          socket.write("SIGNAL NEWNYM\r\n");
        } else if (response.startsWith("515")) {
          socket.end();
          reject(new Error("Authentication failed"));
        }
      }
    });

    socket.on("error", reject);
  });

  await delay(WAIT_TIMES.THREE_SECONDS);
}

async function getAnonAgent() {
  let agent;
  const torProxy = process.env.TOR_PROXY;
  if (torProxy && torProxy !== "false") {
    await sendNewnymSignal(); // Request new Tor circuit, i.e. new IP address
    agent = new SocksProxyAgent(torProxy, { timeout: 30000 });
  } else {
    const httpProxy = "http://180.127.75.232:8089";
    // In case no TOR proxy is available, you could get a new public proxy here every minute
    agent = new HttpsProxyAgent(httpProxy);
  }
  return agent;
}

export async function getCurrentIP(agent) {
  try {
    const fetch = (await import("node-fetch")).default;
    const response = await fetch("https://api.ipify.org?format=json", { agent });
    const data = await response.json();
    return data.ip;
  } catch (error) {
    logErr(tag, "Failed to fetch current IP:", error);
    return null;
  }
}

async function getPkmnPageAnon(pkmnId = 0, agent = undefined) {
  const fetch = (await import("node-fetch")).default;
  return fetch(`https://pokeheroes.com/pokemon.php?id=${pkmnId}`, {
    headers: headersAnon,
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
    ...(agent && { agent }),
  });
}

async function interactPkmnAnon(pkmnId = 0, pkmnSid = 0, isEgg = false, agent = undefined) {
  const fetch = (await import("node-fetch")).default;
  const action = isEgg ? "warm" : "train";
  return fetch(`https://pokeheroes.com/interact?action=${action}&id=${pkmnId}&sid=${pkmnSid}`, {
    headers: headersAnon,
    referrer: `https://pokeheroes.com/pokemon?id=${pkmnId}`,
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
    ...(agent && { agent }),
  });
}

async function interactPkmnAnonDirect(pkmnId = 0, agent = undefined) {
  const fetch = (await import("node-fetch")).default;
  return fetch(`https://pokeheroes.com/interact?id=${pkmnId}&action=direct`, {
    headers: headersAnon,
    referrer: `https://pokeheroes.com/`,
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
    ...(agent && { agent }),
  });
}
async function getUserprofile(username) {
  return fetch(`https://pokeheroes.com/userprofile?name=${username}`, {
    headers: headersAnon,
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

async function getUserBoxOverview(username) {
  return fetch(`https://pokeheroes.com/userboxes.php?name=${username}`, {
    headers: headersAnon,
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

async function getUserBoxPokemon(username, boxId) {
  return fetch(`https://pokeheroes.com/userboxes.php?name=${username}&box=${boxId}`, {
    headers: headersAnon,
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function getPartyDataUserprofile(html) {
  // For simple interactions, this is a bit overkill, but maybe we can use this later for other things.
  // Regex for each <tr> row
  const rowRegex =
    /<tr>\s*<td>\s*<a href='pokemon\.php\?id=(?<pkmnid>\d+)'>\s*<img src='(?<imgsrc>[^']+)'>\s*<\/a>\s*<\/td>\s*<td>(?<namecell>[\s\S]*?)<\/td>\s*<td>\s*<b>(?<level>---|[\d,]+)<\/b>\s*<\/td>\s*<td>(?<exp>[\d,]+)\s*\/\s*(?<ehp>[\d,]+)<\/td>\s*<\/tr>/g;

  const results = [];
  let match;
  while ((match = rowRegex.exec(html)) !== null) {
    const { pkmnid, imgsrc, namecell, level, exp, ehp } = match.groups;

    // Check for egg
    const isEgg = namecell.trim() === "EGG";
    const nickname = null;
    let species = null;
    let isShiny = false;

    if (isEgg) {
      species = "egg";
    } else {
      // Extract nickname (text before first <br> or before "(")
      const nicknameMatch = namecell.match(/^(?<nickname>[^<(\n]*)/i);
      const nickname = nicknameMatch?.groups?.nickname
        ? nicknameMatch.groups.nickname.replace(/<br>$/, "").trim()
        : null;

      // Extract species (text inside parentheses, or if not present, fallback to nickname)
      const speciesMatch = namecell.match(/\((?<species>[^)]+)\)/);
      if (speciesMatch?.groups?.species) {
        species = speciesMatch.groups.species.trim();
      } else if (nickname) {
        // If only one line and no parentheses, nickname is species
        species = nickname;
      }

      // Check for shiny
      isShiny = /shiny_star/i.test(namecell);
    }

    results.push({
      pkmnid: parseInt(pkmnid, 10),
      imgsrc,
      nickname: isEgg ? null : nickname,
      species,
      level: isEgg ? null : parseInt(level.replace(/,/g, ""), 10),
      exp: parseInt(exp.replace(/,/g, ""), 10),
      ehp: parseInt(ehp.replace(/,/g, ""), 10),
      isEgg,
      isShiny: isEgg ? false : isShiny,
    });
  }
  return results;
}

export async function interactWithPkmnAnon(pkmnId = 0, agent = undefined) {
  try {
    if (!agent) {
      agent = await getAnonAgent();
    }
    // We use this more complicated way using the Sid because doing direct interactions only grants 0.25 EXP according to the wiki.
    const html = await (await getPkmnPageAnon(pkmnId, agent)).text();
    const isEgg = html.includes(">Warm the egg</h3>");
    const match = html.match(/sid=\s*(?<sid>\d+)/);

    if (html.includes("You have already interacted with")) {
      const IP = await getCurrentIP(agent);
      logMsg(tag, logLevels.Debug, `Already interacted with pkmn ID [${pkmnId}] from IP [${IP}].`);
      return html;
    } else if (match && match.groups) {
      const pkmnSid = match.groups.sid;
      logMsg(tag, logLevels.Debug, `Interacting as anon with pkmn ID ${pkmnId} and SID ${pkmnSid}.`);
      return await (await interactPkmnAnon(pkmnId, pkmnSid, isEgg, agent)).text();
    } else {
      logMsg(
        tag,
        logLevels.Important,
        `Couldn't find pkmn SID for ID ${pkmnId}, but haven't already interacted, probably because of some server error.`,
      );
      return html;
    }
  } catch (error) {
    if (error.message && !error.message.includes("Socks5 proxy rejected connection")) {
      logErr(tag, `Error in interactWithPkmnAnon for pkmn ID [${pkmnId}]`, error);
    }
    await delay(WAIT_TIMES.TWO_SECONDS);
  }
}

function isCloseToHatching(pkmn) {
  const avgEhpPerClick = 130;
  const unsuspiciousNumberOfClicks = 15;
  return (pkmn.ehp - pkmn.exp) / avgEhpPerClick < unsuspiciousNumberOfClicks;
}

export async function interactWithPartyAnon(username, force = false) {
  try {
    const html = await (await getUserprofile(username)).text();
    const party = getPartyDataUserprofile(html);

    const eggsToInteract = party.filter((pkmn) => pkmn.isEgg && (force || isCloseToHatching(pkmn)));
    if (eggsToInteract.length <= 0) return;

    logMsg(tag, logLevels.Interesting, `Interacting as anon with [${eggsToInteract.length}] Pokémon of [${username}].`);

    const agent = await getAnonAgent();
    for (const pkmn of eggsToInteract) {
      await interactWithPkmnAnon(pkmn.pkmnid, agent);
    }
  } catch (error) {
    logErr(tag, `Error in interactWithPartyAnon...`, error);
  }
}

export async function interactWithArrayAnon(pkmns = []) {
  try {
    logMsg(tag, logLevels.Debug, `Interacting as anon with [${pkmns.length}] Pokémon.`);

    const agent = await getAnonAgent();
    const results = await Promise.allSettled(pkmns.map((pkmn) => interactWithPkmnAnon(pkmn.id, agent)));
    let grewCount = 0;
    let alreadyCount = 0;

    for (const result of results) {
      if (result.status === "fulfilled") {
        const html = result.value;
        if (html?.includes("The Pokémon grew by")) grewCount++;
        if (html?.includes("You have already interacted with")) alreadyCount++;
      }
    }

    logMsg(
      tag,
      logLevels.Debug,
      `Out of ${pkmns.length}, ${grewCount} grew and ${alreadyCount} were already interacted with.`,
    );
  } catch (error) {
    logErr(tag, `Error in interactWithPartyAnon...`, error);
  }
}

/**
 * This function interacts with all Pokémon in a user's boxes anonymously.
 * @param {string} username The username who is to be interacted with.
 */
export async function interactWithBoxAnon(username) {
  if (username == "null") return;
  try {
    const html = await (await getUserBoxOverview(username)).text();
    const boxIds = [...html.matchAll(/<option value='(?<boxId>\d+)'[^>]*>/g)].map((match) => match.groups.boxId);

    const allPkmnIds = [];

    for (const boxId of boxIds) {
      const boxHtml = await (await getUserBoxPokemon(username, boxId)).text();
      const pkmnIds = [...boxHtml.matchAll(/href='pokemon\?id=(?<pkmnId>\d+)'/g)].map((match) => match.groups.pkmnId);
      allPkmnIds.push(...pkmnIds);
    }

    logMsg(tag, logLevels.Debug, `Total Pokémon IDs collected: [${allPkmnIds.length}]`);

    const BATCH_SIZE = 100;
    const CHANGE_IP_THRESHOLD = 50; // If more than 50% of the batch has already been interacted with, change IP
    let grewCountTotal = 0;
    let agent = await getAnonAgent();

    let i = 0;
    while (i < allPkmnIds.length) {
      const batch = allPkmnIds.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(batch.map((pkmnId) => interactWithPkmnAnon(pkmnId, agent)));

      let grewCount = 0,
        alreadyCount = 0;

      for (const result of results) {
        if (result.status === "fulfilled") {
          const html = result.value;
          if (html?.includes("The Pokémon grew by")) grewCount++;
          if (html?.includes("You have already interacted with")) alreadyCount++;
        }
      }

      grewCountTotal += grewCount;

      logMsg(
        tag,
        logLevels.Debug,
        `Batch ${Math.floor(i / BATCH_SIZE) + 1}, grew ${grewCount}, already ${alreadyCount}`,
      );

      if (alreadyCount > CHANGE_IP_THRESHOLD) {
        agent = await getAnonAgent();
        logMsg(
          tag,
          logLevels.Debug,
          `This IP address already interacted with some of the pokemon. Changing IP address...`,
        );
      } else {
        i += BATCH_SIZE;
      }
    }

    logMsg(
      tag,
      logLevels.Valuable,
      `All batches processed. [${grewCountTotal}] out of [${allPkmnIds.length}] Pokémon grew through anonymous interactions.`,
    );
  } catch (error) {
    logErr(tag, `Error in interactWithBoxAnon...`, error);
  }
}

/**
 * This function interacts with all Pokémon in a user's boxes anonymously.
 * However, using "direct" interactions has a daily limit of between 50 and 100 interactions per IP address and yields only 25 % of EXP,
 * so we do not use this approach.
 * @param {string} username The username who is to be interacted with.
 */
export async function interactWithBoxAnonDirect(username) {
  try {
    const html = await (await getUserBoxOverview(username)).text();
    const boxIds = [...html.matchAll(/<option value='(?<boxId>\d+)'[^>]*>/g)].map((match) => match.groups.boxId);

    const allPkmnIds = [];
    let grewCountTotal = 0;

    for (const boxId of boxIds) {
      const boxHtml = await (await getUserBoxPokemon(username, boxId)).text();
      const pkmnIds = [...boxHtml.matchAll(/href='pokemon\?id=(?<pkmnId>\d+)'/g)].map((match) => match.groups.pkmnId);
      allPkmnIds.push(...pkmnIds);
    }

    const BATCH_SIZE = 10;
    const MAX_IP_ATTEMPTS = 3;
    const MAX_WAIT_ROUNDS = 5;
    const WAIT_BETWEEN_ROUNDS = 60000; // 60 seconds

    let shouldAbort = false;
    let agent = await getAnonAgent();
    for (let i = 0; i < allPkmnIds.length && !shouldAbort; i += BATCH_SIZE) {
      const batch = allPkmnIds.slice(i, i + BATCH_SIZE);

      let round = 0;
      let batchProcessed = false;

      while (round < MAX_WAIT_ROUNDS && !batchProcessed) {
        let attempt = 0;

        while (attempt < MAX_IP_ATTEMPTS && !batchProcessed) {
          let dailyLimitHit = false;
          let grewCount = 0,
            alreadyCount = 0;

          const results = await Promise.allSettled(batch.map((pkmnId) => interactPkmnAnonDirect(pkmnId, agent)));

          for (const result of results) {
            if (result.status === "fulfilled") {
              const html = await result.value.text();
              if (html.includes("The Pokémon grew by")) grewCount++;
              if (html.includes("You have already interacted with this Egg/Pokémon today!")) alreadyCount++;
              if (html.includes("You have reached the daily limit of Direct Interactions!")) dailyLimitHit = true;
            }
          }

          grewCountTotal += grewCount;

          console.log(
            `Batch ${Math.floor(i / BATCH_SIZE) + 1}, round ${round + 1}, attempt ${attempt + 1}: grew ${grewCount}, already ${alreadyCount}`,
          );

          if (dailyLimitHit) {
            attempt++;
            agent = await getAnonAgent();
            if (attempt < MAX_IP_ATTEMPTS) {
              console.log(
                `Daily limit hit! Switching to new IP and retrying batch (attempt ${attempt + 1} of ${MAX_IP_ATTEMPTS})...`,
              );
            } else {
              console.log(
                `Daily limit hit! Max IP attempts reached for this round. Will wait and retry if rounds remain.`,
              );
            }
          } else {
            batchProcessed = true;
          }
        }

        if (!batchProcessed) {
          round++;
          if (round < MAX_WAIT_ROUNDS) {
            console.log(`Waiting ${WAIT_BETWEEN_ROUNDS / 1000} seconds before next round of IP attempts...`);
            await delay(WAIT_BETWEEN_ROUNDS);
          } else {
            console.log(`Daily limit hit after ${MAX_WAIT_ROUNDS} rounds. Aborting operation.`);
            shouldAbort = true;
          }
        }
      }

      await delay(WAIT_TIMES.TENTH_SECOND); // Wait 100ms between batches to avoid rate limiting
    }

    if (shouldAbort) {
      console.log("Operation aborted due to repeated daily limit errors.");
    } else {
      console.log("All batches processed.");
    }
    console.log(`Total: "grew" found ${grewCountTotal} out of ${allPkmnIds.length} times.`);
  } catch (error) {
    logErr(tag, `Error in interactWithBoxAnonDirect...`, error);
  }
}
