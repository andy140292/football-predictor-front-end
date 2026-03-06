const SUPPORT_URL = "https://buymeacoffee.com/futbolconu?l=es";
const SUPPORT_CTA_LABEL = "Apoyar a FutbolConU";

const CONTENT_BY_CONTEXT = {
  inicio: {
    title: "LA COMUNIDAD CONSTRUYE FUTBOLCONU.",
    copy:
      "Si disfrutas nuestras previas y predicciones, puedes apoyar el proyecto. Cada aporte se reinvierte en datos, servidores y nuevas herramientas para mejorar FutbolConU.",
    impact: "Tu apoyo ayuda a mejorar nuestros modelos de predicción para el Mundial 2026.",
    trust: "Apoyo 100% voluntario.",
  },
  mundial: {
    title: "APOYA EL PROYECTO FUTBOLCONU.",
    copy:
      "Estamos construyendo una experiencia cada vez más completa para la comunidad. Tu apoyo directo acelera nuevas funciones, más análisis y mejor cobertura del Mundial.",
    impact: "Tu apoyo ayuda a mejorar nuestros modelos de predicción para el Mundial 2026.",
    trust: "Apoyo 100% voluntario.",
  },
  prediction: {
    title: "Apoyanos para seguir mejorando nuestros modelos de predicción.",
    copy:
      "Si disfrutas nuestras previas y predicciones, puedes apoyar el proyecto. Cada aporte se reinvierte en datos, servidores y nuevas herramientas para mejorar FutbolConU.",
    impact: "Tu apoyo ayuda a mejorar nuestros modelos de predicción para el Mundial 2026.",
    trust: "Apoyo 100% voluntario.",
  },
  about: {
    title: "LA COMUNIDAD CONSTRUYE FUTBOLCONU.",
    copy:
      "Si valoras este proyecto, puedes apoyarlo directamente. Cada aporte se reinvierte en más análisis, infraestructura y herramientas para toda la comunidad.",
    impact: "Tu apoyo ayuda a mejorar nuestros modelos de predicción para el Mundial 2026.",
    trust: "Apoyo 100% voluntario.",
  },
};

export default function SupportBanner({ context = "inicio", compact = false }) {
  const copy = CONTENT_BY_CONTEXT[context] || CONTENT_BY_CONTEXT.inicio;
  const compactClass = compact ? "support-banner--compact" : "";

  return (
    <section className={`support-banner md-card md-card--elevated ${compactClass}`} aria-label="Apoyar FutbolConU">
      <div className="support-banner-content">
        <h2 className="support-banner-title text-display-sm">{copy.title}</h2>
        <p className="support-banner-copy text-body">{copy.copy}</p>
        {copy.impact && <p className="support-banner-impact text-body-sm">{copy.impact}</p>}
      </div>
      <div className="support-banner-actions">
        <a
          className="md-button md-button--filled md-button--cta support-banner-cta"
          href={SUPPORT_URL}
          target="_blank"
          rel="noreferrer"
          aria-label="Apoyar FutbolConU en Buy Me a Coffee"
        >
          {SUPPORT_CTA_LABEL}
        </a>
        {copy.trust && <p className="support-banner-trust text-caption">{copy.trust}</p>}
      </div>
    </section>
  );
}
