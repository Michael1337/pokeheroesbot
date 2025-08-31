import { headers } from "../a-shared/const.js";
import { sendMail } from "../a-shared/email.js";
import { logErr } from "../a-shared/logger.js";

const tag = "Global Trade Station";

function getMyTrades() {
  return fetch("https://www.pokeheroes.com/gts_my_trades", {
    headers: headers,
    referrer: "https://www.pokeheroes.com/gts",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

/**
 * Checks for new offers on my trades.
 */
export async function checkMyTrades() {
  // TODO: Somehow needs to determine how long ago a new offer was made, or implement a cooldown. Otherwise, if a offer is made in the night, you get mails every 5 minutes.
  try {
    const html = await (await getMyTrades()).text();
    const blueTableMatches = html.match(/<table[^>]+id=["']blue_table["'][^>]*>/g) || [];
    const noOffersMatches = html.match(/There are no offers on this trade./g) || [];
    const giftMatches = html.match(/The recipient hasn't claimed this gift yet./g) || [];

    if (noOffersMatches.length + giftMatches.length < blueTableMatches.length) {
      sendMail(
        "Offers on one or more of your trades.",
        `You have an offer on [${blueTableMatches.length - noOffersMatches.length}] of your [${blueTableMatches.length}] trades. Go to https://www.pokeheroes.com/gts_my_trades to check them out.`,
      );
    }
  } catch (error) {
    logErr(tag, ``, error);
  }
}
