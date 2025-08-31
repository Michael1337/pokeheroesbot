import { headers } from "../a-shared/const.js";
import { logMsg, logLevels } from "../a-shared/logger.js";
import { createSpaceInParty } from "../c-town/rowan-lab/adoption.js";
import { handleTunnel } from "../c-town/royaltunnel/royal-tunnel.js";

const tag = "EVENT";

function viewEvent() {
  return fetch("https://pokeheroes.com/event_distribution", {
    headers: headers,
    referrer: "https://pokeheroes.com/",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function claimReward() {
  return fetch("https://www.pokeheroes.com/event_distribution", {
    headers: headers,
    referrer: "https://www.pokeheroes.com/event_distribution",
    body: "event_receive=true",
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

export async function handleEvent() {
  let html = await (await viewEvent()).text();
  if (html.includes("you have collected enough Event Points to claim the Event")) {
    await createSpaceInParty();
    await claimReward();
    html = await (await viewEvent()).text();
  }
  if (html.includes("Gaining Event Points:")) {
    logMsg(tag, logLevels.Interesting, "Event is ongoing, gaining points.");
    // Event is ongoing, get points. Function is called every hour.
    const levels = 800; // 200 are done every hour anyways.
    handleTunnel("endless", levels);
  }
}
