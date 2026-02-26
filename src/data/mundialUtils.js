const scoreToNumber = (value) => {
    if (value === null || value === undefined || value === "") return null;
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0) return null;
    return Math.floor(num);
};

const getFairPlayScore = (team, fairPlayMap) => {
    if (!team || !fairPlayMap) return 0;
    const byId = fairPlayMap[String(team.id)];
    if (Number.isFinite(byId)) return byId;
    const byName = fairPlayMap[team.name];
    return Number.isFinite(byName) ? byName : 0;
};

const getFifaRanking = (team, rankingMap) => {
    if (!team || !rankingMap) return null;
    const byId = rankingMap[String(team.id)];
    if (Number.isFinite(byId)) return byId;
    const byName = rankingMap[team.name];
    return Number.isFinite(byName) ? byName : null;
};

const buildMiniStats = (teams, matches, predictions) => {
    const ids = new Set(teams.map((entry) => String(entry.team.id)));
    const mini = new Map();
    teams.forEach((entry) => {
        mini.set(String(entry.team.id), {
            points: 0,
            goalsFor: 0,
            goalsAgainst: 0,
            goalDiff: 0,
        });
    });

    matches.forEach((match) => {
        const homeId = String(match.home.id);
        const awayId = String(match.away.id);
        if (!ids.has(homeId) || !ids.has(awayId)) return;
        const prediction = predictions[match.id] || {};
        const homeScore = scoreToNumber(prediction.homeScore);
        const awayScore = scoreToNumber(prediction.awayScore);
        if (homeScore === null || awayScore === null) return;

        const home = mini.get(homeId);
        const away = mini.get(awayId);
        if (!home || !away) return;

        home.goalsFor += homeScore;
        home.goalsAgainst += awayScore;
        away.goalsFor += awayScore;
        away.goalsAgainst += homeScore;

        if (homeScore > awayScore) {
            home.points += 3;
        } else if (awayScore > homeScore) {
            away.points += 3;
        } else {
            home.points += 1;
            away.points += 1;
        }
    });

    mini.forEach((entry) => {
        entry.goalDiff = entry.goalsFor - entry.goalsAgainst;
    });

    return mini;
};

const compareMiniStats = (mini, a, b) => {
    const aMini = mini.get(String(a.team.id)) || { points: 0, goalDiff: 0, goalsFor: 0 };
    const bMini = mini.get(String(b.team.id)) || { points: 0, goalDiff: 0, goalsFor: 0 };
    if (bMini.points !== aMini.points) return bMini.points - aMini.points;
    if (bMini.goalDiff !== aMini.goalDiff) return bMini.goalDiff - aMini.goalDiff;
    if (bMini.goalsFor !== aMini.goalsFor) return bMini.goalsFor - aMini.goalsFor;
    return 0;
};

const groupByKey = (items, keyFn) => {
    const groups = new Map();
    items.forEach((item) => {
        const key = keyFn(item);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(item);
    });
    return Array.from(groups.values());
};

const applySequentialCriteria = (teams, criteria, fallbackSorter) => {
    let remaining = [...teams];
    const ordered = [];

    criteria.forEach((criterion) => {
        if (remaining.length <= 1) return;
        const sorted = [...remaining].sort(criterion.compare);
        const groups = groupByKey(sorted, criterion.key);
        const nextRemaining = [];
        groups.forEach((group) => {
            if (group.length === 1) {
                ordered.push(group[0]);
            } else {
                nextRemaining.push(...group);
            }
        });
        remaining = nextRemaining;
    });

    if (remaining.length) {
        remaining.sort(fallbackSorter);
        ordered.push(...remaining);
    }

    return ordered;
};

export const computeGroupStats = (teams, matches, predictions) => {
    const stats = new Map();
    teams.forEach((team) => {
        stats.set(String(team.id), {
            team,
            played: 0,
            win: 0,
            draw: 0,
            loss: 0,
            goalsFor: 0,
            goalsAgainst: 0,
            goalDiff: 0,
            points: 0,
        });
    });

    matches.forEach((match) => {
        const prediction = predictions[match.id] || {};
        const homeScore = scoreToNumber(prediction.homeScore);
        const awayScore = scoreToNumber(prediction.awayScore);
        if (homeScore === null || awayScore === null) return;

        const home = stats.get(String(match.home.id));
        const away = stats.get(String(match.away.id));
        if (!home || !away) return;

        home.played += 1;
        away.played += 1;
        home.goalsFor += homeScore;
        home.goalsAgainst += awayScore;
        away.goalsFor += awayScore;
        away.goalsAgainst += homeScore;

        if (homeScore > awayScore) {
            home.win += 1;
            home.points += 3;
            away.loss += 1;
        } else if (awayScore > homeScore) {
            away.win += 1;
            away.points += 3;
            home.loss += 1;
        } else {
            home.draw += 1;
            away.draw += 1;
            home.points += 1;
            away.points += 1;
        }
    });

    stats.forEach((entry) => {
        entry.goalDiff = entry.goalsFor - entry.goalsAgainst;
    });

    return Array.from(stats.values());
};

export const rankGroup = (stats, matches, predictions, options = {}) => {
    const fairPlayMap = options?.fairPlay || null;
    const rankingMap = options?.fifaRanking || null;
    const baseSorter = (a, b) => a.team.name.localeCompare(b.team.name, "es");
    const byPoints = [...stats].sort(
        (a, b) =>
            b.points - a.points ||
            b.goalDiff - a.goalDiff ||
            b.goalsFor - a.goalsFor ||
            baseSorter(a, b)
    );
    const pointGroups = groupByKey(byPoints, (entry) => entry.points);
    const ordered = [];

    pointGroups.forEach((group) => {
        const byGoalDiff = [...group].sort(
            (a, b) => b.goalDiff - a.goalDiff || b.goalsFor - a.goalsFor || baseSorter(a, b)
        );
        const goalDiffGroups = groupByKey(byGoalDiff, (entry) => entry.goalDiff);

        goalDiffGroups.forEach((goalDiffGroup) => {
            const byGoalsFor = [...goalDiffGroup].sort((a, b) => b.goalsFor - a.goalsFor || baseSorter(a, b));
            const goalsForGroups = groupByKey(byGoalsFor, (entry) => entry.goalsFor);

            goalsForGroups.forEach((goalsForGroup) => {
                if (goalsForGroup.length === 1) {
                    ordered.push(goalsForGroup[0]);
                    return;
                }

                let remaining = [...goalsForGroup];
                while (remaining.length > 1) {
                    const mini = buildMiniStats(remaining, matches, predictions);
                    const sorted = [...remaining].sort((a, b) => {
                        const diff = compareMiniStats(mini, a, b);
                        return diff !== 0 ? diff : baseSorter(a, b);
                    });
                    const miniGroups = groupByKey(sorted, (entry) => {
                        const miniEntry = mini.get(String(entry.team.id)) || { points: 0, goalDiff: 0, goalsFor: 0 };
                        return `${miniEntry.points}|${miniEntry.goalDiff}|${miniEntry.goalsFor}`;
                    });

                    if (miniGroups.length === 1) {
                        break;
                    }

                    const nextRemaining = [];
                    miniGroups.forEach((subGroup) => {
                        if (subGroup.length === 1) {
                            ordered.push(subGroup[0]);
                        } else {
                            nextRemaining.push(...subGroup);
                        }
                    });
                    remaining = nextRemaining;
                }

                if (remaining.length) {
                    const criteria = [
                        {
                            key: (entry) => getFairPlayScore(entry.team, fairPlayMap),
                            compare: (a, b) =>
                                getFairPlayScore(b.team, fairPlayMap) - getFairPlayScore(a.team, fairPlayMap) ||
                                baseSorter(a, b),
                        },
                        {
                            key: (entry) => {
                                const rank = getFifaRanking(entry.team, rankingMap);
                                return Number.isFinite(rank) ? rank : Number.POSITIVE_INFINITY;
                            },
                            compare: (a, b) => {
                                const rankA = getFifaRanking(a.team, rankingMap);
                                const rankB = getFifaRanking(b.team, rankingMap);
                                const safeA = Number.isFinite(rankA) ? rankA : Number.POSITIVE_INFINITY;
                                const safeB = Number.isFinite(rankB) ? rankB : Number.POSITIVE_INFINITY;
                                return safeA - safeB || baseSorter(a, b);
                            },
                        },
                    ];
                    const resolved = applySequentialCriteria(remaining, criteria, baseSorter);
                    ordered.push(...resolved);
                }
            });
        });
    });

    return ordered.map((entry, idx) => ({
        ...entry,
        rank: idx + 1,
    }));
};

export const rankThirdPlace = (groupRankings, options = {}) => {
    const fairPlayMap = options?.fairPlay || null;
    const rankingMap = options?.fifaRanking || null;
    const thirds = [];
    groupRankings.forEach((groupRanking) => {
        const third = groupRanking.ranked?.[2];
        if (third) {
            thirds.push({
                ...third,
                groupLetter: groupRanking.group.letter,
            });
        }
    });
    const baseSorter = (a, b) => a.team.name.localeCompare(b.team.name, "es");
    return thirds.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
        if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
        const fairPlayDiff =
            getFairPlayScore(b.team, fairPlayMap) - getFairPlayScore(a.team, fairPlayMap);
        if (fairPlayDiff !== 0) return fairPlayDiff;
        const rankA = getFifaRanking(a.team, rankingMap);
        const rankB = getFifaRanking(b.team, rankingMap);
        const safeA = Number.isFinite(rankA) ? rankA : Number.POSITIVE_INFINITY;
        const safeB = Number.isFinite(rankB) ? rankB : Number.POSITIVE_INFINITY;
        if (safeA !== safeB) return safeA - safeB;
        return baseSorter(a, b);
    });
};

const parseThirdLetters = (placeholder) => {
    const match = (placeholder || "").match(/^3([A-L]+)$/i);
    if (!match) return null;
    return match[1].toUpperCase().split("");
};

export const assignThirdPlaceSlots = (slots, rankedThird) => {
    const orderedSlots = [...slots].sort(
        (a, b) => a.allowedLetters.length - b.allowedLetters.length
    );
    const assignments = {};
    const usedTeams = new Set();

    const backtrack = (idx) => {
        if (idx >= orderedSlots.length) return true;
        const slot = orderedSlots[idx];
        for (const candidate of rankedThird) {
            const teamId = String(candidate.team.id);
            if (usedTeams.has(teamId)) continue;
            if (!slot.allowedLetters.includes(candidate.groupLetter)) continue;

            assignments[slot.key] = candidate;
            usedTeams.add(teamId);

            if (backtrack(idx + 1)) return true;

            delete assignments[slot.key];
            usedTeams.delete(teamId);
        }
        return false;
    };

    backtrack(0);
    return assignments;
};

const resolveFromGroupRank = (placeholder, groupRanksByLetter, slotKey, thirdAssignments) => {
    if (!placeholder) return null;
    const cleaned = placeholder.toUpperCase();
    const firstMatch = cleaned.match(/^1([A-L])$/);
    if (firstMatch) {
        return groupRanksByLetter[firstMatch[1]]?.[0]?.team || null;
    }
    const secondMatch = cleaned.match(/^2([A-L])$/);
    if (secondMatch) {
        return groupRanksByLetter[secondMatch[1]]?.[1]?.team || null;
    }
    if (cleaned.startsWith("3")) {
        const assignment = thirdAssignments[slotKey];
        return assignment ? assignment.team : null;
    }
    return null;
};

const resolveWinner = (matchId, homeTeam, awayTeam, predictions) => {
    const prediction = predictions[matchId] || {};
    const homeScore = scoreToNumber(prediction.homeScore);
    const awayScore = scoreToNumber(prediction.awayScore);
    if (!homeTeam || !awayTeam) return { winner: null, loser: null };
    if (homeScore === null || awayScore === null) return { winner: null, loser: null };

    if (homeScore > awayScore) return { winner: homeTeam, loser: awayTeam };
    if (awayScore > homeScore) return { winner: awayTeam, loser: homeTeam };

    if (prediction.winnerId) {
        if (String(homeTeam.id) === String(prediction.winnerId)) {
            return { winner: homeTeam, loser: awayTeam };
        }
        if (String(awayTeam.id) === String(prediction.winnerId)) {
            return { winner: awayTeam, loser: homeTeam };
        }
    }
    return { winner: null, loser: null };
};

export const resolveBracket = (stages, groupRanksByLetter, thirdAssignments, predictions) => {
    const sortedStages = [...stages].sort((a, b) => a.order - b.order);
    const winners = {};
    const losers = {};

    const resolvedStages = sortedStages.map((stage) => {
        const matches = stage.matches.map((match) => {
            const slotKeyA = `${match.id}:A`;
            const slotKeyB = `${match.id}:B`;

            const usesLoserA = /^RU/i.test(match.placeholderA || "");
            const usesLoserB = /^RU/i.test(match.placeholderB || "");

            const fromMatchA = match.teamA
                ? usesLoserA
                    ? losers[match.teamA]
                    : winners[match.teamA]
                : null;
            const fromMatchB = match.teamB
                ? usesLoserB
                    ? losers[match.teamB]
                    : winners[match.teamB]
                : null;

            const homeTeam =
                fromMatchA ||
                resolveFromGroupRank(
                    match.placeholderA,
                    groupRanksByLetter,
                    slotKeyA,
                    thirdAssignments
                );
            const awayTeam =
                fromMatchB ||
                resolveFromGroupRank(
                    match.placeholderB,
                    groupRanksByLetter,
                    slotKeyB,
                    thirdAssignments
                );

            const { winner, loser } = resolveWinner(match.id, homeTeam, awayTeam, predictions);
            if (winner) {
                winners[match.id] = winner;
                losers[match.id] = loser;
            }

            return {
                ...match,
                homeTeam,
                awayTeam,
                winner,
            };
        });

        return { ...stage, matches };
    });

    return resolvedStages;
};

export const extractThirdSlots = (stage) => {
    if (!stage) return [];
    const slots = [];
    stage.matches.forEach((match) => {
        const lettersA = parseThirdLetters(match.placeholderA);
        if (lettersA) {
            slots.push({ key: `${match.id}:A`, allowedLetters: lettersA });
        }
        const lettersB = parseThirdLetters(match.placeholderB);
        if (lettersB) {
            slots.push({ key: `${match.id}:B`, allowedLetters: lettersB });
        }
    });
    return slots;
};

export const getMatchPrediction = (predictions, matchId) => {
    return predictions[matchId] || { homeScore: "", awayScore: "", winnerId: "" };
};

export const coerceScoreInput = (value) => {
    if (value === "") return "";
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0) return "";
    return String(Math.floor(num));
};

export const isDrawWithScores = (prediction) => {
    const homeScore = scoreToNumber(prediction.homeScore);
    const awayScore = scoreToNumber(prediction.awayScore);
    if (homeScore === null || awayScore === null) return false;
    return homeScore === awayScore;
};
