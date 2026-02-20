import { getClubLogoUrl } from "../data/clubLogoMapping";
import { getFlagCodeForTeam } from "../data/teamMapping";

const getNationalFlagUrl = (team) => {
  const code = getFlagCodeForTeam(team);
  if (!code) return "";
  return `https://flagcdn.com/w80/${code}.png`;
};

const getTeamImageUrl = (team, variant) => {
  if (variant === "champions") return getClubLogoUrl(team);
  return getNationalFlagUrl(team);
};

const formatDate = (value) => {
  if (!value) return "Fecha por confirmar";
  const match = String(value).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const [, year, month, day] = match;
    return `${day}/${month}/${year}`;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear());
  return `${day}/${month}/${year}`;
};

export default function FutureMatchPickCard({
  match,
  variant = "national",
  selectedOutcome = "",
  locked = false,
  submitting = false,
  onSelect,
}) {
  const homeImageUrl = getTeamImageUrl(match.home_team, variant);
  const awayImageUrl = getTeamImageUrl(match.away_team, variant);
  const disabled = locked || submitting;
  const subtitle = submitting
    ? "Registrando tu voto..."
    : locked
      ? "Tu voto fue registrado"
      : "¡Envía tu voto!";

  const options = [
    { key: "home_win", label: match.home_team, imageUrl: homeImageUrl },
    { key: "draw", label: "Empate", imageUrl: "" },
    { key: "away_win", label: match.away_team, imageUrl: awayImageUrl },
  ];

  return (
    <article className={`future-pick-card md-card md-card--outlined ${locked ? "future-pick-card--locked" : ""}`}>
      <div className="future-pick-header">
        <div>
          <h3 className="future-pick-title text-h3">¿Quién ganará?</h3>
          <p className="future-pick-subtitle">{subtitle}</p>
        </div>
        <p className="future-pick-date">{formatDate(match.match_date)}</p>
      </div>

      <div className="future-pick-options" role="group" aria-label={`Voto para ${match.home_team} vs ${match.away_team}`}>
        {options.map((option) => {
          const isSelected = selectedOutcome === option.key;
          return (
            <button
              key={option.key}
              type="button"
              className={`future-pick-option ${
                isSelected ? "future-pick-option--selected" : ""
              } ${locked ? "future-pick-option--locked" : ""}`}
              onClick={() => onSelect?.(option.key)}
              disabled={disabled}
              aria-pressed={isSelected}
            >
              {option.imageUrl && (
                <span className="future-pick-option-badge" aria-hidden="true">
                  <img src={option.imageUrl} alt="" />
                </span>
              )}
              <span className="future-pick-option-team">{option.label}</span>
            </button>
          );
        })}
      </div>
    </article>
  );
}
