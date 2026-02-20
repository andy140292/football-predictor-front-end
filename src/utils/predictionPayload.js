const isFiniteNumber = (value) => Number.isFinite(Number(value));

const isModelProbabilities = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return (
    isFiniteNumber(value.home_win) &&
    isFiniteNumber(value.draw) &&
    isFiniteNumber(value.away_win)
  );
};

const normalizeFutureMatch = (match) => {
  const matchId = String(match?.match_id || "").trim();
  const homeTeam = String(match?.home_team || "").trim();
  const awayTeam = String(match?.away_team || "").trim();
  const matchDate = String(match?.match_date || "").trim();

  if (!matchId || !homeTeam || !awayTeam) return null;

  return {
    match_id: matchId,
    home_team: homeTeam,
    away_team: awayTeam,
    match_date: matchDate ? matchDate.slice(0, 10) : "",
  };
};

export const parsePredictionPayload = (rawPayload) => {
  const payload = rawPayload && typeof rawPayload === "object" ? rawPayload : {};

  const modelProbabilities = Object.entries(payload).reduce((acc, [key, value]) => {
    if (key === "future_matches" || !isModelProbabilities(value)) return acc;
    acc[key] = {
      home_win: Number(value.home_win),
      draw: Number(value.draw),
      away_win: Number(value.away_win),
    };
    return acc;
  }, {});

  const futureMatches = Array.isArray(payload.future_matches)
    ? payload.future_matches.map(normalizeFutureMatch).filter(Boolean)
    : [];

  return { modelProbabilities, futureMatches };
};

export const parsePredictionResponse = (responseData) => {
  const payload = responseData?.predicción ?? responseData?.prediccion ?? responseData;
  return parsePredictionPayload(payload);
};
