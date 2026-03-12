import { useMemo } from "react";
import { getClubLogoUrl } from "../data/clubLogoMapping";
import { getFlagCodeForTeam, getSpanishTeamName } from "../data/teamMapping";

const COPY_BY_MODE = {
  national: {
    title: "Top 5 selecciones más buscadas",
    subtitle: "Basado en búsquedas de los últimos 30 días",
  },
  champions: {
    title: "Top 5 equipos más buscados",
    subtitle: "Basado en búsquedas de los últimos 30 días",
  },
};

const formatDate = (value) => {
  if (!value) return "";

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
};

const buildNationalFlagUrl = (team) => {
  const code = getFlagCodeForTeam(team);
  return code ? `https://flagcdn.com/w320/${code}.png` : "";
};

const shapeRailTeams = (mode, teams) =>
  (Array.isArray(teams) ? teams : []).map((team, index) => {
    const rank = Number(team?.rank) || index + 1;
    const rawName = String(team?.team || "").trim();
    const searches = Number(team?.searches) || 0;

    if (mode === "national") {
      const displayName = getSpanishTeamName(rawName) || rawName;
      return {
        rank,
        team: rawName,
        searches,
        displayName,
        imageUrl: buildNationalFlagUrl(rawName),
        imageAlt: displayName ? `Bandera de ${displayName}` : "",
        variant: "national",
      };
    }

    return {
      rank,
      team: rawName,
      searches,
      displayName: rawName,
      imageUrl: getClubLogoUrl(rawName),
      imageAlt: rawName ? `Escudo de ${rawName}` : "",
      variant: "champions",
    };
  });

function TopSearchSkeleton({ rank }) {
  return (
    <article className="top-search-card top-search-card--loading" aria-hidden="true">
      <span className="top-search-rank">{rank}</span>
      <div className="top-search-card__body">
        <div className="top-search-card__media-shell">
          <div className="top-search-card__media-skeleton" />
        </div>
        <div className="top-search-card__copy">
          <div className="top-search-card__line top-search-card__line--title" />
          <div className="top-search-card__line top-search-card__line--meta" />
        </div>
      </div>
    </article>
  );
}

export default function TopSearchedTeamsRail({
  mode,
  snapshotDate,
  calculatedAt,
  teams,
  loading,
  error,
}) {
  const copy = COPY_BY_MODE[mode] || COPY_BY_MODE.national;
  const shapedTeams = useMemo(() => shapeRailTeams(mode, teams), [mode, teams]);
  const snapshotLabel = formatDate(snapshotDate) || formatDate(calculatedAt);

  return (
    <section className="top-search-rail" aria-labelledby={`top-search-${mode}-title`}>
      <div className="top-search-rail__header">
        <div>
          <h3 id={`top-search-${mode}-title`} className="top-search-rail__title text-h3">
            {copy.title}
          </h3>
          <p className="top-search-rail__subtitle text-body-sm">{copy.subtitle}</p>
        </div>
        {snapshotLabel && (
          <p className="top-search-rail__meta text-caption">Actualizado {snapshotLabel}</p>
        )}
      </div>

      {loading && !shapedTeams.length ? (
        <div className="top-search-rail__track" role="status" aria-live="polite">
          {[1, 2, 3, 4, 5].map((rank) => (
            <TopSearchSkeleton key={rank} rank={rank} />
          ))}
        </div>
      ) : null}

      {!loading && error && !shapedTeams.length ? (
        <p className="top-search-rail__status text-caption" role="status">
          {error}
        </p>
      ) : null}

      {!loading && !error && !shapedTeams.length ? (
        <p className="top-search-rail__status text-caption" role="status">
          Todavía no hay suficientes búsquedas para mostrar este top 5.
        </p>
      ) : null}

      {shapedTeams.length > 0 ? (
        <>
          <div className="top-search-rail__track" role="list" aria-label={copy.title}>
            {shapedTeams.map((team) => (
              <article
                key={`${mode}-${team.rank}-${team.team}`}
                className={`top-search-card top-search-card--${team.variant}`}
                role="listitem"
              >
                <span className="top-search-rank">{team.rank}</span>
                <div className="top-search-card__body">
                  <div className={`top-search-card__media-shell top-search-card__media-shell--${team.variant}`}>
                    {team.imageUrl ? (
                      <img
                        src={team.imageUrl}
                        alt={team.imageAlt}
                        className={`top-search-card__media top-search-card__media--${team.variant}`}
                        loading="lazy"
                      />
                    ) : (
                      <div className="top-search-card__media-fallback" aria-hidden="true">
                        {team.displayName.slice(0, 1)}
                      </div>
                    )}
                  </div>
                  <div className="top-search-card__copy">
                    <p className="top-search-card__name text-body">{team.displayName}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
          {error ? (
            <p className="top-search-rail__status text-caption" role="status">
              {error}
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
