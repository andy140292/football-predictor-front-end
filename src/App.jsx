import { lazy, memo, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import Search from "./components/Search";
import { supabase } from "./supabaseClient";
import ModelCard from "./components/ModelCard";
import FutureMatchPickCard from "./components/FutureMatchPickCard";
import LegalModal from "./components/LegalModal";
import { getFlagCodeForTeam, getSpanishTeamName, resolveCanonicalTeam } from "./data/teamMapping";
import { getTeamConfed } from "./data/teamConfed";
import useInView from "./hooks/useInView";
import { parsePredictionResponse } from "./utils/predictionPayload";
import lumenField from "./assets/lumen_field.jpeg";
import venCanCopaAmerica from "./assets/ven_can_copa_america.jpeg";
import venMexCopaAmerica from "./assets/ven_mex_copa_america.jpeg";
import venEcuCopaAmerica from "./assets/ven_ecu_copa_america.jpeg";

const LoginBox = lazy(() => import("./components/LoginBox"));
const Mundial = lazy(() => import("./components/Mundial"));
const Champions = lazy(() => import("./components/Champions"));

const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL ||
    (import.meta.env.DEV ? "/api" : "https://api.futbolconu.com");
const RECENT_FORM_COUNT = 5;
const NATIONAL_MODEL_VERSION = String(import.meta.env.VITE_NATIONAL_MODEL_VERSION || "").trim();

const H2H_TOURNAMENTS = [
    "FIFA World Cup",
    "FIFA World Cup qualification",
    "Friendly",
    "UEFA Nations League",
    "CONCACAF Nations League",
    "CONCACAF Nations League qualification",
    "Copa América",
    "Gold Cup",
    "Gold Cup qualification",
    "UEFA Euro",
    "UEFA Euro qualification",
    "African Cup of Nations",
    "African Cup of Nations qualification",
    "AFC Asian Cup",
    "AFC Asian Cup qualification",
    "CONCACAF Championship",
    "CONCACAF Championship qualification",
    "Arab Cup",
    "Confederations Cup",
];

const H2H_TOURNAMENT_FILTERS = [
    { id: "all", label: "Todos", values: H2H_TOURNAMENTS },
    { id: "world_cup", label: "Mundial", values: ["FIFA World Cup"] },
    { id: "qualifiers", label: "Eliminatorias", values: [
        "FIFA World Cup qualification",
        "UEFA Euro qualification",
        "Gold Cup qualification",
        "CONCACAF Championship qualification",
        "AFC Asian Cup qualification",
        "African Cup of Nations qualification",
        "CONCACAF Nations League qualification",
    ] },
    { id: "friendlies", label: "Amistosos", values: ["Friendly"] },
    { id: "nations", label: "Nations League", values: ["UEFA Nations League", "CONCACAF Nations League"] },
    { id: "continental", label: "Copas continentales", values: [
        "Copa América",
        "Gold Cup",
        "UEFA Euro",
        "African Cup of Nations",
        "AFC Asian Cup",
        "CONCACAF Championship",
        "Arab Cup",
        "Confederations Cup"
    ] },
];

const resolveH2hTournaments = (filters) => {
    if (filters.includes("all")) return H2H_TOURNAMENTS;
    const values = filters.flatMap((filterId) => {
        const found = H2H_TOURNAMENT_FILTERS.find((filter) => filter.id === filterId);
        return found ? found.values : [];
    });
    return Array.from(new Set(values));
};

const NAV_LINKS = [
    { id: "home", label: "Inicio" },
    { id: "national", label: "Selecciones" },
    { id: "champions", label: "Champions" },
    { id: "mundial", label: "Mundial" },
    { id: "about", label: "Nosotros" },
];

const FOOTNOTE_LINKS = [
    { label: "YouTube", href: "https://youtube.com/@futbolconu" },
    { label: "Instagram", href: "https://instagram.com/futbolconu" },
    { label: "TikTok", href: "https://www.tiktok.com/@futbolconu" },
];

const HERO_TAGS = ["#FUTBOLCONU", "#MUNDIAL2026", "#FUTBOLSUDAMERICANO", "#PREDICTOR", "#AMISTOSO"];
const HOME_HERO_SLIDES = [
    { id: "lumen", src: lumenField, objectPosition: "58% center" },
    { id: "ven-can", src: venCanCopaAmerica, objectPosition: "center 38%" },
    { id: "ven-mex", src: venMexCopaAmerica, objectPosition: "center 34%" },
    { id: "ven-ecu", src: venEcuCopaAmerica, objectPosition: "center 36%" },
];
const HOME_YOUTUBE_FEATURED = {
    videoId: "8cAY80JYyNI",
    title: "Video destacado FutbolConU",
};
const HOME_YOUTUBE_CHANNEL_URL =
    "https://www.youtube.com/@futbolconu?sub_confirmation=1";
const HOME_YOUTUBE_EMBED_URL = `https://www.youtube-nocookie.com/embed/${HOME_YOUTUBE_FEATURED.videoId}?rel=0&modestbranding=1`;
const HOME_YOUTUBE_WATCH_URL = `https://www.youtube.com/watch?v=${HOME_YOUTUBE_FEATURED.videoId}&utm_source=futbolconu&utm_medium=home_section&utm_campaign=featured_video`;
const ABOUT_IMAGES = {
    heroTop: "/imagenes/IMG_5933_opt.jpg",
    heroLeft: "/imagenes/IMG_3099_opt.jpg",
    heroRight: "/imagenes/IMG_3471_focus_enhanced_opt.jpg",
    missionMain: "/imagenes/IMG_5601_opt.jpg",
    impactMain: "/imagenes/IMG_5635_opt.jpg",
};
const COUNTDOWN_TARGET = new Date("2026-06-11T00:00:00");

const isMockMode = () => {
    if (typeof window === "undefined") return false;
    if (!import.meta.env.DEV) return false;
    return new URLSearchParams(window.location.search).has("mock");
};

const buildMockPrediction = () => ({
    "Random Forest": { home_win: 0.24, draw: 0.42, away_win: 0.35 },
    "Logistic Regression": { home_win: 0.17, draw: 0.32, away_win: 0.51 },
    "Red Neuronal": { home_win: 0.07, draw: 0.29, away_win: 0.64 },
});

const buildMockRecentForm = (homeTeam, awayTeam) => ([
    { date: "2025-11-17", home_team: homeTeam, away_team: "Australia", home_score: 3, away_score: 0 },
    { date: "2025-11-14", home_team: homeTeam, away_team: "Nueva Zelanda", home_score: 2, away_score: 1 },
    { date: "2025-10-13", home_team: "Canadá", away_team: homeTeam, home_score: 0, away_score: 0 },
    { date: "2025-10-10", home_team: "México", away_team: homeTeam, home_score: 0, away_score: 4 },
    { date: "2025-09-08", home_team: "Venezuela", away_team: homeTeam, home_score: 3, away_score: 6 },
    { date: "2025-11-15", home_team: "Azerbaiyán", away_team: awayTeam, home_score: 1, away_score: 3 },
    { date: "2025-11-12", home_team: awayTeam, away_team: "Ucrania", home_score: 4, away_score: 0 },
    { date: "2025-10-12", home_team: "Islandia", away_team: awayTeam, home_score: 2, away_score: 2 },
    { date: "2025-10-09", home_team: awayTeam, away_team: "Azerbaiyán", home_score: 3, away_score: 0 },
    { date: "2025-09-08", home_team: awayTeam, away_team: "Islandia", home_score: 2, away_score: 1 },
]);

const buildMockHeadToHead = (homeTeam, awayTeam) => ({
    home_form: { wins: 1, draws: 0, goals: 3 },
    away_form: { wins: 1, draws: 0, goals: 3 },
    matches: [
        { date: "2025-03-24", home_team: homeTeam, away_team: awayTeam, home_score: 2, away_score: 1 },
        { date: "2024-09-08", home_team: awayTeam, away_team: homeTeam, home_score: 2, away_score: 1 },
        { date: "2023-06-12", home_team: homeTeam, away_team: awayTeam, home_score: 0, away_score: 1 },
    ],
});

const buildMockTeamVsConfed = (homeTeam, awayTeam) => {
    const homeConfed = getTeamConfed(homeTeam) || "CONMEBOL";
    const awayConfed = getTeamConfed(awayTeam) || "UEFA";
    return {
        homeConfed,
        awayConfed,
        homeVsAwayConfed: { wins: 19, draws: 15, losses: 16, goals_for: 62, goals_against: 61 },
        awayVsHomeConfed: { wins: 19, draws: 14, losses: 19, goals_for: 71, goals_against: 61 },
    };
};

/**
 * @typedef {Object} ModelScorecard
 * @property {string} mode
 * @property {string} model_version
 * @property {string | null} from_date
 * @property {string | null} to_date
 * @property {number} correct_count
 * @property {number} incorrect_count
 * @property {number} total_scored
 * @property {number} accuracy_pct
 */

const formatIsoDate = (date) => {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

const getLast12ClosedMonthsRange = (now = new Date()) => {
    const lastDayPreviousMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
    const firstDayTwelveMonthWindow = new Date(
        Date.UTC(lastDayPreviousMonth.getUTCFullYear(), lastDayPreviousMonth.getUTCMonth() - 11, 1)
    );
    return {
        fromDate: formatIsoDate(firstDayTwelveMonthWindow),
        toDate: formatIsoDate(lastDayPreviousMonth),
    };
};

const requestModelScorecard = async ({ token, apiBaseUrl, modelVersion }) => {
    const { fromDate, toDate } = getLast12ClosedMonthsRange();
    const params = new URLSearchParams({
        mode: "national",
        model_version: modelVersion,
        from_date: fromDate,
        to_date: toDate,
    });

    const response = await fetch(`${apiBaseUrl}/model-scorecard?${params.toString()}`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
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

    return await response.json();
};

const getCountdown = (targetDate, nowMs) => {
    const diff = Math.max(0, targetDate.getTime() - nowMs);
    const totalSeconds = Math.floor(diff / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return { days, hours, minutes, seconds };
};

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

const CountdownMarquee = memo(function CountdownMarquee({ targetDate }) {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        setNow(Date.now());
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, []);

    const countdown = getCountdown(targetDate, now);
    const countdownTags = [
        "Mundial 2026",
        `${countdown.days} días`,
        `${countdown.hours} horas`,
        `${countdown.minutes} min`,
        `${countdown.seconds} seg`,
    ];

    return (
        <div className="countdown-marquee">
            <div className="marquee-track">
                {countdownTags.map((tag) => (
                    <span key={tag} className="marquee-tag">
                        {tag}
                    </span>
                ))}
            </div>
        </div>
    );
});

const RelativeTime = memo(function RelativeTime({ timestamp }) {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        if (!timestamp) return;
        setNow(Date.now());
        const interval = setInterval(() => setNow(Date.now()), 60000);
        return () => clearInterval(interval);
    }, [timestamp]);

    if (!timestamp) return null;
    return (
        <p className="results-time text-overline">
            Actualizado {formatRelative(timestamp, now)}
        </p>
    );
});

const getFlagUrl = (team) => {
    const code = getFlagCodeForTeam(team);
    if (!code) return "";
    return `https://flagcdn.com/w320/${code}.png`;
};

const API_TEAM_VARIANTS = {
    "DR Congo": ["DR Congo", "Congo DR"],
    "Curaçao": ["Curacao", "Curaçao"],
    "Curacao": ["Curacao", "Curaçao"],
};

const getApiTeamVariants = (input) => {
    const canonical = resolveCanonicalTeam(input);
    if (!canonical) return [input];
    const variants = API_TEAM_VARIANTS[canonical];
    if (variants && variants.length) return variants;
    return [canonical];
};

const getPageFromHash = () => {
    if (typeof window === "undefined") return "home";
    const hash = window.location.hash;
    if (hash === "#mundial") return "mundial";
    if (hash === "#champions") return "champions";
    if (hash === "#about") return "about";
    if (hash === "#national" || hash === "#predictor") return "national";
    return "home";
};

const PENDING_SIGNUP_KEY = "fcu_pending_signup_v1";
const REGISTRATION_COMPLETION_WINDOW_MS = 1000 * 60 * 60 * 24;
const PENDING_SIGNUP_INTENT_WINDOW_MS = 1000 * 60 * 60 * 6;

const readPendingSignup = () => {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(PENDING_SIGNUP_KEY);
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        window.localStorage.removeItem(PENDING_SIGNUP_KEY);
        return null;
    }
};

const clearPendingSignup = () => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(PENDING_SIGNUP_KEY);
};

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

const isPendingSignupFresh = (pendingSignup) => {
    const createdAt = Number(pendingSignup?.createdAt || 0);
    return createdAt > 0 && Date.now() - createdAt < PENDING_SIGNUP_INTENT_WINDOW_MS;
};

const normalizeErrorMessage = (error) => String(error?.message || "").toLowerCase();

const isMissingColumnError = (error) => {
    const message = normalizeErrorMessage(error);
    return (
        error?.code === "42703" ||
        error?.code === "PGRST204" ||
        (message.includes("column") && message.includes("does not exist")) ||
        (message.includes("could not find") && message.includes("column")) ||
        message.includes("schema cache")
    );
};

const isUpsertConflictUnsupported = (error) => {
    const message = normalizeErrorMessage(error);
    return (
        error?.code === "42P10" ||
        message.includes("no unique or exclusion constraint") ||
        message.includes("on conflict")
    );
};

const isSubscriberPermissionError = (error) => {
    const message = normalizeErrorMessage(error);
    return (
        error?.code === "42501" ||
        message.includes("permission denied") ||
        message.includes("row-level security")
    );
};

const isAuthSessionMissingError = (error) => {
    const message = normalizeErrorMessage(error);
    return (
        error?.name === "AuthSessionMissingError" ||
        message.includes("auth session missing")
    );
};

const buildSubscriberPayloadVariants = ({ email, newsletterOptIn, uuid }) => {
    const normalizedEmail = normalizeEmail(email);
    const boolOptIn = Boolean(newsletterOptIn);
    const variants = [
        { email: normalizedEmail, newsletter_opt_in: boolOptIn, user_id: uuid },
        { email: normalizedEmail, newsletter_opt_in: boolOptIn, uuid },
        { email: normalizedEmail, newsletter_opt_in: boolOptIn },
        { email: normalizedEmail, newsletter_optin: boolOptIn, user_id: uuid },
        { email: normalizedEmail, newsletter_optin: boolOptIn, uuid },
        { email: normalizedEmail, newsletter_optin: boolOptIn },
    ];

    const seen = new Set();
    return variants
        .map((variant) =>
            Object.fromEntries(Object.entries(variant).filter(([, value]) => value !== undefined))
        )
        .filter((variant) => {
            const key = JSON.stringify(variant);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
};

const isRecentlyCreatedUser = (user) => {
    const createdAt = Date.parse(user?.created_at || "");
    if (!Number.isFinite(createdAt)) return false;
    return Date.now() - createdAt <= REGISTRATION_COMPLETION_WINDOW_MS;
};

const CompleteRegistrationCard = memo(function CompleteRegistrationCard({
    email,
    termsAccepted,
    onTermsChange,
    newsletterOptIn,
    onNewsletterChange,
    onSubmit,
    isSubmitting,
    error,
}) {
    const [legalModalType, setLegalModalType] = useState("");

    return (
        <div className="auth-card md-card md-card--outlined">
            <p className="auth-email-note text-body-sm">
                Tu cuenta se creó con <strong>{email}</strong>. Para continuar debes aceptar los términos.
            </p>
            <div className="auth-consent-list">
                <label className="auth-checkbox-row" htmlFor="complete-terms-consent">
                    <input
                        id="complete-terms-consent"
                        type="checkbox"
                        checked={termsAccepted}
                        onChange={(e) => onTermsChange(e.target.checked)}
                    />
                    <span>
                        Acepto los{" "}
                        <button
                            type="button"
                            className="auth-inline-link"
                            onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                setLegalModalType("terms");
                            }}
                        >
                            términos y condiciones
                        </button>{" "}
                        y la{" "}
                        <button
                            type="button"
                            className="auth-inline-link"
                            onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                setLegalModalType("privacy");
                            }}
                        >
                            política de privacidad
                        </button>
                        .
                    </span>
                </label>
                <label className="auth-checkbox-row" htmlFor="complete-newsletter-consent">
                    <input
                        id="complete-newsletter-consent"
                        type="checkbox"
                        checked={newsletterOptIn}
                        onChange={(e) => onNewsletterChange(e.target.checked)}
                    />
                    <span>Deseo recibir newsletter y noticias del canal por correo.</span>
                </label>
            </div>
            <button
                type="button"
                className="md-button md-button--filled auth-complete-button"
                onClick={onSubmit}
                disabled={isSubmitting || !termsAccepted}
            >
                {isSubmitting ? "Guardando..." : "Continuar"}
            </button>
            {error && (
                <p className="md-supporting-text" role="status">
                    {error}
                </p>
            )}
            <LegalModal
                open={Boolean(legalModalType)}
                type={legalModalType}
                onClose={() => setLegalModalType("")}
            />
        </div>
    );
});

const ModelScorecardSummary = memo(function ModelScorecardSummary({ variant = "hero", summary, subtext }) {
    return (
        <div className={`model-scorecard model-scorecard--${variant} md-card`} role="status" aria-live="polite">
            <p className="model-scorecard-main text-body">
                {summary}
            </p>
            <p className="model-scorecard-sub text-caption">
                {subtext}
            </p>
        </div>
    );
});

const App = () => {
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
    const [modelScorecard, setModelScorecard] = useState(null);
    const [modelScorecardLoading, setModelScorecardLoading] = useState(false);
    const [modelScorecardError, setModelScorecardError] = useState("");
    const [session, setSession] = useState(null);
    const requestControllerRef = useRef(null);
    const modelScorecardRequestRef = useRef(0);
    const accountMenuRef = useRef(null);
    const loginModalRef = useRef(null);
    const h2hRequestRef = useRef({ teamsKey: "", filtersKey: "" });
    const teamVsConfedRequestRef = useRef({ teamsKey: "" });
    const [navHidden, setNavHidden] = useState(false);
    const lastScrollYRef = useRef(0);
    const tickingRef = useRef(false);
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [authInitialized, setAuthInitialized] = useState(false);
    const [authNotice, setAuthNotice] = useState("");
    const [needsRegistrationCompletion, setNeedsRegistrationCompletion] = useState(false);
    const [completionTermsAccepted, setCompletionTermsAccepted] = useState(false);
    const [completionNewsletterOptIn, setCompletionNewsletterOptIn] = useState(false);
    const [completionSubmitting, setCompletionSubmitting] = useState(false);
    const [completionError, setCompletionError] = useState("");
    const [recentFormMatches, setRecentFormMatches] = useState([]);
    const [recentFormLoading, setRecentFormLoading] = useState(false);
    const [recentFormError, setRecentFormError] = useState("");
    const [headToHead, setHeadToHead] = useState(null);
    const [headToHeadLoading, setHeadToHeadLoading] = useState(false);
    const [headToHeadError, setHeadToHeadError] = useState("");
    const [teamVsConfed, setTeamVsConfed] = useState(null);
    const [teamVsConfedLoading, setTeamVsConfedLoading] = useState(false);
    const [teamVsConfedError, setTeamVsConfedError] = useState("");
    const [h2hFilters, setH2hFilters] = useState(["all"]);
    const [showH2hMatches, setShowH2hMatches] = useState(false);
    const [lastRequestedTeams, setLastRequestedTeams] = useState(null);
    const [page, setPage] = useState(getPageFromHash);
    const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
    const mockMode = isMockMode();

    // Section reveal hooks
    const [predictorRef, predictorInView] = useInView({ threshold: 0.1 });
    const [formaRef, formaInView] = useInView({ threshold: 0.1 });
    const [h2hRef, h2hInView] = useInView({ threshold: 0.1 });
    const [resultsRef, resultsInView] = useInView({ threshold: 0.1 });

    const upsertSubscriberRecord = async ({ email, newsletterOptIn, uuid }) => {
        const normalizedEmail = normalizeEmail(email);
        if (!normalizedEmail) return;
        const payloadVariants = buildSubscriberPayloadVariants({
            email: normalizedEmail,
            newsletterOptIn,
            uuid,
        });
        let lastSchemaError = null;

        for (const payload of payloadVariants) {
            const { error: upsertError } = await supabase
                .from("subscribers")
                .upsert(payload, { onConflict: "email" });

            if (!upsertError) return;
            if (isMissingColumnError(upsertError)) {
                lastSchemaError = upsertError;
                continue;
            }

            if (!isUpsertConflictUnsupported(upsertError)) {
                throw upsertError;
            }

            const { data: existingRows, error: selectError } = await supabase
                .from("subscribers")
                .select("email")
                .eq("email", payload.email)
                .limit(1);
            if (selectError) throw selectError;

            if (existingRows?.length) {
                const updatePayload = { ...payload };
                delete updatePayload.email;
                if (!Object.keys(updatePayload).length) return;
                const { error: updateError } = await supabase
                    .from("subscribers")
                    .update(updatePayload)
                    .eq("email", payload.email);
                if (!updateError) return;
                if (isMissingColumnError(updateError)) {
                    lastSchemaError = updateError;
                    continue;
                }
                throw updateError;
            }

            const { error: insertError } = await supabase
                .from("subscribers")
                .insert(payload);
            if (!insertError) return;
            if (isMissingColumnError(insertError)) {
                lastSchemaError = insertError;
                continue;
            }
            throw insertError;
        }

        throw lastSchemaError || new Error("No compatible subscribers schema found for write.");
    };

    const hasSubscriberRecord = async (email) => {
        const normalizedEmail = normalizeEmail(email);
        if (!normalizedEmail) {
            return {
                exists: false,
                known: true,
                error: null,
            };
        }
        const { data, error } = await supabase
            .from("subscribers")
            .select("email")
            .eq("email", normalizedEmail)
            .limit(1);
        if (error) {
            return {
                exists: false,
                known: false,
                error,
            };
        }
        return {
            exists: Boolean(data?.length),
            known: true,
            error: null,
        };
    };

    useEffect(() => {
        const persistSubscriberPreference = async (nextSession) => {
            const pendingSignup = readPendingSignup();
            if (!pendingSignup || !nextSession?.user?.email) {
                return false;
            }

            const sessionEmail = normalizeEmail(nextSession.user.email);
            const pendingEmail = normalizeEmail(pendingSignup.email);
            const isGoogleIntent = pendingSignup.source === "google";
            const isFreshIntent = isPendingSignupFresh(pendingSignup);

            if (!sessionEmail || (!isGoogleIntent && (!pendingEmail || sessionEmail !== pendingEmail)) || !isFreshIntent) {
                clearPendingSignup();
                return false;
            }

            await upsertSubscriberRecord({
                email: nextSession.user.email,
                newsletterOptIn: Boolean(pendingSignup.newsletterOptIn),
                uuid: nextSession.user.id,
            });

            clearPendingSignup();
            return true;
        };

        const applySession = async (nextSession) => {
            setSession(nextSession);

            if (!nextSession) {
                setNeedsRegistrationCompletion(false);
                setShowLoginModal(false);
                setAuthInitialized(true);
                return;
            }

            let persistedPending = false;
            let persistError = null;
            try {
                persistedPending = await persistSubscriberPreference(nextSession);
            } catch (error) {
                persistError = error;
                console.error("Error persisting subscriber preferences:", error);
            }

            const pendingSignup = readPendingSignup();
            if (pendingSignup && !isPendingSignupFresh(pendingSignup)) {
                clearPendingSignup();
            }
            const refreshedPendingSignup = readPendingSignup();
            const hasSignupIntent = Boolean(refreshedPendingSignup);
            const isRecentUser = isRecentlyCreatedUser(nextSession.user);
            const subscriberLookup = await hasSubscriberRecord(nextSession.user.email);
            const hasSubscriber = persistedPending || subscriberLookup.exists;
            const needsCompletion = !hasSubscriber && isRecentUser;

            if (hasSignupIntent && !isRecentUser) {
                clearPendingSignup();
            }

            if (persistError) {
                if (isSubscriberPermissionError(persistError)) {
                    setAuthNotice("No pudimos guardar tus preferencias por permisos de base de datos.");
                } else {
                    setAuthNotice("No pudimos guardar tus preferencias.");
                }
            } else {
                setAuthNotice("");
            }

            setNeedsRegistrationCompletion(needsCompletion);
            setShowLoginModal(needsCompletion);

            if (needsCompletion) {
                setCompletionTermsAccepted(false);
                if (typeof refreshedPendingSignup?.newsletterOptIn === "boolean") {
                    setCompletionNewsletterOptIn(Boolean(refreshedPendingSignup.newsletterOptIn));
                } else {
                    setCompletionNewsletterOptIn(false);
                }
                setCompletionError("");
                setAuthInitialized(true);
                return;
            }

            setCompletionError("");
            setAuthInitialized(true);
        };

        supabase.auth.getSession().then(({ data }) => {
            void applySession(data.session);
        });

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, nextSession) => {
            void applySession(nextSession);
        });

        return () => subscription.unsubscribe();
    }, []);

    const handleCompleteRegistration = async () => {
        if (!session?.user?.email) return;
        if (!completionTermsAccepted) {
            setCompletionError("Debes aceptar los términos y condiciones para continuar.");
            return;
        }

        try {
            setCompletionSubmitting(true);
            setCompletionError("");
            await upsertSubscriberRecord({
                email: session.user.email,
                newsletterOptIn: completionNewsletterOptIn,
                uuid: session.user.id,
            });
            setNeedsRegistrationCompletion(false);
            setShowLoginModal(false);
            setCompletionTermsAccepted(false);
            setCompletionNewsletterOptIn(false);
            setAuthNotice("");
        } catch (error) {
            console.error("Error completing registration:", error);
            setCompletionError("No pudimos completar tu registro. Intenta de nuevo.");
        } finally {
            setCompletionSubmitting(false);
        }
    };

    useEffect(() => {
        return () => {
            if (requestControllerRef.current) {
                requestControllerRef.current.abort();
            }
        };
    }, []);

    useEffect(() => {
        const handleHash = () => setPage(getPageFromHash());
        window.addEventListener("hashchange", handleHash);
        return () => window.removeEventListener("hashchange", handleHash);
    }, []);

    useEffect(() => {
        if (!authInitialized || session || page === "home") return;
        if (typeof window !== "undefined" && window.location.hash !== "#home") {
            window.location.hash = "#home";
        }
        setPage("home");
        setShowLoginModal(false);
    }, [authInitialized, session, page]);

    useEffect(() => {
        if (!isAccountMenuOpen) return;

        const handlePointerDown = (event) => {
            if (!accountMenuRef.current?.contains(event.target)) {
                setIsAccountMenuOpen(false);
            }
        };

        const handleKeyDown = (event) => {
            if (event.key === "Escape") {
                setIsAccountMenuOpen(false);
            }
        };

        document.addEventListener("pointerdown", handlePointerDown);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("pointerdown", handlePointerDown);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isAccountMenuOpen]);

    useEffect(() => {
        if (!session) {
            setIsAccountMenuOpen(false);
        }
    }, [session]);

    useEffect(() => {
        if (!showLoginModal) return;

        const modalNode = loginModalRef.current;
        if (!modalNode) return;

        const previousOverflow = document.body.style.overflow;
        const previouslyFocused =
            document.activeElement instanceof HTMLElement ? document.activeElement : null;
        document.body.style.overflow = "hidden";

        const getFocusableNodes = () =>
            Array.from(
                modalNode.querySelectorAll(
                    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
                )
            ).filter((node) => node instanceof HTMLElement && node.offsetParent !== null);

        const focusableNodes = getFocusableNodes();
        if (focusableNodes[0] instanceof HTMLElement) {
            focusableNodes[0].focus();
        } else {
            modalNode.focus();
        }

        const handleKeyDown = (event) => {
            if (event.key === "Escape" && !needsRegistrationCompletion) {
                event.preventDefault();
                setShowLoginModal(false);
                return;
            }

            if (event.key !== "Tab") return;
            const nodes = getFocusableNodes();
            if (!nodes.length) {
                event.preventDefault();
                return;
            }

            const first = nodes[0];
            const last = nodes[nodes.length - 1];
            if (!(first instanceof HTMLElement) || !(last instanceof HTMLElement)) return;

            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            document.body.style.overflow = previousOverflow;
            if (previouslyFocused) {
                previouslyFocused.focus();
            }
        };
    }, [showLoginModal, needsRegistrationCompletion]);

    useEffect(() => {
        if (!session || page !== "national" || mockMode || !NATIONAL_MODEL_VERSION) {
            setModelScorecard(null);
            setModelScorecardLoading(false);
            setModelScorecardError("");
            return;
        }

        let cancelled = false;
        const requestId = ++modelScorecardRequestRef.current;

        const fetchModelScorecard = async () => {
            try {
                setModelScorecardLoading(true);
                setModelScorecardError("");

                const { data: sessionData, error } = await supabase.auth.getSession();
                if (error) throw error;
                const token = sessionData?.session?.access_token;

                if (!token) {
                    if (!cancelled && requestId === modelScorecardRequestRef.current) {
                        setModelScorecard(null);
                    }
                    return;
                }

                const payload = await requestModelScorecard({
                    token,
                    apiBaseUrl: API_BASE_URL,
                    modelVersion: NATIONAL_MODEL_VERSION,
                });

                if (cancelled || requestId !== modelScorecardRequestRef.current) return;
                setModelScorecard(payload);
            } catch (error) {
                if (cancelled || requestId !== modelScorecardRequestRef.current) return;
                console.error("Error loading model scorecard:", error);
                setModelScorecard(null);
                setModelScorecardError(error?.message || "No se pudo cargar el scorecard del modelo.");
            } finally {
                if (!cancelled && requestId === modelScorecardRequestRef.current) {
                    setModelScorecardLoading(false);
                }
            }
        };

        void fetchModelScorecard();
        return () => {
            cancelled = true;
        };
    }, [session, page, mockMode]);

    useEffect(() => {
        const handleScroll = () => {
            if (tickingRef.current) return;
            tickingRef.current = true;

            window.requestAnimationFrame(() => {
                const currentY = window.scrollY || 0;
                const goingDown = currentY > lastScrollYRef.current;
                const nearTop = currentY < 24;

                if (nearTop) {
                    setNavHidden(false);
                } else if (goingDown && currentY > 80) {
                    setNavHidden(true);
                } else if (!goingDown) {
                    setNavHidden(false);
                }

                lastScrollYRef.current = currentY;
                tickingRef.current = false;
            });
        };

        lastScrollYRef.current = window.scrollY || 0;
        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const toggleH2hFilter = (filterId) => {
        setH2hFilters((prev) => {
            if (filterId === "all") {
                return ["all"];
            }
            const next = prev.includes("all") ? [] : [...prev];
            const idx = next.indexOf(filterId);
            if (idx >= 0) {
                next.splice(idx, 1);
            } else {
                next.push(filterId);
            }
            return next.length ? next : ["all"];
        });
    };

    const getTeamMatches = (matches, team) => {
        const canonicalTeam = resolveCanonicalTeam(team);
        return matches
            .filter((match) => {
                const home = resolveCanonicalTeam(match.home_team);
                const away = resolveCanonicalTeam(match.away_team);
                return home === canonicalTeam || away === canonicalTeam;
            })
            .slice(0, RECENT_FORM_COUNT);
    };

    const hasMatchesForTeam = (matches, team) => {
        if (!Array.isArray(matches) || !team) return false;
        const canonicalTeam = resolveCanonicalTeam(team);
        return matches.some((match) => {
            const home = resolveCanonicalTeam(match.home_team);
            const away = resolveCanonicalTeam(match.away_team);
            return home === canonicalTeam || away === canonicalTeam;
        });
    };

    const getMatchOutcome = (match, team) => {
        const canonicalTeam = resolveCanonicalTeam(team);
        const homeCanonical = resolveCanonicalTeam(match.home_team);
        const awayCanonical = resolveCanonicalTeam(match.away_team);
        let isHome = canonicalTeam && canonicalTeam === homeCanonical;
        let isAway = canonicalTeam && canonicalTeam === awayCanonical;

        if (!isHome && !isAway) {
            const rawIsHome = match.home_team === team;
            const rawIsAway = match.away_team === team;
            if (!rawIsHome && !rawIsAway) {
                return { label: "E", className: "form-result--draw" };
            }
            isHome = rawIsHome;
            isAway = rawIsAway;
        }

        const teamScore = isHome ? match.home_score : match.away_score;
        const oppScore = isHome ? match.away_score : match.home_score;
        if (teamScore > oppScore) return { label: "V", className: "form-result--win" };
        if (teamScore === oppScore) return { label: "E", className: "form-result--draw" };
        return { label: "D", className: "form-result--loss" };
    };

    const fetchRecentForm = async (homeTeamPayload, awayTeamPayload, token) => {
        const response = await fetch(`${API_BASE_URL}/recent-form`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                home_team: homeTeamPayload,
                away_team: awayTeamPayload,
                last_matches: RECENT_FORM_COUNT,
            }),
        });

        if (!response.ok) {
            const errorPayload = await response.json().catch(() => ({}));
            const message = errorPayload?.detail || errorPayload?.error || "No se pudo cargar la forma reciente.";
            throw new Error(message);
        }
        const data = await response.json();
        return Array.isArray(data) ? data : [];
    };

    const loadRecentForm = async (homeTeamPayload, awayTeamPayload, token) => {
        try {
            setRecentFormLoading(true);
            setRecentFormError("");
            const homeVariants = getApiTeamVariants(homeTeamPayload);
            const awayVariants = getApiTeamVariants(awayTeamPayload);
            let matches = [];
            let hadSuccess = false;
            let lastError = null;

            for (const homeVariant of homeVariants) {
                for (const awayVariant of awayVariants) {
                    try {
                        const data = await fetchRecentForm(homeVariant, awayVariant, token);
                        hadSuccess = true;
                        matches = data;
                        if (
                            matches.length &&
                            hasMatchesForTeam(matches, homeVariant) &&
                            hasMatchesForTeam(matches, awayVariant)
                        ) {
                            setRecentFormMatches(matches);
                            return;
                        }
                    } catch (err) {
                        lastError = err;
                    }
                }
            }

            if (!hadSuccess && lastError) {
                throw lastError;
            }
            setRecentFormMatches(matches);
        } catch (err) {
            if (err?.name === "AbortError") return;
            setRecentFormError(err?.message || "No se pudo cargar la forma reciente.");
        } finally {
            setRecentFormLoading(false);
        }
    };

    const fetchHeadToHead = useCallback(async (homeTeamPayload, awayTeamPayload, token, filters) => {
        const response = await fetch(`${API_BASE_URL}/head-to-head`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                home_team: homeTeamPayload,
                away_team: awayTeamPayload,
                tournaments: resolveH2hTournaments(filters),
            }),
        });
        if (!response.ok) {
            const errorPayload = await response.json().catch(() => ({}));
            const message = errorPayload?.detail || errorPayload?.error || "No se pudo cargar el historial.";
            throw new Error(message);
        }
        return await response.json();
    }, []);

    const loadHeadToHead = useCallback(async (homeTeamPayload, awayTeamPayload, token, filters) => {
        try {
            setHeadToHeadLoading(true);
            setHeadToHeadError("");
            const filtersKey = JSON.stringify(filters);
            h2hRequestRef.current = {
                teamsKey: `${homeTeamPayload}::${awayTeamPayload}`,
                filtersKey,
            };
            const homeVariants = getApiTeamVariants(homeTeamPayload);
            const awayVariants = getApiTeamVariants(awayTeamPayload);
            let payload = null;
            let hadSuccess = false;
            let lastError = null;

            for (const homeVariant of homeVariants) {
                for (const awayVariant of awayVariants) {
                    try {
                        const data = await fetchHeadToHead(homeVariant, awayVariant, token, filters);
                        hadSuccess = true;
                        payload = data || null;
                        const matches = payload?.matches || [];
                        if (matches.length) {
                            setHeadToHead(payload);
                            return;
                        }
                    } catch (err) {
                        lastError = err;
                    }
                }
            }

            if (!hadSuccess && lastError) {
                throw lastError;
            }
            setHeadToHead(payload);
        } catch (err) {
            if (err?.name === "AbortError") return;
            setHeadToHeadError(err?.message || "No se pudo cargar el historial.");
        } finally {
            setHeadToHeadLoading(false);
        }
    }, [fetchHeadToHead]);

    const fetchTeamVsConfed = useCallback(async (team, opponentConfederation, token) => {
        const response = await fetch(`${API_BASE_URL}/team-vs-confed`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                team,
                opponent_confederation: opponentConfederation,
            }),
        });
        if (!response.ok) {
            const errorPayload = await response.json().catch(() => ({}));
            const message =
                errorPayload?.detail ||
                errorPayload?.error ||
                errorPayload?.message ||
                "No se pudo cargar el historial por confederación.";
            throw new Error(message);
        }
        return await response.json();
    }, []);

    const fetchTeamVsConfedWithVariants = useCallback(async (team, opponentConfederation, token) => {
        const variants = getApiTeamVariants(team);
        let lastError = null;
        let hadSuccess = false;

        for (const variant of variants) {
            try {
                const data = await fetchTeamVsConfed(variant, opponentConfederation, token);
                hadSuccess = true;
                return data || null;
            } catch (err) {
                lastError = err;
            }
        }

        if (!hadSuccess && lastError) {
            throw lastError;
        }
        return null;
    }, [fetchTeamVsConfed]);

    const deriveOpponentStats = (payload) => {
        if (!payload) return null;
        return {
            wins: payload.losses ?? 0,
            draws: payload.draws ?? 0,
            losses: payload.wins ?? 0,
            goals_for: payload.goals_against ?? 0,
            goals_against: payload.goals_for ?? 0,
        };
    };

    const loadTeamVsConfed = useCallback(async (homeTeamPayload, awayTeamPayload, token) => {
        try {
            setTeamVsConfedLoading(true);
            setTeamVsConfedError("");
            const homeConfed = getTeamConfed(homeTeamPayload);
            const awayConfed = getTeamConfed(awayTeamPayload);

            if (!homeConfed || !awayConfed) {
                setTeamVsConfed(null);
                setTeamVsConfedError("Historial por confederación no disponible.");
                return;
            }

            const [homeVsAwayConfed, awayVsHomeConfed] = await Promise.all([
                fetchTeamVsConfedWithVariants(homeTeamPayload, awayConfed, token),
                fetchTeamVsConfedWithVariants(awayTeamPayload, homeConfed, token),
            ]);

            setTeamVsConfed({
                homeVsAwayConfed,
                awayVsHomeConfed,
                homeConfed,
                awayConfed,
            });
        } catch (err) {
            if (err?.name === "AbortError") return;
            setTeamVsConfed(null);
            setTeamVsConfedError(err?.message || "No se pudo cargar el historial por confederación.");
        } finally {
            setTeamVsConfedLoading(false);
        }
    }, [fetchTeamVsConfedWithVariants]);

    useEffect(() => {
        if (!lastRequestedTeams) return;
        const teamsKey = `${lastRequestedTeams.homeTeam}::${lastRequestedTeams.awayTeam}`;
        const filtersKey = JSON.stringify(h2hFilters);
        if (
            h2hRequestRef.current.teamsKey === teamsKey &&
            h2hRequestRef.current.filtersKey === filtersKey
        ) {
            return;
        }
        supabase.auth.getSession().then(({ data, error }) => {
            if (error) {
                setHeadToHeadError("No se pudo validar la sesión.");
                return;
            }
            const token = data?.session?.access_token;
            if (!token) {
                setHeadToHeadError("Debes iniciar sesión para ver el historial.");
                return;
            }
            loadHeadToHead(lastRequestedTeams.homeTeam, lastRequestedTeams.awayTeam, token, h2hFilters);
        });
    }, [h2hFilters, lastRequestedTeams, loadHeadToHead]);

    useEffect(() => {
        if (!lastRequestedTeams) return;
        const teamsKey = `${lastRequestedTeams.homeTeam}::${lastRequestedTeams.awayTeam}`;
        if (teamVsConfedRequestRef.current.teamsKey === teamsKey) {
            return;
        }
        supabase.auth.getSession().then(({ data, error }) => {
            if (error) {
                setTeamVsConfedError("No se pudo validar la sesión.");
                return;
            }
            const token = data?.session?.access_token;
            if (!token) {
                setTeamVsConfedError("Debes iniciar sesión para ver el historial por confederación.");
                return;
            }
            teamVsConfedRequestRef.current = { teamsKey };
            loadTeamVsConfed(lastRequestedTeams.homeTeam, lastRequestedTeams.awayTeam, token);
        });
    }, [lastRequestedTeams, loadTeamVsConfed]);

    const fetchPrediction = async () => {
        const homeCanonical = resolveCanonicalTeam(homeTeam);
        const awayCanonical = resolveCanonicalTeam(awayTeam);

        if (!homeTeam || !awayTeam) {
            setErrorMessage("Selecciona ambos equipos.");
            return;
        }
        if (homeTeam === awayTeam || (homeCanonical && homeCanonical === awayCanonical)) {
            setErrorMessage("Los equipos no pueden ser iguales.");
            return;
        }

        if (mockMode) {
            const homeTeamPayload = homeCanonical || homeTeam;
            const awayTeamPayload = awayCanonical || awayTeam;
            setIsLoading(true);
            setErrorMessage("");
            setPrediction(buildMockPrediction());
            setFutureMatches([]);
            setSelectedOutcomeByMatchId({});
            setLockedMatchIds({});
            setSubmittingMatchId("");
            setFutureMatchVoteError("");
            setPredictionTimestamp(Date.now());
            setResultTeams({ homeTeam, awayTeam });
            setLastRequestedTeams({ homeTeam: homeTeamPayload, awayTeam: awayTeamPayload });
            setRecentFormMatches(buildMockRecentForm(homeTeamPayload, awayTeamPayload));
            setRecentFormLoading(false);
            setRecentFormError("");
            setHeadToHead(buildMockHeadToHead(homeTeamPayload, awayTeamPayload));
            setHeadToHeadLoading(false);
            setHeadToHeadError("");
            setTeamVsConfed(buildMockTeamVsConfed(homeTeamPayload, awayTeamPayload));
            setTeamVsConfedLoading(false);
            setTeamVsConfedError("");
            setIsLoading(false);
            if (typeof window !== "undefined") {
                window.location.hash = "#national";
                window.requestAnimationFrame(() => {
                    const target = document.getElementById("national");
                    if (target) {
                        target.scrollIntoView({ behavior: "smooth", block: "start" });
                    }
                });
            }
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

            if (requestControllerRef.current) {
                requestControllerRef.current.abort();
            }
            const controller = new AbortController();
            requestControllerRef.current = controller;
            const homeTeamPayload = homeCanonical || homeTeam;
            const awayTeamPayload = awayCanonical || awayTeam;

            const predictionPromise = fetch(`${API_BASE_URL}/predict`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ home_team: homeTeamPayload, away_team: awayTeamPayload }),
                signal: controller.signal,
            });

            void Promise.allSettled([
                loadRecentForm(homeTeamPayload, awayTeamPayload, token),
                loadHeadToHead(homeTeamPayload, awayTeamPayload, token, h2hFilters),
            ]);

            const response = await predictionPromise;

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
            setLastRequestedTeams({ homeTeam: homeTeamPayload, awayTeam: awayTeamPayload });
            if (typeof window !== "undefined") {
                window.location.hash = "#national";
                window.requestAnimationFrame(() => {
                    const target = document.getElementById("national");
                    if (target) {
                        target.scrollIntoView({ behavior: "smooth", block: "start" });
                    }
                });
            }
        } catch (err) {
            if (err?.name === "AbortError") return;
            console.error("Error fetching prediction:", err);
            const fallback = "No se pudo obtener la predicción. Intenta más tarde.";
            const message =
                err?.message && err.message !== "Failed to fetch"
                    ? `${fallback} ${err.message}`
                    : fallback;
            setErrorMessage(message);
        } finally {
            setIsLoading(false);
        }
    };

    const toPct = (x) => `${Math.round(x * 100)}%`;
    const pct = (value) => Math.max(2, Math.round((value ?? 0) * 100));
    const capitalize = (str) => {
        if (!str) return str;
        return str
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    };
    const rawTeams = resultTeams || { homeTeam, awayTeam };
    const displayTeams = {
        homeTeam: capitalize(rawTeams.homeTeam),
        awayTeam: capitalize(rawTeams.awayTeam),
    };
    const homeFlagUrl = getFlagUrl(displayTeams.homeTeam);
    const awayFlagUrl = getFlagUrl(displayTeams.awayTeam);
    const formTeams = lastRequestedTeams || rawTeams;
    const homeRecentMatches = getTeamMatches(recentFormMatches, formTeams.homeTeam);
    const awayRecentMatches = getTeamMatches(recentFormMatches, formTeams.awayTeam);
    const homeFormSequence = homeRecentMatches.map((match) => getMatchOutcome(match, formTeams.homeTeam));
    const awayFormSequence = awayRecentMatches.map((match) => getMatchOutcome(match, formTeams.awayTeam));
    const headToHeadMatches = headToHead?.matches?.slice(0, RECENT_FORM_COUNT) ?? [];
    const homeConfedLabel = teamVsConfed?.homeConfed || "";
    const awayConfedLabel = teamVsConfed?.awayConfed || "";
    const homeVsAwayConfed = teamVsConfed?.homeVsAwayConfed || null;
    const awayVsHomeConfed = teamVsConfed?.awayVsHomeConfed || null;
    const homeVsAwayConfedOpp = deriveOpponentStats(homeVsAwayConfed);
    const awayVsHomeConfedOpp = deriveOpponentStats(awayVsHomeConfed);
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
        return { avg, bestKey, count: models.length };
    };

    const consensus = getConsensus(prediction);
    const favoriteFlagUrl =
        consensus?.bestKey === "home_win"
            ? homeFlagUrl
            : consensus?.bestKey === "away_win"
                ? awayFlagUrl
                : "";
    const outcomeLabel = (key) => {
        if (key === "home_win") return displayTeams.homeTeam;
        if (key === "away_win") return displayTeams.awayTeam;
        return "Empate";
    };
    const scorecardAccuracy = Math.round(Number(modelScorecard?.accuracy_pct ?? 0));
    const scorecardTotal = Number(modelScorecard?.total_scored ?? 0);
    const scorecardSummaryText =
        scorecardTotal > 0
            ? `Nuestros modelos tienen un ${scorecardAccuracy}% de aciertos en ${scorecardTotal} partidos`
            : "Aún no hay partidos suficientes para evaluar rendimiento.";
    const scorecardSubtext = "Últimos 12 meses (actualizado mensualmente)";
    const showModelScorecard = Boolean(
        session && page === "national" && modelScorecard && !modelScorecardLoading && !modelScorecardError
    );
    const visiblePage = authInitialized ? (session ? page : "home") : "home";

    const formatMatchDate = (value) => {
        if (!value) return "—";
        if (typeof value === "string") {
            const isoDateOnly = value.match(/^(\\d{4})-(\\d{2})-(\\d{2})$/);
            if (isoDateOnly) {
                const [, year, month, day] = isoDateOnly;
                return `${day}/${month}/${year}`;
            }
        }
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return String(value);
        const day = String(date.getDate()).padStart(2, "0");
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const year = String(date.getFullYear());
        return `${day}/${month}/${year}`;
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

            const response = await fetch(`${API_BASE_URL}/match-predictions`, {
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
            console.error("Error submitting match prediction:", error);
            setFutureMatchVoteError(error?.message || "No se pudo registrar tu voto. Intenta de nuevo.");
        } finally {
            setSubmittingMatchId((current) => (current === matchId ? "" : current));
        }
    };

    const handleSignOut = async () => {
        const finalizeSignedOutState = () => {
            clearPendingSignup();
            setSession(null);
            setNeedsRegistrationCompletion(false);
            setShowLoginModal(false);
            setCompletionTermsAccepted(false);
            setCompletionNewsletterOptIn(false);
            setCompletionError("");
            setAuthNotice("");
            if (typeof window !== "undefined" && window.location.hash !== "#home") {
                window.location.hash = "#home";
            }
            setPage("home");
        };

        setIsAccountMenuOpen(false);
        setAuthNotice("");

        const { error: globalError } = await supabase.auth.signOut();
        if (!globalError) {
            finalizeSignedOutState();
            return;
        }

        if (isAuthSessionMissingError(globalError)) {
            finalizeSignedOutState();
            return;
        }

        console.error("Error signing out globally, falling back to local sign-out:", globalError);
        const { error: localError } = await supabase.auth.signOut({ scope: "local" });
        if (!localError || isAuthSessionMissingError(localError)) {
            finalizeSignedOutState();
            return;
        }

        console.error("Error signing out locally:", localError);
        setAuthNotice("No pudimos cerrar sesión. Intenta de nuevo.");
    };

    const handleInicioPrimaryCta = () => {
        if (!session) {
            setShowLoginModal(true);
            return;
        }
        if (typeof window !== "undefined") {
            window.location.hash = "#national";
        }
    };

    const handleProtectedRouteAttempt = ({ showPrompt = true } = {}) => {
        if (typeof window !== "undefined" && window.location.hash !== "#home") {
            window.location.hash = "#home";
        }
        setPage("home");
        setShowLoginModal(showPrompt);
    };

    const handleNavLinkClick = (event, linkId) => {
        if (session || linkId === "home") return;
        event.preventDefault();
        handleProtectedRouteAttempt();
    };

    const handleHomeDestinationClick = (event, targetHash) => {
        if (session) {
            if (typeof window !== "undefined") {
                window.location.hash = targetHash;
            }
            return;
        }
        event.preventDefault();
        handleProtectedRouteAttempt();
    };

    const handleLoginModalOverlayClick = (event) => {
        if (event.target !== event.currentTarget) return;
        if (needsRegistrationCompletion) return;
        setShowLoginModal(false);
    };

    return (
        <div className="app">
            <nav className={`nav ${navHidden ? "nav--hidden" : ""}`}>
                <div className="nav-inner">
                    <a className="nav-brand" href="#home">
                        <span className="brand-ball">
                            <img className="brand-logo" src="/brand-logo.png" alt="FutbolConU logo" />
                        </span>
                        <span className="brand-name">FutbolConU</span>
                    </a>
                    <div className="nav-links">
                        {NAV_LINKS.map((link) => (
                            <a
                                key={link.id}
                                className={`nav-link ${!session && link.id !== "home" ? "nav-link--locked" : ""} ${visiblePage === link.id ? "nav-link--active" : ""}`}
                                href={`#${link.id}`}
                                onClick={(event) => handleNavLinkClick(event, link.id)}
                                aria-current={visiblePage === link.id ? "page" : undefined}
                            >
                                {link.label}
                            </a>
                        ))}
                    </div>
                    <div className="nav-actions">
                        {session ? (
                            <div className="nav-account" ref={accountMenuRef}>
                                <button
                                    id="nav-account-trigger"
                                    type="button"
                                    className={`nav-account-trigger ${isAccountMenuOpen ? "nav-account-trigger--open" : ""}`}
                                    onClick={() => setIsAccountMenuOpen((prev) => !prev)}
                                    aria-haspopup="menu"
                                    aria-expanded={isAccountMenuOpen}
                                    aria-controls="nav-account-menu"
                                >
                                    <span className="nav-account-email" title={session.user.email}>
                                        {session.user.email}
                                    </span>
                                    <span className="nav-account-chevron" aria-hidden="true">
                                        <svg viewBox="0 0 20 20" focusable="false">
                                            <path d="M5.5 7.5L10 12l4.5-4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                                        </svg>
                                    </span>
                                </button>
                                {isAccountMenuOpen && (
                                    <div
                                        id="nav-account-menu"
                                        className="nav-account-menu md-card md-card--outlined"
                                        role="menu"
                                        aria-labelledby="nav-account-trigger"
                                    >
                                        <div className="nav-account-menu-header">
                                            <p className="nav-account-menu-label">Sesión iniciada como</p>
                                            <p className="nav-account-menu-email" title={session.user.email}>
                                                {session.user.email}
                                            </p>
                                        </div>
                                        <div className="nav-account-menu-divider" role="presentation" />
                                        <div className="nav-account-menu-item nav-account-menu-item--disabled" aria-disabled="true">
                                            <span>Perfil de usuario</span>
                                            <span className="nav-account-menu-note">Próximamente</span>
                                        </div>
                                        <button
                                            type="button"
                                            className="nav-account-menu-item nav-account-menu-item--signout"
                                            role="menuitem"
                                            onClick={handleSignOut}
                                        >
                                            Cerrar sesión
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <button type="button" className="nav-cta" onClick={() => setShowLoginModal(true)}>
                                Iniciar sesión
                            </button>
                        )}
                    </div>
                </div>
            </nav>

            {authNotice && (
                <div className="auth-persist-warning" role="status">
                    {authNotice}
                </div>
            )}

            <main className="main">
                {visiblePage === "mundial" ? (
                <>
                    <CountdownMarquee targetDate={COUNTDOWN_TARGET} />
                    <section id="mundial" className="mundial-page">
                        <div className="section-header">
                            <h1 className="section-title text-display-lg">Mundial 2026</h1>
                            <p className="md-supporting-text text-caption">
                                Simula resultados, revisa tablas y completa tu llave del mundial.
                            </p>
                        </div>
                        <Suspense fallback={<p className="md-supporting-text text-caption">Cargando simulador...</p>}>
                            <Mundial session={session} onRequestLogin={() => setShowLoginModal(true)} />
                        </Suspense>
                    </section>
                </>
                ) : visiblePage === "champions" ? (
                <>
                    <CountdownMarquee targetDate={COUNTDOWN_TARGET} />
                    <Suspense fallback={<p className="md-supporting-text text-caption">Cargando predictor...</p>}>
                        <Champions
                            session={session}
                            apiBaseUrl={API_BASE_URL}
                            onRequestLogin={() => setShowLoginModal(true)}
                            heroTags={HERO_TAGS}
                        />
                    </Suspense>
                </>
                ) : visiblePage === "home" ? (
                <section id="home" className="inicio-page">
                    <div className="inicio-hero md-card md-card--elevated">
                        <div className="inicio-hero-grid">
                            <div className="inicio-hero-copy">
                                <h1 className="inicio-title text-display-xl">Vive la pasión del futbol con datos</h1>
                                <p className="inicio-lead text-body">
                                    Predicciones, análisis de futbol sudamericano y mundial.
                                </p>
                                <button
                                    type="button"
                                    className="md-button md-button--filled md-button--cta inicio-cta"
                                    onClick={handleInicioPrimaryCta}
                                >
                                    {session ? "Ir al predictor de selecciones" : "Iniciar sesión o registrarse"}
                                </button>
                            </div>
                            <div className="inicio-hero-media" aria-hidden="true">
                                <div className="inicio-hero-media-art" />
                                <div className="inicio-hero-slideshow">
                                    {HOME_HERO_SLIDES.map((slide, index) => (
                                        <figure
                                            key={slide.id}
                                            className="inicio-hero-slide"
                                            style={{ "--slide-index": index, "--slide-object-position": slide.objectPosition }}
                                        >
                                            <img src={slide.src} alt="" />
                                        </figure>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <section className="inicio-youtube-section" aria-label="Contenido destacado de YouTube">
                        <div className="inicio-youtube-grid">
                            <div className="inicio-youtube-video-col">
                                <div className="inicio-youtube-video-wrap">
                                    <iframe
                                        className="inicio-youtube-embed"
                                        src={HOME_YOUTUBE_EMBED_URL}
                                        title={HOME_YOUTUBE_FEATURED.title}
                                        loading="lazy"
                                        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                        allowFullScreen
                                    />
                                </div>
                                <a
                                    className="inicio-youtube-video-link text-body-sm"
                                    href={HOME_YOUTUBE_WATCH_URL}
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    Ver video en YouTube
                                </a>
                            </div>

                            <div className="inicio-youtube-cta-col">
                                <h2 className="text-display-lg inicio-youtube-title">SÍGUENOS EN YOUTUBE</h2>
                                <p className="text-body inicio-youtube-copy">
                                    Análisis, previas del Mundial 2026, Futbol Sudamericano, Champions League, y Libertadores.
                                </p>
                                <a
                                    className="md-button md-button--filled md-button--cta inicio-youtube-cta"
                                    href={HOME_YOUTUBE_CHANNEL_URL}
                                    target="_blank"
                                    rel="noreferrer"
                                    aria-label="Abrir canal de YouTube de FutbolConU"
                                >
                                    Ir al canal de YouTube
                                </a>
                            </div>
                        </div>
                    </section>

                    <div className="inicio-link-grid">
                        <a
                            href={session ? "#national" : "#home"}
                            className={`inicio-link-card inicio-link-card--national md-card md-card--filled ${!session ? "inicio-link-card--locked" : ""}`}
                            onClick={(event) => handleHomeDestinationClick(event, "#national")}
                        >
                            <h2 className="text-display-md inicio-link-title">Predictor selecciones</h2>
                            <p className="text-body-sm inicio-link-copy">
                                Arma tu predicción, revisa forma reciente y compara probabilidades.
                            </p>
                        </a>
                        <a
                            href={session ? "#champions" : "#home"}
                            className={`inicio-link-card inicio-link-card--champions md-card md-card--filled ${!session ? "inicio-link-card--locked" : ""}`}
                            onClick={(event) => handleHomeDestinationClick(event, "#champions")}
                        >
                            <h2 className="text-display-md inicio-link-title">Predictor Champions</h2>
                            <p className="text-body-sm inicio-link-copy">
                                Explora predicciones para llaves europeas.
                            </p>
                        </a>
                        <a
                            href={session ? "#about" : "#home"}
                            className={`inicio-link-card inicio-link-card--about md-card md-card--filled ${!session ? "inicio-link-card--locked" : ""}`}
                            onClick={(event) => handleHomeDestinationClick(event, "#about")}
                        >
                            <h2 className="text-display-md inicio-link-title">Nosotros</h2>
                            <p className="text-body-sm inicio-link-copy">
                                Conoce la misión, enfoque y propuesta de FutbolConU.
                            </p>
                        </a>
                    </div>
                    {!session && (
                        <p className="md-supporting-text text-caption inicio-lock-note">
                            Inicia sesión desde el botón principal para desbloquear estas secciones.
                        </p>
                    )}
                </section>
                ) : visiblePage === "about" ? (
                <section id="about" className="about-page">
                    <article className="about-panel about-panel--hero md-card md-card--elevated">
                        <div className="about-hero-grid">
                            <div className="about-hero-copy">
                                <h1 className="about-hero-title text-display-xl">
                                    FUTBOLCONU: a lo sudamericano.
                                </h1>
                                <p className="text-body">
                                    En FutbolConU creamos la mejor lectura del juego basado en datos para darte el mejor contexto de cada partido.
                                </p>
                                <a
                                    className="md-button md-button--filled md-button--cta about-hero-cta"
                                    href="https://youtube.com/@futbolconu"
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    SUSBCRIBETE A NUESTRO CANAL
                                </a>
                            </div>

                            <div className="about-hero-collage" aria-hidden="true">
                                <figure className="about-collage-shot about-collage-shot--top">
                                    <img src={ABOUT_IMAGES.heroTop} alt="" />
                                </figure>
                                <figure className="about-collage-shot about-collage-shot--left">
                                    <img src={ABOUT_IMAGES.heroLeft} alt="" />
                                </figure>
                                <figure className="about-collage-shot about-collage-shot--right">
                                    <img src={ABOUT_IMAGES.heroRight} alt="" />
                                </figure>
                            </div>
                        </div>
                    </article>

                    <article className="about-panel about-panel--mission md-card md-card--outlined">
                        <div className="about-mission-grid">
                            <figure className="about-mission-photo">
                                <img src={ABOUT_IMAGES.missionMain} alt="" />
                            </figure>
                            <div className="about-mission-copy">
                                <div>
                                    <h2 className="text-display-md">Nuestra misión</h2>
                                    <p className="text-body-sm">
                                        En Fútbol con U combinamos datos y pasión para ofrecerte el análisis más completo del fútbol.

                                        Usamos simulaciones, tendencias históricas y modelos predictivos para que los aficionados entiendan el juego más allá de opiniones — especialmente rumbo al Mundial 2026.
                                    </p>
                                </div>
                                <div>
                                    <h2 className="text-display-md">Nuestros valores</h2>
                                    <ul className="text-body-sm about-values-list">
                                        <li><strong>Datos primero</strong> – Cada predicción está respaldada por análisis estructurado.</li>
                                        <li><strong>Transparencia</strong> – Explicamos los números detrás de cada resultado.</li>
                                        <li><strong>Pasión</strong> – El fútbol se vive con emoción, y la respetamos.</li>
                                        <li><strong>Comunidad</strong> – El debate nos hace mejores.</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </article>

                    <article className="about-panel about-panel--impact md-card md-card--outlined">
                        <div className="about-impact-grid">
                            <div className="about-impact-copy">
                                <h2 className="text-display-md">
                                    Nuestro éxito se debe a nuestra comunidad.
                                </h2>
                                <p className="text-body-sm">
                                    Impulsamos una cultura de análisis y debate con respeto para que cada futbolero tenga mejores argumentos y disfrute más el futbol.
                                </p>
                                <a
                                    href="#national"
                                    className="md-button md-button--filled md-button--cta about-impact-cta"
                                    onClick={(event) => handleHomeDestinationClick(event, "#national")}
                                >
                                    Ir al predictor
                                </a>
                                <div className="about-metrics" aria-label="Indicadores de impacto">
                                    <div className="about-metric">
                                        <strong>200+</strong>
                                        <span>Videos publicados</span>
                                    </div>
                                    <div className="about-metric">
                                        <strong>1M+</strong>
                                        <span>Vistas en Youtube</span>
                                    </div>
                                    <div className="about-metric">
                                        <strong>8.5k+</strong>
                                        <span>Comunidad en Youtube</span>
                                    </div>
                                </div>
                            </div>
                            <figure className="about-impact-photo">
                                <img src={ABOUT_IMAGES.impactMain} alt="" />
                            </figure>
                        </div>
                    </article>
                </section>
                ) : (
                <>
                    <CountdownMarquee targetDate={COUNTDOWN_TARGET} />
                    <section
                        id="national"
                        ref={predictorRef}
                        className={`hero-section section-reveal ${predictorInView ? 'section-visible' : ''}`}
                    >
                        <div className="hero">
                            <div className="hero-content">
                                <h1 className="hero-title text-display-xl">
                                    <span className="hero-title-line">Arma tu predicción de selecciones</span>
                                </h1>
                                <div id="predictor-shell" className="predictor-shell md-card md-card--elevated">
                                    <div className="predictor-body">
                                        <div className="team-grid">
                                            <Search
                                                label="Equipo Local"
                                                placeholder="Ej: Bolivia"
                                                searchTerm={homeTeam}
                                                setSearchTerm={setHomeTeam}
                                            />
                                            <Search
                                                label="Equipo Visitante"
                                                placeholder="Ej: Rusia"
                                                searchTerm={awayTeam}
                                                setSearchTerm={setAwayTeam}
                                            />
                                        </div>

                                        <div className="predictor-actions">
                                            <button
                                                type="button"
                                                onClick={fetchPrediction}
                                                disabled={isLoading || !session}
                                                className="md-button md-button--filled md-button--cta"
                                            >
                                                {isLoading ? "Calculando..." : session ? "Calcular" : "Inicia sesión"}
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
                    {HERO_TAGS.length > 0 && (
                        <div className="tagline-marquee">
                            <div className="marquee-track">
                                {HERO_TAGS.concat(HERO_TAGS).map((tag, idx) => (
                                    <span key={`national-bottom-${tag}-${idx}`} className="marquee-tag">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                    {prediction && (
                        <>
                        <section 
                            ref={formaRef}
                            className={`insight-section md-card md-card--elevated section-reveal ${formaInView ? 'section-visible' : ''}`} 
                            id="forma-reciente"
                        >
                        <div className="section-header">
                            <h2 className="section-title text-display-lg">Forma Reciente</h2>
                        </div>
                        {recentFormLoading && (
                            <p className="md-supporting-text text-caption">Cargando forma reciente...</p>
                        )}
                        {recentFormError && (
                            <div className="md-inline-alert" role="alert">
                                {recentFormError}
                            </div>
                        )}
                        {!recentFormLoading && !recentFormError && (
                            <div className="form-grid">
                                <div className="form-card">
                                    <div className="form-card-header">
                                        <div className="form-team-block">
                                            {homeFlagUrl && (
                                                <span
                                                    className="form-flag"
                                                    style={{ "--flag-url": `url(${homeFlagUrl})` }}
                                                    role="img"
                                                    aria-label={`Bandera de ${displayTeams.homeTeam}`}
                                                />
                                            )}
                                            <div>
                                                <p className="form-team-name text-h4">{displayTeams.homeTeam}</p>
                                                <span className="form-team-sub">Últimos {RECENT_FORM_COUNT}</span>
                                            </div>
                                        </div>
                                        <div className="form-sequence">
                                            {homeFormSequence.map((item, idx) => (
                                                <span key={`${item.label}-${idx}`} className={`form-badge ${item.className}`}>
                                                    {item.label}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="form-table">
                                        {homeRecentMatches.map((match, idx) => (
                                            <div className="form-row form-row--with-date" key={`${match.home_team}-${match.away_team}-${idx}`}>
                                                <span className="form-date">
                                                    {formatMatchDate(
                                                        match.date ??
                                                            match.match_date ??
                                                            match.matchDate ??
                                                            match.fecha ??
                                                            match.match_date_utc
                                                    )}
                                                </span>
                                                <span className="form-team-cell text-body">{getSpanishTeamName(match.home_team)}</span>
                                                <span className="form-score-cell">{match.home_score}</span>
                                                <span className="form-score-cell">{match.away_score}</span>
                                                <span className="form-team-cell text-body">{getSpanishTeamName(match.away_team)}</span>
                                            </div>
                                        ))}
                                        {!homeRecentMatches.length && (
                                            <p className="md-supporting-text text-caption">Sin partidos recientes.</p>
                                        )}
                                    </div>
                                </div>
                                <div className="form-card">
                                    <div className="form-card-header">
                                        <div className="form-team-block">
                                            {awayFlagUrl && (
                                                <span
                                                    className="form-flag"
                                                    style={{ "--flag-url": `url(${awayFlagUrl})` }}
                                                    role="img"
                                                    aria-label={`Bandera de ${displayTeams.awayTeam}`}
                                                />
                                            )}
                                            <div>
                                                <p className="form-team-name text-h4">{displayTeams.awayTeam}</p>
                                                <span className="form-team-sub">Últimos {RECENT_FORM_COUNT}</span>
                                            </div>
                                        </div>
                                        <div className="form-sequence">
                                            {awayFormSequence.map((item, idx) => (
                                                <span key={`${item.label}-${idx}`} className={`form-badge ${item.className}`}>
                                                    {item.label}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="form-table">
                                        {awayRecentMatches.map((match, idx) => (
                                            <div className="form-row form-row--with-date" key={`${match.home_team}-${match.away_team}-${idx}`}>
                                                <span className="form-date">
                                                    {formatMatchDate(
                                                        match.date ??
                                                            match.match_date ??
                                                            match.matchDate ??
                                                            match.fecha ??
                                                            match.match_date_utc
                                                    )}
                                                </span>
                                                <span className="form-team-cell text-body">{getSpanishTeamName(match.home_team)}</span>
                                                <span className="form-score-cell">{match.home_score}</span>
                                                <span className="form-score-cell">{match.away_score}</span>
                                                <span className="form-team-cell text-body">{getSpanishTeamName(match.away_team)}</span>
                                            </div>
                                        ))}
                                        {!awayRecentMatches.length && (
                                            <p className="md-supporting-text text-caption">Sin partidos recientes.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </section>

                    <section 
                        ref={h2hRef}
                        className={`insight-section md-card md-card--elevated section-reveal ${h2hInView ? 'section-visible' : ''}`} 
                        id="head-to-head"
                    >
                        <div className="section-header">
                            <h2 className="section-title text-display-lg">Historial</h2>
                        </div>
                        <div className="tournament-filters">
                            <p className="md-supporting-text text-caption">Filtra los torneos incluidos:</p>
                            <div className="tournament-chips">
                                {H2H_TOURNAMENT_FILTERS.map((filter) => {
                                    const isActive = h2hFilters.includes("all")
                                        ? filter.id === "all"
                                        : h2hFilters.includes(filter.id);
                                    return (
                                        <button
                                            key={filter.id}
                                            type="button"
                                            className={`md-chip ${isActive ? "md-chip--selected" : ""}`}
                                            onClick={() => toggleH2hFilter(filter.id)}
                                        >
                                            {filter.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        {headToHeadLoading && (
                            <p className="text-caption text--active">
                                {headToHead ? "Actualizando historial..." : "Cargando historial..."}
                            </p>
                        )}
                        {headToHeadError && (
                            <div className="md-inline-alert" role="alert">
                                {headToHeadError}
                            </div>
                        )}
                        {headToHead && (
                            <div className="h2h-grid">
                                <div className="h2h-column">
                                    {/* Stats Comparison Table */}
                                    <div className="h2h-card">
                                        <div className="h2h-comparison">
                                        {/* Header row with team names and flags */}
                                        <div className="h2h-header-row">
                                            <div className="h2h-team-header">
                                                <span 
                                                    className="h2h-flag" 
                                                    style={homeFlagUrl ? { "--flag-url": `url(${homeFlagUrl})` } : undefined}
                                                    role="img"
                                                    aria-label={`Bandera de ${displayTeams.homeTeam}`}
                                                />
                                                <span className="h2h-team-name text-h3">{displayTeams.homeTeam}</span>
                                            </div>
                                            <span className="h2h-vs text-body-sm">VS</span>
                                            <div className="h2h-team-header">
                                                <span 
                                                    className="h2h-flag" 
                                                    style={awayFlagUrl ? { "--flag-url": `url(${awayFlagUrl})` } : undefined}
                                                    role="img"
                                                    aria-label={`Bandera de ${displayTeams.awayTeam}`}
                                                />
                                                <span className="h2h-team-name text-h3">{displayTeams.awayTeam}</span>
                                            </div>
                                        </div>
                                        {/* Stat rows */}
                                        <div className="h2h-stat-row">
                                            <span className="h2h-value">{headToHead.home_form?.wins ?? 0}</span>
                                            <span className="h2h-label text-body">Ganados</span>
                                            <span className="h2h-value">{headToHead.away_form?.wins ?? 0}</span>
                                        </div>
                                        <div className="h2h-stat-row">
                                            <span className="h2h-value">{headToHead.home_form?.draws ?? 0}</span>
                                            <span className="h2h-label text-body">Empates</span>
                                            <span className="h2h-value">{headToHead.away_form?.draws ?? 0}</span>
                                        </div>
                                        <div className="h2h-stat-row">
                                            <span className="h2h-value">{headToHead.home_form?.goals ?? 0}</span>
                                            <span className="h2h-label text-body">Goles</span>
                                            <span className="h2h-value">{headToHead.away_form?.goals ?? 0}</span>
                                        </div>
                                        </div>
                                    </div>

                                    {/* Match History Toggle */}
                                    {headToHeadMatches.length > 0 && (
                                        <button
                                            type="button"
                                            className="h2h-toggle-btn"
                                            onClick={() => setShowH2hMatches(!showH2hMatches)}
                                        >
                                            {showH2hMatches ? "Ocultar partidos" : "Mostrar partidos"}
                                        </button>
                                    )}

                                    {/* Match History */}
                                    {showH2hMatches && (
                                        <div className="h2h-matches">
                                            {headToHeadMatches.map((match, idx) => (
                                                <div
                                                    className="form-row form-row--with-date h2h-match-row"
                                                    key={`${match.home_team}-${match.away_team}-${idx}`}
                                                >
                                                    <span className="form-date">
                                                        {formatMatchDate(
                                                            match.date ??
                                                                match.match_date ??
                                                                match.matchDate ??
                                                                match.fecha ??
                                                                match.match_date_utc
                                                        )}
                                                    </span>
                                                    <span className="form-team-cell text-body">
                                                        {getSpanishTeamName(match.home_team)}
                                                    </span>
                                                    <span className="form-score-cell">{match.home_score}</span>
                                                    <span className="form-score-cell">{match.away_score}</span>
                                                    <span className="form-team-cell text-body">
                                                        {getSpanishTeamName(match.away_team)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="h2h-confed-row">
                                    {teamVsConfedLoading && (
                                        <p className="md-supporting-text text-caption h2h-confed-status">
                                            Cargando historial por confederación...
                                        </p>
                                    )}
                                    {teamVsConfedError && (
                                        <div className="md-inline-alert" role="alert">
                                            {teamVsConfedError}
                                        </div>
                                    )}
                                    {!teamVsConfedLoading && !teamVsConfedError && teamVsConfed && (
                                        <>
                                            <div className="h2h-card">
                                                <div className="h2h-comparison h2h-comparison--confed">
                                                <div className="h2h-header-row">
                                                    <div className="h2h-team-header">
                                                        <span 
                                                            className="h2h-flag" 
                                                            style={homeFlagUrl ? { "--flag-url": `url(${homeFlagUrl})` } : undefined}
                                                            role="img"
                                                            aria-label={`Bandera de ${displayTeams.homeTeam}`}
                                                        />
                                                        <span className="h2h-team-name text-h4">{displayTeams.homeTeam}</span>
                                                    </div>
                                                    <span className="h2h-vs text-body-sm">VS</span>
                                                    <div className="h2h-team-header h2h-team-header--confed">
                                                        <span className="h2h-confed-label text-h4">{awayConfedLabel}</span>
                                                    </div>
                                                </div>
                                                <div className="h2h-stat-row">
                                                    <span className="h2h-value">{homeVsAwayConfed?.wins ?? 0}</span>
                                                    <span className="h2h-label text-body">Ganados</span>
                                                    <span className="h2h-value">{homeVsAwayConfedOpp?.wins ?? 0}</span>
                                                </div>
                                                <div className="h2h-stat-row">
                                                    <span className="h2h-value">{homeVsAwayConfed?.draws ?? 0}</span>
                                                    <span className="h2h-label text-body">Empates</span>
                                                    <span className="h2h-value">{homeVsAwayConfedOpp?.draws ?? 0}</span>
                                                </div>
                                                <div className="h2h-stat-row">
                                                    <span className="h2h-value">{homeVsAwayConfed?.goals_for ?? 0}</span>
                                                    <span className="h2h-label text-body">Goles</span>
                                                    <span className="h2h-value">{homeVsAwayConfedOpp?.goals_for ?? 0}</span>
                                                </div>
                                                </div>
                                            </div>

                                            <div className="h2h-card">
                                                <div className="h2h-comparison h2h-comparison--confed">
                                                <div className="h2h-header-row">
                                                    <div className="h2h-team-header">
                                                        <span 
                                                            className="h2h-flag" 
                                                            style={awayFlagUrl ? { "--flag-url": `url(${awayFlagUrl})` } : undefined}
                                                            role="img"
                                                            aria-label={`Bandera de ${displayTeams.awayTeam}`}
                                                        />
                                                        <span className="h2h-team-name text-h4">{displayTeams.awayTeam}</span>
                                                    </div>
                                                    <span className="h2h-vs text-body-sm">VS</span>
                                                    <div className="h2h-team-header h2h-team-header--confed">
                                                        <span className="h2h-confed-label text-h4">{homeConfedLabel}</span>
                                                    </div>
                                                </div>
                                                <div className="h2h-stat-row">
                                                    <span className="h2h-value">{awayVsHomeConfed?.wins ?? 0}</span>
                                                    <span className="h2h-label text-body">Ganados</span>
                                                    <span className="h2h-value">{awayVsHomeConfedOpp?.wins ?? 0}</span>
                                                </div>
                                                <div className="h2h-stat-row">
                                                    <span className="h2h-value">{awayVsHomeConfed?.draws ?? 0}</span>
                                                    <span className="h2h-label text-body">Empates</span>
                                                    <span className="h2h-value">{awayVsHomeConfedOpp?.draws ?? 0}</span>
                                                </div>
                                                <div className="h2h-stat-row">
                                                    <span className="h2h-value">{awayVsHomeConfed?.goals_for ?? 0}</span>
                                                    <span className="h2h-label text-body">Goles</span>
                                                    <span className="h2h-value">{awayVsHomeConfedOpp?.goals_for ?? 0}</span>
                                                </div>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                    {!teamVsConfedLoading && !teamVsConfedError && !teamVsConfed && (
                                        <p className="md-supporting-text text-caption h2h-confed-status">
                                            Historial por confederación no disponible.
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                    </section>

                    <section 
                        ref={resultsRef}
                        className={`insight-section md-card md-card--elevated section-reveal ${resultsInView ? 'section-visible' : ''}`} 
                        id="resultados"
                    >
                        <div className="section-header">
                            <h2 className="section-title text-display-lg">
                                Probabilidades para {displayTeams.homeTeam} vs {displayTeams.awayTeam}
                            </h2>
                            <RelativeTime timestamp={predictionTimestamp} />
                        </div>
                        {showModelScorecard && (
                            <ModelScorecardSummary
                                variant="results"
                                summary={scorecardSummaryText}
                                subtext={scorecardSubtext}
                            />
                        )}
                        {consensus && (
                            <div className="consensus-strip md-card md-card--filled">
                                <div className="consensus-left">
                                    <p className="consensus-kicker text-overline">CONSENSO</p>
                                    <div className="consensus-favorite-row">
                                        {favoriteFlagUrl && (
                                            <span
                                                className="consensus-favorite-flag"
                                                style={{ "--flag-url": `url(${favoriteFlagUrl})` }}
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
                                        className={`outcome-card outcome-card--with-flag consensus-chip ${
                                            consensus.bestKey === "home_win" ? "outcome-card--active" : ""
                                        }`}
                                        style={homeFlagUrl ? { "--flag-url": `url(${homeFlagUrl})` } : undefined}
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
                                    <div
                                        className={`outcome-card consensus-chip ${
                                            consensus.bestKey === "draw" ? "outcome-card--active" : ""
                                        }`}
                                    >
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
                                        className={`outcome-card outcome-card--with-flag consensus-chip ${
                                            consensus.bestKey === "away_win" ? "outcome-card--active" : ""
                                        }`}
                                        style={awayFlagUrl ? { "--flag-url": `url(${awayFlagUrl})` } : undefined}
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
                                <div className="section-header section-header--balanced">
                                    <h3 className="section-title text-display-sm">Predicciones de los modelos</h3>
                                </div>
                                {Object.entries(prediction).map(([modelName, probs]) => {
                                    const title =
                                        modelName === "mlp"
                                            ? "RED NEURONAL"
                                            : modelName.replaceAll("_", " ").toUpperCase();

                                    return (
                                        <ModelCard
                                            key={modelName}
                                            title={title}
                                            probs={probs}
                                            homeTeam={displayTeams.homeTeam}
                                            awayTeam={displayTeams.awayTeam}
                                            toPct={toPct}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                        {futureMatches.length > 0 && (
                            <div className="future-picks-section md-card md-card--filled">
                                <div className="section-header section-header--balanced">
                                    <h3 className="section-title text-display-sm">Pronostica tu resultado</h3>
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
                                            variant="national"
                                            selectedOutcome={selectedOutcomeByMatchId[match.match_id] || ""}
                                            locked={Boolean(lockedMatchIds[match.match_id])}
                                            submitting={submittingMatchId === match.match_id}
                                            onSelect={(outcome) =>
                                                handleSubmitFutureMatchPrediction(match.match_id, outcome)
                                            }
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </section>
                    </>
                )}

                </>
                )}
            </main>

            <footer className="footer">
                <div className="footer-inner">
                    <div>
                        <p className="footer-title text-body">FutbolConU</p>
                        <p className="footer-note text-caption">Hecho para futboleros.</p>
                    </div>
                    <div className="footer-links">
                        {FOOTNOTE_LINKS.map((link) => (
                            <a key={link.label} className="footer-link" href={link.href} target="_blank" rel="noreferrer">
                                {link.label}
                            </a>
                        ))}
                    </div>
                    <p className="footer-note text-caption">© {new Date().getFullYear()} FutbolConU</p>
                </div>
            </footer>

            {showLoginModal && (
                <div className="login-modal-overlay" onClick={handleLoginModalOverlayClick}>
                    <div
                        className="login-modal"
                        ref={loginModalRef}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="login-modal-title"
                        tabIndex={-1}
                    >
                        {!needsRegistrationCompletion && (
                            <button
                                type="button"
                                className="login-modal-close"
                                onClick={() => setShowLoginModal(false)}
                                aria-label="Cerrar diálogo"
                                title="Cerrar"
                            >
                                ×
                            </button>
                        )}
                        <h2 id="login-modal-title" className="login-modal-title text-display-md">
                            {needsRegistrationCompletion ? "Completa tu registro" : "Inicia sesión"}
                        </h2>
                        {needsRegistrationCompletion ? (
                            <CompleteRegistrationCard
                                email={session?.user?.email || ""}
                                termsAccepted={completionTermsAccepted}
                                onTermsChange={setCompletionTermsAccepted}
                                newsletterOptIn={completionNewsletterOptIn}
                                onNewsletterChange={setCompletionNewsletterOptIn}
                                onSubmit={handleCompleteRegistration}
                                isSubmitting={completionSubmitting}
                                error={completionError}
                            />
                        ) : (
                            <Suspense fallback={<p className="md-supporting-text text-caption">Cargando formulario...</p>}>
                                <LoginBox />
                            </Suspense>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default App
