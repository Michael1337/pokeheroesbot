import { headers } from "../a-shared/const.js";

const tag = "FAIR";

function viewWhack() {
  return fetch("https://pokeheroes.com/fair_whack", {
    headers: headers,
    referrer: "https://pokeheroes.com/fair",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function startWhack(code) {
  return fetch(`https://pokeheroes.com/fair_whack?start=${code}`, {
    headers: headers,
    referrer: "https://pokeheroes.com/fair_whack",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function endWhack(points, verification) {
  return fetch("https://pokeheroes.com/includes/ajax/square/fair_whack.php", {
    headers: headers,
    referrer: "https://pokeheroes.com/fair_whack?start=-1",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: `points=${points}&verification=${verification}`,
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

function simulateWhackGame(_verificationStr, _maxPoints, _diglettHits) {
  let verificationStr = _verificationStr;
  let timeLeft = 60; // Start with full time
  const maxPoints = _maxPoints; // Maximum achievable points
  const diglettHits = _diglettHits; // Total Digletts hit for a perfect game

  for (let i = 0; i < diglettHits; i++) {
    // Simulate random values for timeLeft and mouse coordinates
    timeLeft = Math.floor(Math.random() * 60) + 1; // Random time left
    const evPageX = Math.floor(Math.random() * 1920); // Random X coordinate
    const evPageY = Math.floor(Math.random() * 1080); // Random Y coordinate
    const pointsCollected = Math.floor(
      (Math.random() * maxPoints) / diglettHits,
    ); // Points per Diglett

    // Calculate verifyIdx
    const verifyIdx = timeLeft % verificationStr.length;

    // Modify verification string
    const originalChar = parseInt(verificationStr[verifyIdx]);
    const newChar = (
      (originalChar ^ (evPageX + evPageY * 1920)) +
      pointsCollected
    )
      .toString()
      .substring(0, 1); // Take only the first digit

    verificationStr =
      verificationStr.substring(0, verifyIdx) +
      newChar +
      verificationStr.substring(verifyIdx + 1);
  }

  return verificationStr;
}

export async function doWhack() {
  // Let response = await viewWhack();
  // Let html = await response.text();
  // Console.log(html)
  // Get start code

  // Let response = await startWhack();
  // Let html = await response.text();
  // Console.log(html)
  // // get script vars
  const verification = simulateWhackGame(
    "384392433757635554181667309241398994360876820113165234",
    100,
    41,
  );
  console.log(verification);

  // Let response = await endWhack(100, verification);
  // Let html = await response.text();
  // Console.log(html)

  return;
}

function viewMaze() {
  return fetch("https://pokeheroes.com/fair_maze", {
    headers: headers,
    referrer: "https://pokeheroes.com/fair",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function startMaze() {
  return fetch("https://pokeheroes.com/fair_maze?enter", {
    headers: headers,
    referrer: "https://pokeheroes.com/fair_maze?enter",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

// 1 up/right, -1 down/left, 0 nothing
function stepMaze(x = 0, y = 1) {
  return fetch(`https://pokeheroes.com/fair_maze?x=${x}&y=${y}`, {
    headers: headers,
    referrer: "https://pokeheroes.com/fair_maze?enter",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

// We could take the response, see if any arrow as a 1 (going "forward"). if item, pick up, if pokemon, fight.
// If no arrow, go back. but when backtracking, keep track of where we came from...

function startMazeBattle(battle = 0) {
  return fetch(`https://pokeheroes.com/battle?id=${battle}`, {
    headers: headers,
    referrer: "https://pokeheroes.com/fair_maze?x=-1&y=1",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

// TODO only seem to work if opponent is dead
function finishMazeBattle(battle = 0) {
  return fetch(`https://pokeheroes.com/fair_maze?finishBattle=${battle}`, {
    headers: headers,
    referrer: `https://pokeheroes.com/battle?id=${battle}`,
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

// TODO: Maybe the server tracks my current whereabouts. but then we can just claim after every step...
function claimMaze() {
  fetch("https://pokeheroes.com/fair_maze?claim", {
    headers: headers,
    referrer: "https://pokeheroes.com/fair_maze?x=-1&y=0",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function startFishing() {
  return fetch("https://pokeheroes.com/fair_fishing?start", {
    headers: headers,
    referrer: "https://pokeheroes.com/fair_fishing",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function catchFish(no = 0) {
  return fetch(
    "https://pokeheroes.com/includes/ajax/square/fair_catchduck.php",
    {
      headers: headers,
      referrer: "https://pokeheroes.com/fair_fishing?",
      referrerPolicy: "strict-origin-when-cross-origin",
      body: `no=${no}`,
      method: "POST",
      mode: "cors",
      credentials: "include",
    },
  );
}

export async function doFishing() {
  await startFishing();
  await catchFish(1);
}

function startShooter() {
  return fetch("https://pokeheroes.com/fair_shooter?start=1800", {
    headers: headers,
    referrer: "https://pokeheroes.com/fair_shooter",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function shootShooterValidation() {
  fetch(
    "https://pokeheroes.com/includes/ajax/square/fair_shooter_validation.php",
    {
      headers: headers,
      referrer: "https://pokeheroes.com/fair_shooter?start=1800",
      referrerPolicy: "strict-origin-when-cross-origin",
      body: "points=2&code=1260235&xPos=0&yPos=0&secret=1742737203&seed=0.555382297518384",
      method: "POST",
      mode: "cors",
      credentials: "include",
    },
  );
}

function finishShooter(start, score, code) {
  return fetch("https://pokeheroes.com/includes/ajax/square/fair_shooter.php", {
    headers: headers,
    referrer: "https://pokeheroes.com/fair_shooter?start=1800",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: "score=88&code=1260295",
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}
