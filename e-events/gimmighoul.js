import { headers, URLs } from "../a-shared/const.js";

const searchString = "gimmighoul?egg=";

async function findURLsWithString(searchString) {
  const matchingURLs = [];
  const fetchPromises = URLs.map(async (url) => {
    try {
      const response = await fetch(url, {
        headers: headers,
        referrer: "https://pokeheroes.com/",
        referrerPolicy: "strict-origin-when-cross-origin",
        method: "GET",
        mode: "cors",
        credentials: "include",
      });
      const html = await response.text();

      if (html.includes(searchString)) {
        matchingURLs.push(url);
      }
    } catch (error) {
      console.error(`Error fetching ${url}:`, error);
    }
  });

  await Promise.all(fetchPromises);

  return matchingURLs;
}

export function doGimmiGhoulEggs() {
  findURLsWithString(searchString)
    .then((matchingURLs) => {
      console.log(`URLs containing "${searchString}":`);
      console.log(matchingURLs);
    })
    .catch((error) => {
      console.error("Error:", error);
    });
}
