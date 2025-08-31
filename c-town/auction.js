import { headers, WAIT_TIMES } from "../a-shared/const.js";
import { logMsg, logErr, logLevels } from "../a-shared/logger.js";
import getConfig from "../a-shared/config.js";
import { delay } from "../a-shared/utils.js";

const tag = "AUCTION";
let MAX_BID_NORMAL = 1000;
let MAX_BID_SHINY = 10000;
const MAX_WAIT_MS = WAIT_TIMES.SIXTY_MINUTES;

function viewAuctions(sort = "exph") {
  return fetch(`https://pokeheroes.com/auction_search?search=pokedex&sort=${sort}`, {
    headers: headers,
    referrer: "https://pokeheroes.com/treasures",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function viewAuctionsLowestBid() {
  return fetch(`https://pokeheroes.com/auction_search?page=1&search=all&sort=bidl`, {
    headers: headers,
    referrer: "https://pokeheroes.com/treasures",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function getHighestBid(id = 0) {
  return fetch("https://pokeheroes.com/includes/ajax/auction/highestBid.php", {
    headers: headers,
    referrer: `https://pokeheroes.com/auction.php?id=${id}`,
    referrerPolicy: "strict-origin-when-cross-origin",
    body: `id=${id}`,
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

function placeBid(id, amount) {
  return fetch(`https://pokeheroes.com/auction.php?id=${id}`, {
    headers: headers,
    referrer: `https://pokeheroes.com/auction.php?id=${id}`,
    referrerPolicy: "strict-origin-when-cross-origin",
    body: `new_bid=${amount}`,
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

function getRecommendation(pkmnid = 0) {
  return fetch("https://pokeheroes.com/includes/ajax/auction/pkmn_price_recommendation.php", {
    headers: headers,
    referrer: "https://pokeheroes.com/auction_setup.php",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: `pkmnid=${pkmnid}`,
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

function auctionSetup(pkmnid = 0, startBid = 1, instantPrice, duration) {
  return fetch("https://pokeheroes.com/auction_setup.php", {
    headers: headers,
    referrer: "https://pokeheroes.com/auction_setup.php",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: `auction_pkmn=${pkmnid}&start_bid=${startBid}&instant_price=${instantPrice}&duration=${duration}`,
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

function getNextAuction(html) {
  const auctionRegex =
    /<a href='auction\.php\?id=(?<id>\d+)'[^>]*>.*?<img src='.*?c=(?<imgName>[^&']+).*?<b>Bid:<\/b>\s*(?<bid>[\d,]+)(?:.*?<b>Instant:<\/b>\s*(?<instant>[\d,]+))?.*?data-countTo='(?<countTo>\d+)'/is;
  const match = html.match(auctionRegex);

  if (!match) return null;

  const { id, imgName, bid, instant, countTo } = match.groups;
  const currentTimestampInSeconds = Math.ceil(Date.now() / 1000); // Convert current time to seconds

  const result = {
    id,
    imgName: imgName.split(".")[0], // Ensures no file extension
    currentBid: Number(bid.replace(/,/g, "")),
    instant: instant ? Number(instant.replace(/,/g, "")) : undefined,
    remainingTime: parseInt(countTo, 10) - currentTimestampInSeconds,
  };

  return result;
}

function getBidNumber(html) {
  const match = html.match(/^(?<number>[\d,]+)/);

  if (!match) throw new Error("No number found");

  const cleanedNumber = match.groups.number.replace(/,/g, "");
  return parseInt(cleanedNumber, 10);
}

export async function handleExpiringAuction() {
  while (true) {
    try {
      const html = await (await viewAuctions("exph")).text();
      const auction = getNextAuction(html);

      if (!auction) {
        await delay(WAIT_TIMES.TEN_SECONDS);
        continue;
      }

      if (auction.remainingTime >= 1) {
        // Update max bids in case they changed.
        [MAX_BID_SHINY, MAX_BID_NORMAL] = await Promise.all([getConfig("AUCTION_MAX_BID_SHINY"), getConfig("AUCTION_MAX_BID_NORMAL")]);

        if (auction.currentBid <= MAX_BID_SHINY) {
          logMsg(
            tag,
            logLevels.Valuable,
            `Next auction for a [${auction.imgName}] for [${auction.currentBid}] ends in [${auction.remainingTime}] seconds...`,
          );
        }

        // Wait until just before auction ends, but maximum of one hour in case a new auction is set up in the mean time.
        const waitMs = Math.min(auction.remainingTime * 1000 - WAIT_TIMES.HALF_SECOND, MAX_WAIT_MS);
        if (waitMs > 0) {
          await delay(waitMs);
        }
        continue; // To make sure auction is actually still there.
      }

      const highestBidHtml = await (await getHighestBid(auction.id)).text();
      const highestBid = getBidNumber(highestBidHtml);

      const isShiny = /^1/.test(auction.imgName);
      const maxBid = isShiny ? MAX_BID_SHINY : MAX_BID_NORMAL;

      if (highestBid < maxBid) {
        logMsg(tag, logLevels.Valuable, `Bidding [${highestBid + 1}] in [${auction.id}] on a [${auction.imgName}]!`);
        await placeBid(auction.id, highestBid + 1);
      }

      await delay(WAIT_TIMES.HALF_SECOND);
    } catch (error) {
      logErr(tag, ``, error);
      await delay(WAIT_TIMES.TWO_MINUTES);
    }
  }
}

export async function handleInstantAuction() {
  try {
    const html = await (await viewAuctions("insl")).text();
    const auction = getNextAuction(html);
    if (!auction) return;
    const instant = auction.instant;
    const isShiny = /^1/.test(auction.imgName);

    const maxBid = isShiny ? await getConfig("AUCTION_MAX_BID_SHINY") : await getConfig("AUCTION_MAX_BID_NORMAL");

    if (instant < maxBid) {
      const response = await (await placeBid(auction.id, instant)).text();
      if (response.includes("ERROR: You cannot do more than 5 instant purchases per day!")) {
        logMsg(
          tag,
          logLevels.Valuable,
          `Can't buy a [${auction.imgName}] for [${instant}] in [${auction.id}] because maximum of 5 instant buys reached! Waiting to bid normally instead...`,
        );
      } else {
        logMsg(tag, logLevels.Valuable, `Buying a [${auction.imgName}] for [${instant}] in [${auction.id}]!`);
      }
    }
  } catch (error) {
    logErr(tag, ``, error);
  }
}

export async function bidOnSomeAuction() {
  try {
    const html = await (await viewAuctionsLowestBid()).text();
    const auction = getNextAuction(html);
    if (!auction) return;

    const highestBidHtml = await (await getHighestBid(auction.id)).text();
    const highestBid = getBidNumber(highestBidHtml);

    logMsg(tag, logLevels.Valuable, `Bidding [${highestBid + 1}] in [${auction.id}] on a [${auction.imgName}]!`);
    await placeBid(auction.id, highestBid + 1);
  } catch (error) {
    logErr(tag, ``, error);
  }
}

async function setupAuction(pkmns = []) {
  const defaultAuctionDuration = 1;
  const defaultDiscountMin = (await getConfig("AUCTION_MIN_MULTI")) || 1.0;
  const defaultDiscountMax = (await getConfig("AUCTION_MAX_MULTI")) || 1.0;

  for (const pkmn of pkmns) {
    const response = await getRecommendation(pkmn.id);
    const data = await response.json(); // {"RecommendedPrice":"23,750 - 95,000"}
    if (!data.RecommendedPrice) {
      logMsg(
        tag,
        logLevels.Debug,
        `Could not auction Pokemon ID [${pkmn.id}], Name [${pkmn.speciesName}] because no recommended price.`,
      );
      continue;
    }
    const minStr = data.RecommendedPrice.split(" - ")[0];
    const maxStr = data.RecommendedPrice.split(" - ")[1] || minStr;

    const minPrice = Math.floor(parseInt(minStr.replace(/,/g, ""), 10) * defaultDiscountMin);
    const maxPrice = Math.floor(parseInt(maxStr.replace(/,/g, ""), 10) * defaultDiscountMax);

    logMsg(
      tag,
      logLevels.Interesting,
      `Auctioning Pokemon ID [${pkmn.id}], Name [${pkmn.speciesName}] for [${minPrice} ~ ${maxPrice}].`,
    );

    await auctionSetup(pkmn.id, minPrice, maxPrice, defaultAuctionDuration);
  }
}

export async function doAuctionSetup(pkmns = []) {
  await setupAuction(pkmns);
}
