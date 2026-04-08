import {
  ELO_DEFAULT,
  ELO_K_USER,
  ELO_K_IMAGE,
  ELO_K_USER_PROVISIONAL,
  ELO_PROVISIONAL_GAMES,
  ELO_DECAY,
  ELO_MIN,
  ELO_MAX,
} from "./constants";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Expected probability that the user guesses correctly.
 * Higher user Elo → higher expected score.
 * Higher image Elo → harder image → lower expected score.
 */
export function expectedScore(userElo: number, imageElo: number): number {
  return 1 / (1 + Math.pow(10, (imageElo - userElo) / 400));
}

/**
 * Apply regression toward the mean (ELO_DEFAULT).
 * Prevents runaway inflation/deflation by gently pulling
 * all ratings toward 1200 each game.
 *
 * Guarantees: a win always returns a positive delta,
 * a loss always returns a negative delta — decay never
 * inverts the outcome direction.
 */
function applyDecay(elo: number, rawDelta: number): number {
  const decayed = elo + rawDelta + ELO_DECAY * (ELO_DEFAULT - (elo + rawDelta));

  // Ensure direction is preserved: win = positive, loss = negative
  if (rawDelta > 0) {
    return Math.max(elo + 1, decayed); // at least +1
  } else if (rawDelta < 0) {
    return Math.min(elo - 1, decayed); // at least -1
  }
  return decayed;
}

/**
 * Compute new Elo ratings after a swipe.
 *
 * If user guesses correctly: user Elo goes up, image Elo goes down.
 * If user guesses wrong: user Elo goes down, image Elo goes up.
 *
 * Both ratings are subject to regression toward 1200 (ELO_DECAY),
 * preventing inflation when the game is easy or deflation when hard.
 */
export function computeEloUpdate(
  userElo: number,
  imageElo: number,
  correct: boolean,
  userGamesPlayed: number
): {
  newUserElo: number;
  newImageElo: number;
  userDelta: number;
  imageDelta: number;
} {
  const expected = expectedScore(userElo, imageElo);
  const actual = correct ? 1 : 0;

  const kUser =
    userGamesPlayed < ELO_PROVISIONAL_GAMES
      ? ELO_K_USER_PROVISIONAL
      : ELO_K_USER;

  const rawUserDelta = kUser * (actual - expected);
  const rawImageDelta = ELO_K_IMAGE * (expected - actual);

  const newUserElo = clamp(applyDecay(userElo, rawUserDelta), ELO_MIN, ELO_MAX);
  const newImageElo = clamp(applyDecay(imageElo, rawImageDelta), ELO_MIN, ELO_MAX);

  return {
    newUserElo,
    newImageElo,
    userDelta: newUserElo - userElo,
    imageDelta: newImageElo - imageElo,
  };
}
