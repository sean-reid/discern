import {
  ELO_K_USER,
  ELO_K_IMAGE,
  ELO_K_USER_PROVISIONAL,
  ELO_PROVISIONAL_GAMES,
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
 * Compute new Elo ratings after a swipe.
 *
 * If user guesses correctly: user Elo goes up, image Elo goes down (image was "easy").
 * If user guesses wrong: user Elo goes down, image Elo goes up (image was "hard").
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

  const newUserElo = clamp(userElo + rawUserDelta, ELO_MIN, ELO_MAX);
  const newImageElo = clamp(imageElo + rawImageDelta, ELO_MIN, ELO_MAX);

  return {
    newUserElo,
    newImageElo,
    userDelta: newUserElo - userElo,
    imageDelta: newImageElo - imageElo,
  };
}
