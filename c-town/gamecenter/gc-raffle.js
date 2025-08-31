import { headers } from "../../a-shared/const.js";
import { logMsg, logErr, logLevels } from "../../a-shared/logger.js";
import getConfig from "../../a-shared/config.js";

const tag = "RAFFLE";
let MINIMUM_NUMBER_OF_TICKETS = await getConfig("GC_MINIMUM_NUMBER_OF_TICKETS");
let DAILY_GC_LIMIT = await getConfig("GC_DAILY_RAFFLE_LIMIT"); // 50,000,000 GC = 500,000 tickets // 50,000,000 is enough for most magearnas except MB and shiny
let TARGET_CHANCE = await getConfig("GC_RAFFLE_TARGET_CHANCE");

function buyTickets(amount = MINIMUM_NUMBER_OF_TICKETS) {
  return fetch("https://pokeheroes.com/gc_magearna", {
    headers: headers,
    referrer: "https://pokeheroes.com/gc_magearna",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: `tickets=${amount}`,
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

function getGameChips(html) {
  const match = html.match(/gameChipsLeft">(?<chips>.*?)</);

  if (match && match.groups.chips) {
    return parseInt(match.groups.chips.replace(/,/g, ""), 10);
  } else {
    return null;
  }
}

function getMagearnaName(html) {
  const match = html.match(/<span style="font-size: 1\.5em; font-weight: bold">(?<name>.*?)<\/span>/);

  if (match && match.groups.name) {
    return match.groups.name;
  } else {
    return null;
  }
}

function getTicketValues(html) {
  const match = html.match(
    /Your tickets: (?<yourTickets>[\d,]+)\s*\|\|\s*Total\s*tickets: (?<totalTickets>[\d,]+).*?Your current chance of\s*winning: (?<chance>[\d.]+)%/s,
  );

  if (match) {
    const { yourTickets, totalTickets, chance } = match.groups;
    const yourTicketsNum = parseInt(yourTickets.replace(/,/g, ""), 10);
    const totalTicketsNum = parseInt(totalTickets.replace(/,/g, ""), 10);

    return {
      yourTickets: yourTicketsNum,
      totalTickets: totalTicketsNum,
      chance: parseFloat(chance),
      chanceReal: yourTicketsNum / totalTicketsNum,
    };
  } else {
    return null;
  }
}

function calculateTicketsToBuy(raffleInfo, targetPercentage) {
  // eslint-disable-next-line no-magic-numbers
  if (targetPercentage <= 0 || targetPercentage > 100) {
    throw new Error("Target percentage must be between 0 and 100");
  }

  // eslint-disable-next-line no-magic-numbers
  const targetFraction = targetPercentage / 100;

  if (raffleInfo.yourTickets / raffleInfo.totalTickets >= targetFraction) {
    return 0;
  }

  const additionalTickets = Math.ceil(
    (targetFraction * raffleInfo.totalTickets - raffleInfo.yourTickets) / (1 - targetFraction),
  );

  return additionalTickets;
}

export async function handleRaffle() {
  try {
    const ticketPrice = 100;
    MINIMUM_NUMBER_OF_TICKETS = await getConfig("GC_MINIMUM_NUMBER_OF_TICKETS");
    const html = await (await buyTickets(MINIMUM_NUMBER_OF_TICKETS)).text();

    const version = getMagearnaName(html);
    const values = getTicketValues(html);
    const gameChips = getGameChips(html);

    TARGET_CHANCE = await getConfig("GC_RAFFLE_TARGET_CHANCE");
    const ticketsToBuy = calculateTicketsToBuy(values, TARGET_CHANCE);
    const totalPrice = ticketsToBuy * ticketPrice;

    logMsg(
      tag,
      logLevels.Valuable,
      `Today's Magearna is a [${version}]. The target chance will be [${TARGET_CHANCE}]%. With [${values.yourTickets}] out of [${values.totalTickets}] tickets, the chance is at [${values.chance}]%.`,
    );

    if (version?.includes("Master") || version?.includes("Shiny")) {
      // TODO: Maybe adjust some limits here or send email
    }
    if (version?.includes("Magearna (Regular)") && !version?.includes("Shiny")) {
      // TODO: Maybe adjust some limits here to not get every magearna
    }

    if (TARGET_CHANCE <= values.chance) {
      logMsg(tag, logLevels.Valuable, `Target chance is already met. Not buying tickets.`);
      return;
    }

    logMsg(
      tag,
      logLevels.Valuable,
      `To reach [${TARGET_CHANCE}]%, [${ticketsToBuy}] more tickets are needed, which cost [${totalPrice}] of [${gameChips}] chips.`,
    );

    DAILY_GC_LIMIT = await getConfig("GC_DAILY_RAFFLE_LIMIT");
    if (totalPrice > gameChips || totalPrice > DAILY_GC_LIMIT) {
      const maxByChips = Math.floor(gameChips / ticketPrice);
      const maxByDailyLimit = Math.floor(DAILY_GC_LIMIT / ticketPrice) - values.yourTickets;
      const affordableTickets = Math.min(ticketsToBuy, maxByChips, maxByDailyLimit);

      if (affordableTickets > 0) {
        const finalPrice = affordableTickets * ticketPrice;
        logMsg(
          tag,
          logLevels.Valuable,
          `The price of [${totalPrice}] exceeds the game chips [${gameChips}] or the daily limit of [${DAILY_GC_LIMIT}]. Buying only [${affordableTickets}] tickets for [${finalPrice}] chips.`,
        );
        await buyTickets(affordableTickets);
      } else {
        logMsg(tag, logLevels.Valuable, `Cannot afford any tickets within chip or daily limit. No Tickets are bought.`);
      }
      return;
    } else {
      logMsg(tag, logLevels.Valuable, `Buying...`);
      await buyTickets(ticketsToBuy);
      return;
    }
  } catch (error) {
    logErr(tag, ``, error);
  }
}
