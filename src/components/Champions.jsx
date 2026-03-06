import { memo, useEffect, useState } from "react";
import Search from "./Search";
import ModelCard from "./ModelCard";
import FutureMatchPickCard from "./FutureMatchPickCard";
import SupportBanner from "./SupportBanner";
import { supabase } from "../supabaseClient";
import { CHAMPIONS_KO_TEAMS } from "../data/championsTeams";
import { getClubLogoUrl } from "../data/clubLogoMapping";
import useInView from "../hooks/useInView";
import { parsePredictionResponse } from "../utils/predictionPayload";
import championsBackground from "../assets/champions_background_5_1920.jpg";

const formatRelative = (timestamp, nowMs) => {
  if (!timestamp) return "";
  const delta = Math.max(0, nowMs - timestamp);
  if (delta < 45000) return "hace unos segundos";
  const minutes = Math.floor(delta / 60000);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} d`;
};

const RelativeTime = memo(function RelativeTime({ timestamp }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!timestamp) return undefined;
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, [timestamp]);

  if (!timestamp) return null;
  return <p className="results-time text-overline">Actualizado {formatRelative(timestamp, now)}</p>;
});

export default function Champions({ session, apiBaseUrl, onRequestLogin, heroTags = [] }) {
  const [homeTeam, setHomeTeam] = useState("");
  const [awayTeam, setAwayTeam] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [prediction, setPrediction] = useState(null);
  const [futureMatches, setFutureMatches] = useState([]);
  const [selectedOutcomeByMatchId, setSelectedOutcomeByMatchId] = useState({});
  const [lockedMatchIds, setLockedMatchIds] = useState({});
  const [submittingMatchId, setSubmittingMatchId] = useState("");
  const [futureMatchVoteError, setFutureMatchVoteError] = useState("");
  const [predictionTimestamp, setPredictionTimestamp] = useState(null);
  const [resultTeams, setResultTeams] = useState(null);
  const [resultsRef, resultsInView] = useInView({ threshold: 0.1 });

  const toPct = (x) => `${Math.round(x * 100)}%`;
  const pct = (value) => Math.max(2, Math.round((value ?? 0) * 100));
  const displayTeams = resultTeams || { homeTeam, awayTeam };
  const homeLogoUrl = getClubLogoUrl(displayTeams.homeTeam);
  const awayLogoUrl = getClubLogoUrl(displayTeams.awayTeam);

  const getConsensus = (payload) => {
    if (!payload) return null;
    const models = Object.values(payload);
    if (!models.length) return null;
    const totals = models.reduce(
      (acc, cur) => ({
        home_win: acc.home_win + (cur?.home_win ?? 0),
        draw: acc.draw + (cur?.draw ?? 0),
        away_win: acc.away_win + (cur?.away_win ?? 0),
      }),
      { home_win: 0, draw: 0, away_win: 0 }
    );
    const avg = {
      home_win: totals.home_win / models.length,
      draw: totals.draw / models.length,
      away_win: totals.away_win / models.length,
    };
    const bestKey = Object.entries(avg).reduce(
      (best, cur) => (cur[1] > best[1] ? cur : best),
      ["home_win", -Infinity]
    )[0];
    return { avg, bestKey };
  };

  const outcomeLabel = (key) => {
    if (key === "home_win") return displayTeams.homeTeam;
    if (key === "away_win") return displayTeams.awayTeam;
    return "Empate";
  };

  const consensus = getConsensus(prediction);
  const favoriteTeamImageUrl =
    consensus?.bestKey === "home_win"
      ? homeLogoUrl
      : consensus?.bestKey === "away_win"
        ? awayLogoUrl
        : "";

  const fetchPrediction = async () => {
    if (!homeTeam || !awayTeam) {
      setErrorMessage("Selecciona ambos equipos.");
      return;
    }
    if (homeTeam === awayTeam) {
      setErrorMessage("Los equipos no pueden ser iguales.");
      return;
    }

    try {
      const { data: sessionData, error } = await supabase.auth.getSession();
      if (error) throw error;
      const token = sessionData?.session?.access_token;

      if (!token) {
        setErrorMessage("Debes iniciar sesión para obtener una predicción.");
        return;
      }

      setIsLoading(true);
      setErrorMessage("");
      setFutureMatchVoteError("");

      const response = await fetch(`${apiBaseUrl}/predict`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          home_team: homeTeam,
          away_team: awayTeam,
          mode: "champions",
        }),
      });

      if (!response.ok) {
        let serverMessage = "";
        try {
          const errorPayload = await response.json();
          serverMessage = errorPayload?.detail || errorPayload?.error || errorPayload?.message || "";
        } catch {
          serverMessage = "";
        }
        const statusSuffix = response.status ? ` (HTTP ${response.status})` : "";
        throw new Error(serverMessage ? `${serverMessage}${statusSuffix}` : `Request failed${statusSuffix}`);
      }

      const responseData = await response.json();
      const { modelProbabilities, futureMatches: parsedFutureMatches } = parsePredictionResponse(responseData);
      setPrediction(modelProbabilities);
      setFutureMatches(parsedFutureMatches);
      setSelectedOutcomeByMatchId({});
      setLockedMatchIds({});
      setSubmittingMatchId("");
      setFutureMatchVoteError("");
      setPredictionTimestamp(Date.now());
      setResultTeams({ homeTeam, awayTeam });
    } catch (err) {
      console.error("Error fetching champions prediction:", err);
      const fallback = "No se pudo obtener la predicción. Intenta más tarde.";
      const message = err?.message && err.message !== "Failed to fetch" ? `${fallback} ${err.message}` : fallback;
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitFutureMatchPrediction = async (matchId, predictedOutcome) => {
    if (!matchId || !predictedOutcome) return;
    if (lockedMatchIds[matchId] || submittingMatchId === matchId) return;

    try {
      setFutureMatchVoteError("");
      const { data: sessionData, error } = await supabase.auth.getSession();
      if (error) throw error;
      const token = sessionData?.session?.access_token;

      if (!token) {
        setFutureMatchVoteError("Debes iniciar sesión para votar este partido.");
        return;
      }

      setSubmittingMatchId(matchId);
      const response = await fetch(`${apiBaseUrl}/match-predictions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          match_id: matchId,
          predicted_outcome: predictedOutcome,
        }),
      });

      if (!response.ok) {
        let message = "";
        try {
          const errorPayload = await response.json();
          message = errorPayload?.detail || errorPayload?.error || errorPayload?.message || "";
        } catch {
          message = "";
        }
        if (response.status === 401 || response.status === 403) {
          throw new Error("Debes iniciar sesión para votar este partido.");
        }
        throw new Error(message || "No se pudo registrar tu voto. Intenta de nuevo.");
      }

      const payload = await response.json();
      const savedOutcome = payload?.prediction?.predicted_outcome || predictedOutcome;
      setSelectedOutcomeByMatchId((prev) => ({
        ...prev,
        [matchId]: savedOutcome,
      }));
      setLockedMatchIds((prev) => ({
        ...prev,
        [matchId]: true,
      }));
    } catch (error) {
      console.error("Error submitting champions match prediction:", error);
      setFutureMatchVoteError(error?.message || "No se pudo registrar tu voto. Intenta de nuevo.");
    } finally {
      setSubmittingMatchId((current) => (current === matchId ? "" : current));
    }
  };

  return (
    <section id="champions" className="champions-page">
      <section id="home" className="hero-section">
        <div
          className="hero hero--champions"
          style={{ "--champions-hero-bg": `url(${championsBackground})` }}
        >
          <div className="hero-content">
            <h1 className="hero-title text-display-xl">
              <span className="hero-title-line">Arma tu predicción de champions</span>
            </h1>
            <div className="predictor-shell md-card md-card--elevated">
              <div className="predictor-body">
                <div className="team-grid">
                  <Search
                    label="Equipo Local"
                    placeholder="Ej: Real Madrid"
                    searchTerm={homeTeam}
                    setSearchTerm={setHomeTeam}
                    options={CHAMPIONS_KO_TEAMS}
                  />
                  <Search
                    label="Equipo Visitante"
                    placeholder="Ej: Benfica"
                    searchTerm={awayTeam}
                    setSearchTerm={setAwayTeam}
                    options={CHAMPIONS_KO_TEAMS}
                  />
                </div>

                <div className="predictor-actions">
                  <button
                    type="button"
                    onClick={session ? fetchPrediction : onRequestLogin}
                    disabled={isLoading}
                    className={`md-button md-button--filled md-button--cta ${isLoading ? "predictor-button--loading" : ""}`}
                  >
                    {isLoading ? (
                      <span className="calc-loading-text" aria-live="polite">
                        Calculando
                        <span className="calc-loading-balls" aria-hidden="true">
                          <span className="calc-loading-ball-dot">⚽</span>
                          <span className="calc-loading-ball-dot">⚽</span>
                          <span className="calc-loading-ball-dot">⚽</span>
                        </span>
                      </span>
                    ) : session ? (
                      "Calcular"
                    ) : (
                      "Inicia sesión"
                    )}
                  </button>

                  {errorMessage && (
                    <div className="md-inline-alert" role="alert">
                      {errorMessage}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      {heroTags.length > 0 && (
        <div className="tagline-marquee">
          <div className="marquee-track">
            {heroTags.concat(heroTags).map((tag, idx) => (
              <span key={`${tag}-${idx}`} className="marquee-tag">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {prediction && (
        <section
          ref={resultsRef}
          className={`insight-section md-card md-card--elevated section-reveal ${resultsInView ? "section-visible" : ""}`}
          id="resultados"
        >
          <div className="section-header">
            <h2 className="section-title text-display-lg">
              Probabilidades para {displayTeams.homeTeam} vs {displayTeams.awayTeam}
            </h2>
            <RelativeTime timestamp={predictionTimestamp} />
          </div>
          {consensus && <SupportBanner context="prediction" compact />}
          {consensus && (
            <div className="consensus-strip md-card md-card--filled">
              <div className="consensus-left">
                <p className="consensus-kicker text-overline">Favorito del consenso</p>
                <div className="consensus-favorite-row">
                  {favoriteTeamImageUrl && (
                    <span
                      className="consensus-favorite-flag consensus-favorite-flag--logo"
                      style={{ "--flag-url": `url(${favoriteTeamImageUrl})` }}
                      aria-hidden="true"
                    />
                  )}
                  <p className="consensus-pick text-h2">
                    <strong>{outcomeLabel(consensus.bestKey)}</strong>
                  </p>
                </div>
              </div>
              <div className="consensus-chips">
                <div
                  className={`outcome-card outcome-card--with-flag consensus-chip ${consensus.bestKey === "home_win" ? "outcome-card--active" : ""}`}
                  style={homeLogoUrl ? { "--flag-url": `url(${homeLogoUrl})` } : undefined}
                >
                  <div className="outcome-header">
                    <p className={`outcome-label ${consensus.bestKey === "home_win" ? "text--active" : "text--inactive"}`}>
                      <span className="outcome-name">{displayTeams.homeTeam}</span>
                    </p>
                  </div>
                  <p className={`outcome-value ${consensus.bestKey === "home_win" ? "text--active" : "text--inactive"}`}>
                    {toPct(consensus.avg.home_win)}
                  </p>
                  <div className="bar-track" aria-hidden="true">
                    <div
                      className={`bar-fill ${consensus.bestKey === "home_win" ? "bar--active" : "bar--inactive"}`}
                      style={{ width: `${pct(consensus.avg.home_win)}%` }}
                    />
                  </div>
                </div>
                <div className={`outcome-card consensus-chip ${consensus.bestKey === "draw" ? "outcome-card--active" : ""}`}>
                  <div className="outcome-header">
                    <p className={`outcome-label ${consensus.bestKey === "draw" ? "text--active" : "text--inactive"}`}>
                      <span className="outcome-name">Empate</span>
                    </p>
                  </div>
                  <p className={`outcome-value ${consensus.bestKey === "draw" ? "text--active" : "text--inactive"}`}>
                    {toPct(consensus.avg.draw)}
                  </p>
                  <div className="bar-track" aria-hidden="true">
                    <div
                      className={`bar-fill ${consensus.bestKey === "draw" ? "bar--active" : "bar--inactive"}`}
                      style={{ width: `${pct(consensus.avg.draw)}%` }}
                    />
                  </div>
                </div>
                <div
                  className={`outcome-card outcome-card--with-flag consensus-chip ${consensus.bestKey === "away_win" ? "outcome-card--active" : ""}`}
                  style={awayLogoUrl ? { "--flag-url": `url(${awayLogoUrl})` } : undefined}
                >
                  <div className="outcome-header">
                    <p className={`outcome-label ${consensus.bestKey === "away_win" ? "text--active" : "text--inactive"}`}>
                      <span className="outcome-name">{displayTeams.awayTeam}</span>
                    </p>
                  </div>
                  <p className={`outcome-value ${consensus.bestKey === "away_win" ? "text--active" : "text--inactive"}`}>
                    {toPct(consensus.avg.away_win)}
                  </p>
                  <div className="bar-track" aria-hidden="true">
                    <div
                      className={`bar-fill ${consensus.bestKey === "away_win" ? "bar--active" : "bar--inactive"}`}
                      style={{ width: `${pct(consensus.avg.away_win)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
          <div className="results-grid">
            <div className={`models-card md-card md-card--elevated reveal ${resultsInView ? "reveal-visible" : "reveal-hidden"}`}>
              {Object.entries(prediction).map(([modelName, probs]) => {
                const title = modelName === "mlp" ? "RED NEURONAL" : modelName.replaceAll("_", " ").toUpperCase();
                return (
                  <ModelCard
                    key={modelName}
                    title={title}
                    probs={probs}
                    homeTeam={displayTeams.homeTeam}
                    awayTeam={displayTeams.awayTeam}
                    toPct={toPct}
                    getTeamImageUrl={getClubLogoUrl}
                  />
                );
              })}
            </div>
          </div>
          {futureMatches.length > 0 && (
            <div className="future-picks-section md-card md-card--filled">
              <div className="section-header section-header--balanced">
                <h3 className="section-title text-display-sm">Pronostica próximos partidos</h3>
              </div>
              {futureMatchVoteError && (
                <div className="md-inline-alert" role="alert">
                  {futureMatchVoteError}
                </div>
              )}
              <div className="future-picks-list">
                {futureMatches.map((match) => (
                  <FutureMatchPickCard
                    key={match.match_id}
                    match={match}
                    variant="champions"
                    selectedOutcome={selectedOutcomeByMatchId[match.match_id] || ""}
                    locked={Boolean(lockedMatchIds[match.match_id])}
                    submitting={submittingMatchId === match.match_id}
                    onSelect={(outcome) => handleSubmitFutureMatchPrediction(match.match_id, outcome)}
                  />
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </section>
  );
}
