import { getFlagCodeForTeam } from "../data/teamMapping";

export default function ModelCard({
  title,
  probs,
  homeTeam,
  awayTeam,
  toPct,
  getTeamImageUrl,
}) {
  const pct = (value) => Math.max(2, Math.round(value * 100));

  const bestKey = Object.entries(probs).reduce(
    (best, cur) => (cur[1] > best[1] ? cur : best),
    ["home_win", -Infinity]
  )[0];

  const isBest = (key) => key === bestKey;

  const labelSizeClass = (name) => {
    const length = name?.length ?? 0;
    if (length > 24) return "outcome-label--xxlong";
    if (length > 18) return "outcome-label--xlong";
    if (length > 12) return "outcome-label--long";
    return "";
  };

  const getFlagUrl = (team) => {
    const code = getFlagCodeForTeam(team);
    if (!code) return "";
    return `https://flagcdn.com/w320/${code}.png`;
  };

  const resolveTeamImageUrl = (team) => {
    if (typeof getTeamImageUrl === "function") {
      const customUrl = getTeamImageUrl(team);
      if (customUrl) return customUrl;
    }
    return getFlagUrl(team);
  };

  const homeFlagUrl = resolveTeamImageUrl(homeTeam);
  const awayFlagUrl = resolveTeamImageUrl(awayTeam);

  return (
    <div className="model-card">
      <div className="outcomes-row">
        {/* Home */}
        <div
          className={`outcome-card outcome-card--with-flag ${isBest("home_win") ? "outcome-card--active" : ""}`}
          style={homeFlagUrl ? { "--flag-url": `url(${homeFlagUrl})` } : undefined}
        >
          <div className="outcome-header">
            <p
              className={`outcome-label ${labelSizeClass(homeTeam)} ${
                isBest("home_win") ? "text--active" : "text--inactive"
              }`}
            >
            <span className="outcome-name">{homeTeam}</span>
            </p>
          </div>
          <p className={`outcome-value ${isBest("home_win") ? "text--active" : "text--inactive"}`}>
            {toPct(probs.home_win)}
          </p>
          <div className="bar-track" aria-hidden="true">
            <div
              className={`bar-fill ${isBest("home_win") ? "bar--active" : "bar--inactive"}`}
              style={{ width: `${pct(probs.home_win)}%` }}
            />
          </div>
        </div>

        {/* Draw */}
        <div
          className={`outcome-card ${isBest("draw") ? "outcome-card--active" : ""}`}
        >
          <div className="outcome-header">
            <p className={`outcome-label ${isBest("draw") ? "text--active" : "text--inactive"}`}>
            <span className="outcome-name">Empate</span>
            </p>
          </div>
          <p className={`outcome-value ${isBest("draw") ? "text--active" : "text--inactive"}`}>
            {toPct(probs.draw)}
          </p>
          <div className="bar-track" aria-hidden="true">
            <div
              className={`bar-fill ${isBest("draw") ? "bar--active" : "bar--inactive"}`}
              style={{ width: `${pct(probs.draw)}%` }}
            />
          </div>
        </div>

        {/* Away */}
        <div
          className={`outcome-card outcome-card--with-flag ${isBest("away_win") ? "outcome-card--active" : ""}`}
          style={awayFlagUrl ? { "--flag-url": `url(${awayFlagUrl})` } : undefined}
        >
          <div className="outcome-header">
            <p
              className={`outcome-label ${labelSizeClass(awayTeam)} ${
                isBest("away_win") ? "text--active" : "text--inactive"
              }`}
            >
            <span className="outcome-name">{awayTeam}</span>
            </p>
          </div>
          <p className={`outcome-value ${isBest("away_win") ? "text--active" : "text--inactive"}`}>
            {toPct(probs.away_win)}
          </p>
          <div className="bar-track" aria-hidden="true">
            <div
              className={`bar-fill ${isBest("away_win") ? "bar--active" : "bar--inactive"}`}
              style={{ width: `${pct(probs.away_win)}%` }}
            />
          </div>
        </div>
        <div className="model-card-header">
          <h3 className="model-title text-overline">{title}</h3>
        </div>
      </div>
    </div>
  );
}
