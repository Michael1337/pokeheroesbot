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
  }).catch((err) => console.error("Secondary request failed:", err));
  isInternalFetch = false;

  // Return new response instead of original to prevent some bugs
  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
};
import { sortPokemonStorage } from "../b-home/pokemon-storage.js";

sortPokemonStorage();
