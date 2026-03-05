import { useId, useState } from "react";
import { supabase } from "../supabaseClient";
import LegalModal from "./LegalModal";

const PENDING_SIGNUP_KEY = "fcu_pending_signup_v1";
const normalizeEmail = (value = "") => String(value).trim().toLowerCase();

const isProviderDisabledError = (message = "") => {
  const normalized = message.toLowerCase();
  return normalized.includes("provider is not enabled") || normalized.includes("unsupported provider");
};

const isUnregisteredLoginError = (message = "") => {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("signups not allowed for otp") ||
    normalized.includes("user not found") ||
    normalized.includes("no user found")
  );
};

const savePendingSignup = ({ email, newsletterOptIn, source }) => {
  if (typeof window === "undefined") return;
  const payload = {
    email: normalizeEmail(email),
    newsletterOptIn: Boolean(newsletterOptIn),
    source,
    createdAt: Date.now(),
  };
  window.localStorage.setItem(PENDING_SIGNUP_KEY, JSON.stringify(payload));
};

const clearPendingSignup = () => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PENDING_SIGNUP_KEY);
};

const getAuthRedirectTo = () => {
  const envRedirect = String(import.meta.env.VITE_AUTH_REDIRECT_URL || "").trim();
  if (envRedirect) return envRedirect;
  if (typeof window === "undefined") return "";
  return window.location.origin;
};

export default function LoginBox() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [newsletterOptIn, setNewsletterOptIn] = useState(false);
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [legalModalType, setLegalModalType] = useState("");
  const inputId = useId();
  const normalizedEmail = normalizeEmail(email);
  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
  const isSignup = mode === "signup";
  const isBusy = isEmailLoading || isGoogleLoading;
  const authRedirectTo = getAuthRedirectTo();

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setStatus("");
  };

  const signInWithEmail = async () => {
    setStatus("");
    if (!normalizedEmail) {
      setStatus("Ingresa un email para continuar.");
      return;
    }
    if (!isValidEmail) {
      setStatus("Ingresa un email válido.");
      return;
    }
    if (isSignup && !termsAccepted) {
      setStatus("Debes aceptar los términos y condiciones para registrarte.");
      return;
    }
    setIsEmailLoading(true);
    if (isSignup) {
      savePendingSignup({ email: normalizedEmail, newsletterOptIn, source: "email" });
    } else {
      clearPendingSignup();
    }
    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        emailRedirectTo: authRedirectTo,
        shouldCreateUser: isSignup,
      },
    });
    if (error) {
      if (!isSignup && isUnregisteredLoginError(error.message || "")) {
        setStatus("Este correo no está registrado. Completa el registro para crear tu cuenta.");
        setMode("signup");
      } else {
        setStatus(error.message);
      }
      if (isSignup) {
        clearPendingSignup();
      }
    } else {
      setStatus(
        isSignup
          ? "Revisa tu email para completar el acceso. Si ya tenías cuenta, este enlace iniciará sesión."
          : "Revisa tu email para el link/código de acceso."
      );
    }
    setIsEmailLoading(false);
  };

  const signInWithGoogle = async () => {
    setStatus("");
    if (isSignup && !termsAccepted) {
      setStatus("Debes aceptar los términos y condiciones para registrarte.");
      return;
    }
    setIsGoogleLoading(true);
    if (isSignup) {
      savePendingSignup({ email, newsletterOptIn, source: "google" });
    } else {
      clearPendingSignup();
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: authRedirectTo,
        queryParams: {
          prompt: "select_account",
        },
      },
    });
    if (error) {
      const providerDisabled = isProviderDisabledError(error.message || "");
      setStatus(
        providerDisabled
          ? "Google login no está habilitado todavía. Actívalo en Supabase > Authentication > Providers > Google."
          : error.message
      );
      if (isSignup) {
        clearPendingSignup();
      }
      setIsGoogleLoading(false);
      return;
    }
    setStatus("Redirigiendo a Google...");
  };

  return (
    <div className="auth-card md-card md-card--outlined">
      <div className="auth-mode-switch" role="tablist" aria-label="Seleccionar modo de autenticación">
        <button
          type="button"
          role="tab"
          aria-selected={!isSignup}
          className={`auth-mode-btn ${!isSignup ? "auth-mode-btn--active" : ""}`}
          onClick={() => switchMode("login")}
          disabled={isBusy}
        >
          Iniciar sesión
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={isSignup}
          className={`auth-mode-btn ${isSignup ? "auth-mode-btn--active" : ""}`}
          onClick={() => switchMode("signup")}
          disabled={isBusy}
        >
          Registrarse
        </button>
      </div>
      <button
        type="button"
        className="md-button md-button--outlined auth-oauth-button"
        onClick={signInWithGoogle}
        disabled={isBusy || (isSignup && !termsAccepted)}
      >
        <span className="google-icon" aria-hidden="true">
          <svg viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" focusable="false">
            <path
              d="M17.64 9.2045c0-.638-.0573-1.2518-.1636-1.8409H9v3.4818h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2582h2.9082c1.7018-1.5668 2.6836-3.8741 2.6836-6.6155z"
              fill="#4285F4"
            />
            <path
              d="M9 18c2.43 0 4.4673-.8068 5.9564-2.1805l-2.9082-2.2582c-.8068.54-1.8409.8591-3.0482.8591-2.3441 0-4.3282-1.5832-5.0364-3.71H.9573v2.3318A8.997 8.997 0 009 18z"
              fill="#34A853"
            />
            <path
              d="M3.9636 10.71A5.409 5.409 0 013.6818 9c0-.5932.1023-1.17.2818-1.71V4.9582H.9573A8.997 8.997 0 000 9c0 1.45.3477 2.8232.9573 4.0418l3.0063-2.3318z"
              fill="#FBBC05"
            />
            <path
              d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.3459l2.5814-2.5814C13.4636.8918 11.4264 0 9 0A8.997 8.997 0 00.9573 4.9582L3.9636 7.29C4.6718 5.1632 6.6559 3.5795 9 3.5795z"
              fill="#EA4335"
            />
          </svg>
        </span>
        {isGoogleLoading
          ? "Abriendo Google..."
          : isSignup
            ? "Registrarme con Google"
            : "Continuar con Google"}
      </button>
      <div className="auth-divider" role="separator" aria-label="o">
        <span>o</span>
      </div>
      <p className="auth-email-note text-body-sm">
        {isSignup
          ? "Regístrate con tu email para recibir un link de acceso."
          : "Ingresa tu email para recibir un link de acceso."}
      </p>
      {isSignup && (
        <div className="auth-consent-list">
          <label className="auth-checkbox-row" htmlFor="terms-consent">
            <input
              id="terms-consent"
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
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
          <label className="auth-checkbox-row" htmlFor="newsletter-consent">
            <input
              id="newsletter-consent"
              type="checkbox"
              checked={newsletterOptIn}
              onChange={(e) => setNewsletterOptIn(e.target.checked)}
            />
            <span>Deseo recibir newsletter y noticias del canal por correo.</span>
          </label>
        </div>
      )}
      <div className="md-text-field">
        <div className="md-text-field__container">
          <input
            id={inputId}
            type="email"
            className="md-text-field__input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            inputMode="email"
            placeholder=" "
          />
          <label className="md-text-field__label" htmlFor={inputId}>
            Email
          </label>
        </div>
        <span className="md-text-field__supporting-text">Ej: tuemail@gmail.com</span>
      </div>
      <button
        type="button"
        className="md-button md-button--filled"
        onClick={signInWithEmail}
        disabled={!normalizedEmail || !isValidEmail || isBusy || (isSignup && !termsAccepted)}
      >
        {isEmailLoading
          ? "Enviando..."
          : isSignup
            ? "Crear cuenta"
            : "Enviar link de acceso"}
      </button>
      {status && (
        <p className="md-supporting-text" role="status">
          {status}
        </p>
      )}
      <LegalModal
        open={Boolean(legalModalType)}
        type={legalModalType}
        onClose={() => setLegalModalType("")}
      />
    </div>
  );
}
