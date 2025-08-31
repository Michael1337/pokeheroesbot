import "dotenv/config";
import { headers } from "./const.js";
import { handleCheat } from "../b-home/solve-cheat-validator.js";
import { handlePuzzle } from "../b-home/puzzle.js";

let isInternalFetch = false;
const originalFetch = global.fetch;
global.fetch = async (...args) => {
  if (isInternalFetch) {
    return originalFetch(...args);
  }

  const response = await originalFetch(...args);
  const requestUrl = typeof args[0] === "object" ? args[0].url : args[0];
  let html;
  try {
    html = await response.text();

    isInternalFetch = true;
    await handleCheat(html, requestUrl);
    await handlePuzzle(html);
    isInternalFetch = false;
  } catch (e) {
    isInternalFetch = false;
    // Silently ignore errors
    console.log(e);
  }

  // Make request to /forum to stay stealthy
  isInternalFetch = true;
  await originalFetch("https://pokeheroes.com/forum", {
    headers: headers,
    referrer: "https://pokeheroes.com/",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  }).catch((err) => {
    if (err?.cause?.code === "UND_ERR_SOCKET" || err?.cause?.code === "ECONNRESET") return;
    console.error("Secondary request failed:", err);
  });
  isInternalFetch = false;

  // Return new response instead of original to prevent some bugs
  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
};

import schedule from "node-schedule";
import { playHangman } from "../c-town/gamecenter/gc-hangman.js";
import { handleRumbleArea } from "../c-town/rumble-areas.js";
import { sortPokemonStorage, storePartyPokemonAndAdoptEgg } from "../b-home/pokemon-storage.js";
import { handleGardens, handleSeedMakers } from "../c-town/garden/handle-berries.js";
import { handleHomepageInteraction } from "../b-home/interactions/interact-home.js";
import { checkMessages } from "../d-community/private-messages.js";
import { checkMyTrades } from "../c-town/trades.js";
import { handleCollecting, handleFishing, handleLeah } from "../c-town/beach.js";
import { handleBulletinBoard } from "../c-town/garden/cooking-pot.js";
import { doHigherLower } from "../c-town/gamecenter/gc-higherOrLower.js";
import { handleCoinFlips } from "../c-town/gamecenter/gc-coinflip.js";
import { handlePaldeaResearch } from "../b-home/paldea-research.js";
import { interactWithBoxAnon, interactWithPartyAnon } from "../b-home/interactions/interact-anon.js";
import { handleTree } from "../c-town/route-53/honeytree.js";
import { handleExpiringAuction, handleInstantAuction } from "../c-town/auction.js";
import { handleCombees } from "../c-town/route-53/honeycombs.js";
import { handleMiltanks } from "../c-town/route-53/moomoo-ranch.js";
import { handleLottery } from "../c-town/gamecenter/gc-lottery.js";
import { doTunnel } from "../c-town/royaltunnel/royal-tunnel.js";
import { handleEvent } from "../b-home/event-distribution.js";
import { handleDWShop, handleReturnMissingPlushies } from "../c-town/emera-mall/shop-dream-world.js";
import { handleGoldenSlot } from "../c-town/gamecenter/gc-slot.js";
import { checkOakChallenge, handleOakChallenge } from "../c-town/emera-square/oak-contest.js";
import { handleShadowHunt } from "../b-home/shadow-hunt.js";
import { newsPage } from "../b-home/news.js";
import { checkWeatherDaycare } from "../b-home/weather.js";
import { handleExchangeItem } from "../c-town/gamecenter/gc-exchange-items.js";
import { handleFountain } from "../c-town/fountain.js";
import { handleMoveBerries } from "../c-town/garden/move-berries.js";
import { handleMissingNo } from "../c-town/rowan-lab/bill.js";
import { handleZygardeQuest } from "../c-town/gem-collector.js";
import { rowanQuest } from "../c-town/rowan-lab/rowan.js";
import { reportStats } from "../d-community/stats.js";
import { handleMassages, makeFurfrousPerm } from "../c-town/emera-mall/salon.js";
import { evolvePokemon } from "../b-home/pokemon-evolution.js";
import { handleRaffle } from "../c-town/gamecenter/gc-raffle.js";
import { handleWonderTradeShiny } from "../c-town/wonder-trade.js";
import { trimLogFile } from "./logger.js";
import { spritesQuest } from "../c-town/sprites.js";
import { interactWithPokemons } from "../b-home/interactions/interact-pokemons.js";
import { handleMemory } from "../c-town/gamecenter/gc-memory.js";
import { handleTreasure } from "../c-town/gamecenter/gc-treasure.js";
import { handleWheel } from "../c-town/gamecenter/gc-wheel.js";
import { handleTallGrass } from "../c-town/tall-grass.js";
import { handleBugContest } from "../c-town/emera-square/bug-contest.js";
import { handleBeautyContest } from "../c-town/emera-square/beauty-contest.js";
import getConfig from "./config.js";
import { clickDitto } from "../c-town/rowan-lab/adoption.js";

console.log("Starting bot...");

// Every 30 seconds
const _job30Seconds = schedule.scheduleJob("*/30 * * * * *", async function () {
  handleRumbleArea(); // When doing 5 minute explorations, otherwise might increase.
});

// Every minute
const _jobMinute = schedule.scheduleJob("* * * * *", async function () {
  storePartyPokemonAndAdoptEgg();
});

// Every 2 minutes
const _job2Minutes = schedule.scheduleJob("*/2 * * * *", async function () {
  // DoFishing(); // only during FunFair
  playHangman(); // Do not lower than 10 seconds or a warning will be given by Admin! And even 10 seconds is super suspicious of checked!
});

// Every 5 minutes, 5 seconds after the minute to allow the homepage pokemon to arrive
const _job5Minutes = schedule.scheduleJob("5 */5 * * * *", async function () {
  handleHomepageInteraction();
  checkMessages();
  checkMyTrades();
  handleFishing();
  handleBulletinBoard();
});

// Every 10 minutes, 29 seconds after the minute
const _job10Minutes = schedule.scheduleJob("29 */10 * * * *", async function () {
  doHigherLower();
  handleCoinFlips();
  handleCollecting();
  handlePaldeaResearch();
  interactWithPartyAnon(process.env.APP_USERNAME, false);
});

// Every 30 minutes, 1 minute after the hour and half-hour
const _job30Minutes = schedule.scheduleJob("1,31 * * * *", async function () {
  handleTree();
  handleInstantAuction();
  handleCombees();
  handleMiltanks();
});

// Every hour, 2 minutes past the hour
const _jobStartOfHour = schedule.scheduleJob("2 * * * *", async function () {
  handleLottery();
  await doTunnel(); // Await because doEvent might also call handleTunnel
  handleEvent();
});

// Every hour, 6 minutes past the hour (22:00 is when wonder trade mons arrive)
const _jobEveryHourOffset = schedule.scheduleJob("6 * * * *", async function () {
  sortPokemonStorage(); // Includes Wonder Trade and Auction
});

// Every hour, 26 minutes past the hour
const _jobMidOfHour = schedule.scheduleJob("26 * * * *", async function () {
  interactWithBoxAnon(await getConfig("BLAME_USERNAME"));
});

// Hourly at *:57
const _jobEndOfHour = schedule.scheduleJob("57 * * * *", async function () {
  clickDitto();
  handleReturnMissingPlushies();
  handleDWShop();
  handleGoldenSlot();
});

// Every 4 Hours, one minute past the hour
const _jobEvery4Hours = schedule.scheduleJob("1 */4 * * *", async function () {
  checkOakChallenge();
  handleShadowHunt();
});

// Every 6 Hours, one minute past the hour
const _jobEvery6Hours = schedule.scheduleJob("1 */6 * * *", async function () {
  newsPage();
});

// Every couple of hours, defined by weather, one minute past the hour
const _jobWeather = schedule.scheduleJob("1 4,11,14,18,23 * * *", async function () {
  checkWeatherDaycare();
});

// At 11:00 and 23:00
const _jobTwicePerDay = schedule.scheduleJob("0 11,23 * * *", async function () {
  handleExchangeItem();
});

// At 00:01
const _jobStartOfDay = schedule.scheduleJob("1 0 * * *", async function () {
  handleFountain();
  handleMoveBerries();
  handleMissingNo();
  handleZygardeQuest();
  rowanQuest();
});

// At 05:00
const _jobMorning = schedule.scheduleJob("0 5 * * *", async function () {
  await reportStats();
  handleMassages();
  makeFurfrousPerm();
});

// At 20:30
const _jobEvening = schedule.scheduleJob("30 20 * * *", async function () {
  evolvePokemon();
});

// Every minute between 23:50 and 23:59
const _jobLastTenMinutes = schedule.scheduleJob("50-59 23 * * *", async function () {
  interactWithPartyAnon(process.env.APP_USERNAME, true);
});

// At 23:59
const _jobEndOfDayB = schedule.scheduleJob("59 23 * * *", async function () {
  handleRaffle();
  handleLeah();
});

// Run an hour before Shiny Wonder Trade, shortly after hourly box sorting.
const _jobTwiceAWeek = schedule.scheduleJob("15 21 * * 3,6", async function () {
  handleWonderTradeShiny();
});

// Run at 01:00 every Monday
const _jobMondayMorning = schedule.scheduleJob("0 1 * * 1", async function () {
  handleOakChallenge();
});

// Run at 08:05 every Sunday
const _jobSundayMorning = schedule.scheduleJob("5 8 * * 0", async function () {
  handleOakChallenge();
});

// Run at 23:59 every Sunday
const _jobEndOfWeek = schedule.scheduleJob("59 23 * * 0", async function () {
  trimLogFile();
});

// At 4:30:05 every Sunday. Takes pretty long to complete the quests and can only be completed at 4 AM and 4 PM game time.
const _jobOnceAWeek = schedule.scheduleJob("5 30 4,16 * * 0", async function () {
  spritesQuest(); // In hour 4:00 to 4:59 game time!
});

interactWithPokemons();
handleGardens();
handleSeedMakers();

// Game center
handleMemory();
handleTreasure();
handleWheel();

handleExpiringAuction();

handleTallGrass();

handleBugContest();
handleBeautyContest();
