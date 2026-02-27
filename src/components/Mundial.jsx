import { useMemo, useState } from "react";
import groupsData from "../data/mundial/groups.json";
import knockoutData from "../data/mundial/knockout.json";
import {
    computeGroupStats,
    rankGroup,
    rankThirdPlace,
    assignThirdPlaceSlots,
    resolveBracket,
    extractThirdSlots,
    getMatchPrediction,
    coerceScoreInput,
    isDrawWithScores,
} from "../data/mundialUtils";
import { getFlagCodeForTeam } from "../data/teamMapping";

const sortMatches = (matches) => {
    return [...matches].sort((a, b) => {
        const dayA = a.matchday ?? 0;
        const dayB = b.matchday ?? 0;
        if (dayA !== dayB) return dayA - dayB;
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.time.localeCompare(b.time);
    });
};

const formatPlaceholder = (placeholder) => {
    if (!placeholder) return "Por definir";
    const value = placeholder.toUpperCase();
    const firstMatch = value.match(/^1([A-L])$/);
    if (firstMatch) return `Ganador Grupo ${firstMatch[1]}`;
    const secondMatch = value.match(/^2([A-L])$/);
    if (secondMatch) return `Segundo Grupo ${secondMatch[1]}`;
    const thirdMatch = value.match(/^3([A-L]+)$/);
    if (thirdMatch) return `Tercer Grupo ${thirdMatch[1].split("").join("/")}`;
    const winMatch = value.match(/^W(\\d+)$/);
    if (winMatch) return `Ganador ${winMatch[1]}`;
    const loseMatch = value.match(/^RU(\\d+)$/);
    if (loseMatch) return `Perdedor ${loseMatch[1]}`;
    return placeholder;
};

const getFlagUrl = (teamName) => {
    if (!teamName) return "";
    const code = getFlagCodeForTeam(teamName);
    if (!code) return "";
    return `https://flagcdn.com/w80/${code}.png`;
};

const getMatchDateInfo = (match) => {
    const source = match.localDate || match.date;
    if (!source) return { date: "", time: "" };
    const [datePart, timePartRaw = ""] = source.split("T");
    const timePart = timePartRaw.replace("Z", "");
    const [year, month, day] = datePart.split("-");
    const date = year && month && day ? `${day}.${month}.${year}` : datePart;
    const time = timePart ? timePart.slice(0, 5) : "";
    return { date, time };
};

const STAGE_LABELS = {
    "Round of 32": "Dieciseisavos de final",
    "Round of 16": "Octavos de final",
    "Quarter-final": "Cuartos de final",
    "Semi-final": "Semifinales",
    "Play-off for third place": "Tercer lugar",
    Final: "Final",
};

const formatStageName = (name) => STAGE_LABELS[name] || name;

const Mundial = ({ session, onRequestLogin }) => {
    const groups = groupsData.groups;
    const [selectedGroup, setSelectedGroup] = useState(groups[0]?.letter || "A");
    const [predictions, setPredictions] = useState({});
    const [calculatedGroups, setCalculatedGroups] = useState({});
    const handleLogin = onRequestLogin || (() => {});

    const matchesByGroup = useMemo(() => {
        const map = {};
        groupsData.matches.forEach((match) => {
            if (!map[match.groupId]) map[match.groupId] = [];
            map[match.groupId].push(match);
        });
        Object.keys(map).forEach((key) => {
            map[key] = sortMatches(map[key]);
        });
        return map;
    }, []);

    const groupLetterById = useMemo(() => {
        const map = {};
        groups.forEach((group) => {
            map[group.id] = group.letter;
        });
        return map;
    }, [groups]);

    const matchGroupLetterById = useMemo(() => {
        const map = {};
        groupsData.matches.forEach((match) => {
            const letter = groupLetterById[match.groupId];
            if (letter) {
                map[match.id] = letter;
            }
        });
        return map;
    }, [groupLetterById]);

    const selectedGroupObj = groups.find((group) => group.letter === selectedGroup);
    const selectedMatches = selectedGroupObj
        ? matchesByGroup[selectedGroupObj.id] || []
        : [];

    const groupRankings = useMemo(() => {
        return groups.map((group) => {
            const matches = matchesByGroup[group.id] || [];
            const stats = computeGroupStats(group.teams, matches, predictions);
            const ranked = rankGroup(stats, matches, predictions);
            return { group, ranked };
        });
    }, [groups, matchesByGroup, predictions]);

    const selectedRanking = groupRankings.find(
        (group) => group.group.id === selectedGroupObj?.id
    )?.ranked;

    const calculatedGroupRankings = useMemo(
        () => groupRankings.filter((entry) => calculatedGroups[entry.group.letter]),
        [groupRankings, calculatedGroups]
    );

    const rankedThird = useMemo(
        () => rankThirdPlace(calculatedGroupRankings),
        [calculatedGroupRankings]
    );
    const thirdSlots = useMemo(() => {
        const stage = knockoutData.stages.find((s) => s.order === 2);
        return extractThirdSlots(stage);
    }, []);
    const thirdAssignments = useMemo(
        () => assignThirdPlaceSlots(thirdSlots, rankedThird),
        [thirdSlots, rankedThird]
    );

    const groupRanksByLetter = useMemo(() => {
        const map = {};
        calculatedGroupRankings.forEach((entry) => {
            map[entry.group.letter] = entry.ranked;
        });
        return map;
    }, [calculatedGroupRankings]);

    const resolvedStages = useMemo(
        () => resolveBracket(knockoutData.stages, groupRanksByLetter, thirdAssignments, predictions),
        [groupRanksByLetter, thirdAssignments, predictions]
    );
    const knockoutStages = useMemo(
        () =>
            [...resolvedStages]
                .sort((a, b) => a.order - b.order)
                .map((stage) => ({
                    ...stage,
                    matches: [...stage.matches].sort((a, b) => {
                        const dateA = a.date || "";
                        const dateB = b.date || "";
                        return dateA.localeCompare(dateB);
                    }),
                })),
        [resolvedStages]
    );

    const topThirdIds = new Set(rankedThird.slice(0, 8).map((team) => String(team.team.id)));

    const updateMatchScore = (matchId, field, value) => {
        const groupLetter = matchGroupLetterById[matchId];
        if (groupLetter && calculatedGroups[groupLetter]) {
            setCalculatedGroups((prev) => ({ ...prev, [groupLetter]: false }));
        }
        setPredictions((prev) => {
            const current = getMatchPrediction(prev, matchId);
            const nextValue = coerceScoreInput(value);
            const next = {
                ...current,
                [field]: nextValue,
            };
            if (field === "homeScore" || field === "awayScore") {
                if (!isDrawWithScores(next)) {
                    next.winnerId = "";
                }
            }
            return { ...prev, [matchId]: next };
        });
    };

    const resetGroupPredictions = (groupId) => {
        if (!groupId) return;
        setPredictions((prev) => {
            const next = { ...prev };
            const matches = matchesByGroup[groupId] || [];
            matches.forEach((match) => {
                next[match.id] = { homeScore: "", awayScore: "", winnerId: "" };
            });
            return next;
        });
        const groupLetter = groupLetterById[groupId];
        if (groupLetter) {
            setCalculatedGroups((prev) => ({ ...prev, [groupLetter]: false }));
        }
    };

    const resetKnockoutFromStage = (stageOrder) => {
        if (stageOrder == null) return;
        setPredictions((prev) => {
            const next = { ...prev };
            knockoutStages
                .filter((stage) => stage.order >= stageOrder)
                .forEach((stage) => {
                    stage.matches.forEach((match) => {
                        next[match.id] = { homeScore: "", awayScore: "", winnerId: "" };
                    });
                });
            return next;
        });
    };

    const isMatchComplete = (matchId) => {
        const prediction = getMatchPrediction(predictions, matchId);
        return prediction.homeScore !== "" && prediction.awayScore !== "";
    };

    const selectedGroupComplete = selectedMatches.every((match) => isMatchComplete(match.id));

    const calculateSelectedGroup = () => {
        if (!selectedGroupObj?.letter) return;
        if (!selectedGroupComplete) return;
        setCalculatedGroups((prev) => ({ ...prev, [selectedGroupObj.letter]: true }));
    };

    const setWinner = (matchId, winnerId) => {
        setPredictions((prev) => {
            const current = getMatchPrediction(prev, matchId);
            return { ...prev, [matchId]: { ...current, winnerId } };
        });
    };

    const renderWinnerOption = (match, team, label, winnerId, onSelect) => {
        const flagUrl = team?.name ? getFlagUrl(team.name) : "";
        const isActive = winnerId && String(team?.id) === String(winnerId);
        return (
            <button
                type="button"
                className={`md-chip ${isActive ? "md-chip--selected" : ""}`}
                onClick={onSelect}
            >
                {flagUrl ? (
                    <>
                        <span
                            className="ko-flag ko-flag--sm"
                            style={{ "--flag-url": `url(${flagUrl})` }}
                            role="img"
                            aria-label={`Bandera de ${label}`}
                        />
                        <span className="sr-only">{label}</span>
                    </>
                ) : (
                    label
                )}
            </button>
        );
    };

    const renderKnockoutMatch = (match) => {
        if (!match) return null;
        const prediction = getMatchPrediction(predictions, match.id);
        const isDraw = isDrawWithScores(prediction);
        const homeLabel = match.homeTeam?.name || formatPlaceholder(match.placeholderA);
        const awayLabel = match.awayTeam?.name || formatPlaceholder(match.placeholderB);
        const homeFlagUrl = match.homeTeam?.name ? getFlagUrl(match.homeTeam.name) : "";
        const awayFlagUrl = match.awayTeam?.name ? getFlagUrl(match.awayTeam.name) : "";
        const canScore = Boolean(match.homeTeam && match.awayTeam);
        const winnerId = prediction.winnerId;
        const { date: matchDate, time: matchTime } = getMatchDateInfo(match);
        const matchCode = match.matchNumber ? `M${match.matchNumber}` : "";
        const homeIsWinner = winnerId && String(match.homeTeam?.id) === String(winnerId);
        const awayIsWinner = winnerId && String(match.awayTeam?.id) === String(winnerId);

        return (
            <div className="ko-row-wrap" key={match.id}>
                <div className="ko-row">
                    <span className="ko-date">{matchDate}</span>
                    <span className="ko-time">{matchTime}</span>
                    <div className={`ko-team ko-team--home ${homeIsWinner ? "ko-team--winner" : ""}`}>
                        <span className="ko-team-label">
                            {homeFlagUrl ? (
                                <span
                                    className="ko-flag"
                                    style={{ "--flag-url": `url(${homeFlagUrl})` }}
                                    role="img"
                                    aria-label={`Bandera de ${homeLabel}`}
                                />
                            ) : (
                                <span className="ko-shield" aria-hidden="true" />
                            )}
                            <span className="ko-team-text">{homeLabel}</span>
                        </span>
                    </div>
                    <div className="ko-score">
                        <input
                            type="number"
                            min="0"
                            className="score-input"
                            aria-label={`Goles de ${homeLabel} contra ${awayLabel}`}
                            value={prediction.homeScore}
                            disabled={!canScore}
                            onChange={(e) => updateMatchScore(match.id, "homeScore", e.target.value)}
                        />
                        <span>:</span>
                        <input
                            type="number"
                            min="0"
                            className="score-input"
                            aria-label={`Goles de ${awayLabel} contra ${homeLabel}`}
                            value={prediction.awayScore}
                            disabled={!canScore}
                            onChange={(e) => updateMatchScore(match.id, "awayScore", e.target.value)}
                        />
                    </div>
                    <div className={`ko-team ko-team--away ${awayIsWinner ? "ko-team--winner" : ""}`}>
                        <span className="ko-team-label">
                            {awayFlagUrl ? (
                                <span
                                    className="ko-flag"
                                    style={{ "--flag-url": `url(${awayFlagUrl})` }}
                                    role="img"
                                    aria-label={`Bandera de ${awayLabel}`}
                                />
                            ) : (
                                <span className="ko-shield" aria-hidden="true" />
                            )}
                            <span className="ko-team-text">{awayLabel}</span>
                        </span>
                    </div>
                    {matchCode && <span className="ko-match-id">{matchCode}</span>}
                </div>
                {canScore && isDraw && (
                    <div className="winner-select">
                        {renderWinnerOption(
                            match,
                            match.homeTeam,
                            homeLabel,
                            winnerId,
                            () => setWinner(match.id, match.homeTeam.id)
                        )}
                        {renderWinnerOption(
                            match,
                            match.awayTeam,
                            awayLabel,
                            winnerId,
                            () => setWinner(match.id, match.awayTeam.id)
                        )}
                    </div>
                )}
            </div>
        );
    };

    if (!session) {
        return (
            <div className="mundial-locked md-card md-card--outlined">
                <p className="text-body">Inicia sesión para armar tu mundial.</p>
                <button className="md-button md-button--filled md-button--cta" onClick={handleLogin}>
                    Inicia sesión
                </button>
            </div>
        );
    }

    return (
        <div className="mundial-shell">
            <div className="group-selector">
                {groups.map((group) => (
                    <button
                        key={group.id}
                        type="button"
                        className={`md-chip ${group.letter === selectedGroup ? "md-chip--selected" : ""}`}
                        onClick={() => setSelectedGroup(group.letter)}
                    >
                        Grupo {group.letter}
                    </button>
                ))}
            </div>

            <div className="group-grid">
                <div className="group-matches">
                    <h3 className="text-h3">Partidos {selectedGroupObj?.name}</h3>
                    <div className="match-list">
                        {selectedMatches.map((match) => {
                            const prediction = getMatchPrediction(predictions, match.id);
                            return (
                                <div className="match-row" key={match.id}>
                                    <div className="match-flag-col match-flag-col--left">
                                        <span
                                            className="match-flag"
                                            style={{ "--flag-url": `url(${getFlagUrl(match.home.name)})` }}
                                            role="img"
                                            aria-label={`Bandera de ${match.home.name}`}
                                        />
                                    </div>
                                    <div className="match-team match-team--home">
                                        <span>{match.home.name}</span>
                                    </div>
                                    <div className="match-score">
                                        <div className="match-score-main">
                                            <input
                                                type="number"
                                                min="0"
                                                className="score-input"
                                                aria-label={`Goles de ${match.home.name} contra ${match.away.name}`}
                                                value={prediction.homeScore}
                                                onChange={(e) =>
                                                    updateMatchScore(match.id, "homeScore", e.target.value)
                                                }
                                            />
                                            <span>:</span>
                                            <input
                                                type="number"
                                                min="0"
                                                className="score-input"
                                                aria-label={`Goles de ${match.away.name} contra ${match.home.name}`}
                                                value={prediction.awayScore}
                                                onChange={(e) =>
                                                    updateMatchScore(match.id, "awayScore", e.target.value)
                                                }
                                            />
                                        </div>
                                        <span className="match-date">{match.date}</span>
                                    </div>
                                    <div className="match-team match-team--away">
                                        <span>{match.away.name}</span>
                                    </div>
                                    <div className="match-flag-col match-flag-col--right">
                                        <span
                                            className="match-flag"
                                            style={{ "--flag-url": `url(${getFlagUrl(match.away.name)})` }}
                                            role="img"
                                            aria-label={`Bandera de ${match.away.name}`}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="group-actions">
                        <button
                            type="button"
                            className="md-button md-button--outlined"
                            onClick={() => resetGroupPredictions(selectedGroupObj?.id)}
                        >
                            Limpiar
                        </button>
                        <button
                            type="button"
                            className="md-button md-button--filled"
                            disabled={!selectedGroupComplete}
                            onClick={calculateSelectedGroup}
                        >
                            Calcular
                        </button>
                    </div>
                </div>

                <div className="group-table">
                    <h3 className="text-h3">Tabla {selectedGroupObj?.name}</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Equipo</th>
                                <th>P</th>
                                <th>DG</th>
                                <th>Pts</th>
                            </tr>
                        </thead>
                        <tbody>
                            {selectedRanking?.map((row) => (
                                <tr key={row.team.id}>
                                    <td>{row.rank}</td>
                                    <td>
                                        <span className="group-table-team-name">{row.team.name}</span>
                                    </td>
                                    <td>{row.played}</td>
                                    <td>{row.goalDiff}</td>
                                    <td>{row.points}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="third-place-card">
                <h3 className="text-h3">Mejores terceros</h3>
                <div className="third-list">
                    {rankedThird.map((team) => (
                        <div
                            key={team.team.id}
                            className={`third-item ${topThirdIds.has(String(team.team.id)) ? "third-item--qualified" : ""}`}
                        >
                            <span>{team.groupLetter}</span>
                            <strong>{team.team.name}</strong>
                            <span>{team.points} pts</span>
                            <span>DG {team.goalDiff}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="knockout-card">
                <div className="knockout-bracket">
                    {knockoutStages.map((stage) => (
                        <div className="knockout-round" key={stage.id}>
                            <div className="knockout-round-header">
                                <h3 className="text-h4">{formatStageName(stage.name)}</h3>
                                <button
                                    type="button"
                                    className="md-button md-button--outlined"
                                    onClick={() => resetKnockoutFromStage(stage.order)}
                                >
                                    Limpiar
                                </button>
                            </div>
                            <div className="knockout-matches">
                                {stage.matches.map((match) => renderKnockoutMatch(match))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Mundial;
