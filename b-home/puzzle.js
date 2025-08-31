import { headers } from "../a-shared/const.js";
import { logMsg, logErr, logLevels } from "../a-shared/logger.js";

const tag = "PUZZLE";

async function collectPuzzlePiece(code = "") {
  return fetch(`https://pokeheroes.com/includes/ajax/puzzle/getPiece.php`, {
    headers: headers,
    referrer: "https://pokeheroes.com/",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: `code=${code}`,
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

export async function handlePuzzle(html = "") {
  try {
    const match = html.match(/addPuzzlePiece\(\s*(?<puz>\d+)\s*,\s*(?<pie>\d+)\s*,\s*['"](?<code>[^'"]+)['"]\s*\)/);

    if (match && match.groups) {
      const puz = parseInt(match.groups.puz, 10);
      const pie = parseInt(match.groups.pie, 10);
      const code = match.groups.code;
      logMsg(tag, logLevels.Valuable, `Collecting puzzle piece [${pie}/${puz}] with code [${code}].`);

      await collectPuzzlePiece(code);
    }
  } catch (error) {
    logErr(tag, ``, error);
  }
}
