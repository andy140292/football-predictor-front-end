import { useEffect } from "react";

const LAST_UPDATED = "5 de marzo de 2026";
const PRIVACY_EMAIL = "futbolconu@gmail.com";

const CONTENT = {
  terms: {
    title: "Términos y condiciones",
    subtitle: `Última actualización: ${LAST_UPDATED}`,
    sections: [
      {
        heading: "1. Objeto del servicio",
        items: [
          "FutbolConU ofrece análisis y predicciones de partidos con fines informativos y de entretenimiento.",
          "Las predicciones son probabilísticas y no garantizan resultados.",
        ],
      },
      {
        heading: "2. Cuenta y elegibilidad",
        items: [
          "El acceso se realiza con email o Google.",
          "El servicio no está dirigido a menores de 13 años.",
          "Podemos suspender cuentas por uso abusivo, fraude o incumplimiento.",
        ],
      },
      {
        heading: "3. Uso permitido",
        items: [
          "No puedes vulnerar la seguridad, automatizar extracción masiva de datos ni usar la plataforma para actividades ilícitas.",
          "Debes usar el servicio de forma legal y respetuosa.",
        ],
      },
      {
        heading: "4. Newsletter y comunicaciones",
        items: [
          "Solo enviamos newsletter si otorgas consentimiento.",
          `Puedes sacar tu correo de la lista en cualquier momento escribiendo a ${PRIVACY_EMAIL}.`,
        ],
      },
      {
        heading: "5. Limitación de responsabilidad",
        items: [
          "En la máxima medida permitida por ley, no respondemos por daños indirectos o pérdidas derivadas del uso del servicio.",
          "El uso de la información publicada es bajo responsabilidad del usuario.",
        ],
      },
      {
        heading: "6. Cambios",
        items: [
          "Podemos actualizar estos términos. La versión vigente será la publicada en FutbolConU.",
        ],
      },
    ],
  },
  privacy: {
    title: "Política de privacidad",
    subtitle: `Última actualización: ${LAST_UPDATED}`,
    sections: [
      {
        heading: "1. Datos que tratamos",
        items: [
          "Datos de cuenta: email, identificador de usuario y proveedor de acceso.",
          "Preferencias: aceptación de términos y preferencia de newsletter.",
          "Uso del producto: consultas de equipos, predicciones y votos en partidos futuros.",
          "Datos técnicos básicos: logs de seguridad y funcionamiento.",
        ],
      },
      {
        heading: "2. Finalidades",
        items: [
          "Gestionar tu autenticación y acceso seguro.",
          "Prestar funcionalidades de predicción y experiencia de producto.",
          "Enviar newsletter solo cuando exista consentimiento.",
          "Prevenir fraude y mantener la seguridad del servicio.",
        ],
      },
      {
        heading: "3. Terceros que pueden procesar datos",
        items: [
          "Supabase (autenticación y base de datos).",
          "Infraestructura web/API para operar la plataforma.",
          "Google OAuth, si eliges iniciar sesión con Google.",
          "Servicios embebidos o de contenido externo (por ejemplo YouTube y flagcdn).",
        ],
      },
      {
        heading: "4. Derechos del usuario",
        items: [
          "Puedes solicitar acceso, corrección o eliminación de tus datos, sujeto a la ley aplicable.",
          "Puedes retirar consentimiento de newsletter en cualquier momento.",
          `Canal de privacidad: ${PRIVACY_EMAIL}.`,
        ],
      },
      {
        heading: "5. Menores",
        items: [
          "No recopilamos intencionalmente datos de menores de 13 años sin autorización válida.",
        ],
      },
    ],
  },
};

export default function LegalModal({ open, type, onClose }) {
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open || !CONTENT[type]) return null;

  const payload = CONTENT[type];

  return (
    <div className="legal-modal-overlay" onClick={onClose}>
      <div
        className="legal-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="legal-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="legal-modal-header">
          <div>
            <h3 id="legal-modal-title" className="legal-modal-title">{payload.title}</h3>
            <p className="legal-modal-subtitle">{payload.subtitle}</p>
          </div>
          <button
            type="button"
            className="legal-modal-close"
            onClick={onClose}
            aria-label="Cerrar"
            title="Cerrar"
          >
            ×
          </button>
        </div>
        <div className="legal-modal-body">
          {payload.sections.map((section) => (
            <section key={section.heading} className="legal-modal-section">
              <h4>{section.heading}</h4>
              <ul>
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
