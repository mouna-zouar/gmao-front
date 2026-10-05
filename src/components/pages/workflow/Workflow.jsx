import React from 'react';
import './Workflow.css';

const ICONS = {
  reclamation: <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />,
  bon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />,
  diagnostic: <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />,
  decision: <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />,
  intervention: <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63" />,
  demander: <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />,
  commander: <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.836l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 1.936-4.719 2.399-7.22a.75.75 0 00-.727-.891H5.106M7.5 14.25L5.106 5.165M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />,
  controle: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
  remise: <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />,
  cloture: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m6 1.5a9 9 0 11-18 0 9 9 0 0118 0z" />,
  reject: <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />,
};

function Icon({ name, className = '' }) {
  return (
    <svg className={className} width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      {ICONS[name]}
    </svg>
  );
}

function Step({ icon, title, subtitle, tone = 'default', children }) {
  return (
    <div className={`wf-step wf-step--${tone}`}>
      <div className="wf-step-icon"><Icon name={icon} /></div>
      <div className="wf-step-body">
        <span className="wf-step-title">{title}</span>
        {subtitle && <span className="wf-step-subtitle">{subtitle}</span>}
        {children}
      </div>
    </div>
  );
}

function Arrow({ label }) {
  return (
    <div className="wf-arrow">
      <div className="wf-arrow-line" />
      {label && <span className="wf-arrow-label">{label}</span>}
    </div>
  );
}

function Branch({ children }) {
  return <div className="wf-branch">{children}</div>;
}

export default function Workflow() {
  return (
    <div className="wf-container">
      <div className="wf-header">
        <Icon name="reclamation" className="wf-header-icon" />
        <div>
          <h1>Workflow GMAO</h1>
          <p>Du signalement d'une panne à la clôture — processus tel qu'implémenté dans l'application.</p>
        </div>
      </div>

      <div className="wf-flow">

        <Step
          icon="reclamation"
          title="Réclamation créée"
          subtitle="Service, criticité, urgence, immobilisation concernée, dépôt, clinique"
        />

        <Arrow label="création automatique et immédiate, en parallèle" />

        <div className="wf-parallel">
          <Step
            icon="bon"
            title="Bon de maintenance créé"
            subtitle="État initial : Nouveau — lié à la réclamation"
            tone="teal"
          >
            <p className="wf-note wf-note--equip">
              🔴 Si arrêt obligatoire, l'équipement passe automatiquement <strong>En panne</strong>
            </p>
          </Step>
          <Step
            icon="decision"
            title="Valider / Rejeter (optionnel)"
            subtitle="Enregistre une décision de validation à tout moment — n'affecte pas le bon déjà créé"
            tone="muted"
          >
            <div className="wf-mini-branches">
              <span className="wf-mini-branch wf-mini-branch--ok"><Icon name="controle" className="wf-mini-icon" /> Validée</span>
              <span className="wf-mini-branch wf-mini-branch--no"><Icon name="reject" className="wf-mini-icon" /> Rejetée (motif obligatoire)</span>
            </div>
          </Step>
        </div>

        <Arrow />

        <Step
          icon="diagnostic"
          title="Diagnostic"
          subtitle="Technicien, immobilisation examinée, cause probable, gravité, durée estimée"
        >
          <p className="wf-note wf-note--ai">
            🧠 Assistant de diagnostic : suggère cause probable + solution déjà appliquées sur des pannes similaires (même équipement, même type, symptômes proches)
          </p>
          <p className="wf-note wf-note--equip">
            🔧 Dès qu'un diagnostic est enregistré, le bon (Nouveau/Suspendu) passe automatiquement <strong>En cours</strong> → équipement <strong>En réparation</strong>
          </p>
        </Step>

        <Arrow label="décision du technicien" />

        <Step icon="decision" title="Besoin de pièce ?" tone="amber" />

        <Branch>
          <div className="wf-branch-col">
            <Arrow label="Non" />
            <Step icon="intervention" title="Intervention directe" subtitle="Pas de pièce requise" tone="green">
              <p className="wf-note wf-note--equip">
                🔧 L'équipement passe automatiquement <strong>En réparation</strong> tant que le bon est En cours/Suspendu
              </p>
              <p className="wf-note wf-note--ai">
                🧑‍🔧 Répartition intelligente : suggère le technicien le plus pertinent (compétence passée sur ce type d'équipement + charge de travail + disponibilité sur la période)
              </p>
            </Step>
          </div>
          <div className="wf-branch-col">
            <Arrow label="Oui — article + quantité + sous-traitant" />
            <div className="wf-parallel wf-parallel--tight">
              <Step icon="demander" title="Demander" subtitle="Couvert par le stock disponible" tone="blue" />
              <Step icon="commander" title="Commander" subtitle="Manquant non couvert par le stock" tone="teal" />
            </div>
          </div>
        </Branch>

        <Arrow />

        <Step
          icon="controle"
          title="Contrôle de l'équipement"
          subtitle="Type de contrôle, valeurs mesurée/attendue, conforme oui/non"
        />

        <Arrow />

        <Step
          icon="remise"
          title="Remise en service"
          subtitle="Décision du responsable habilité — sépare explicitement « réparé » de « autorisé à l'usage »"
          tone="amber"
        >
          <p className="wf-note">
            ⚠️ Si le bon concerne une immobilisation précise, une remise en service <strong>conforme</strong> est
            obligatoire avant de pouvoir passer à l'étape suivante — sinon le passage à « Effectué » est bloqué
            <strong> via le bouton « Effectuer »</strong>. Le endpoint générique de changement d'état (PATCH /etat)
            ne fait pas encore ce contrôle — à corriger si utilisé ailleurs que par ce bouton.
          </p>
          <p className="wf-note wf-note--equip">
            🟠 Équipement <strong>Hors service</strong> tant qu'aucune remise en service conforme n'est enregistrée
            → 🟢 repasse <strong>En service</strong> automatiquement dès qu'une décision conforme est validée
          </p>
        </Step>

        <Arrow label="remise en service conforme requise" />

        <Step
          icon="cloture"
          title="Bon marqué Effectué"
          subtitle="Cascade : intervenants non terminés → Terminé"
          tone="green"
        />

        <Arrow label="cascade automatique" />

        <Step
          icon="cloture"
          title="Réclamation(s) liée(s) clôturée(s)"
          subtitle="Toutes les réclamations liées (Ouverte, En cours, En attente de validation) passent à Clôturée"
          tone="teal"
        />

      </div>

      <div className="wf-legend">
        <h3>Légende des états</h3>
        <div className="wf-legend-grid">
          <div><span className="wf-legend-dot wf-legend-dot--rec-ouverte" /> Réclamation — Ouverte</div>
          <div><span className="wf-legend-dot wf-legend-dot--rec-encours" /> Réclamation — En cours</div>
          <div><span className="wf-legend-dot wf-legend-dot--rec-cloturee" /> Réclamation — Clôturée</div>
          <div><span className="wf-legend-dot wf-legend-dot--rec-attente" /> Réclamation — En attente de validation</div>
          <div><span className="wf-legend-dot wf-legend-dot--rec-rejetee" /> Réclamation — Rejetée</div>
          <div><span className="wf-legend-dot wf-legend-dot--bon-nouveau" /> Bon — Nouveau</div>
          <div><span className="wf-legend-dot wf-legend-dot--bon-encours" /> Bon — En cours</div>
          <div><span className="wf-legend-dot wf-legend-dot--bon-suspendu" /> Bon — Suspendu</div>
          <div><span className="wf-legend-dot wf-legend-dot--bon-effectue" /> Bon — Effectué</div>
          <div><span className="wf-legend-dot wf-legend-dot--bon-annule" /> Bon — Annulé</div>
        </div>
        <h3 style={{ marginTop: '18px' }}>États d'équipement (machine à états automatique)</h3>
        <div className="wf-legend-grid">
          <div>🟢 En service</div>
          <div>🔴 En panne</div>
          <div>🔧 En réparation</div>
          <div>🟠 Hors service (en attente de remise en service)</div>
        </div>
      </div>

      <div className="wf-background">
        <h3>Processus intelligents en arrière-plan</h3>
        <p className="wf-background-intro">
          En plus du workflow ci-dessus, ces analyses tournent en continu ou sur demande et
          notifient automatiquement (🔔) quand quelque chose mérite attention.
        </p>
        <div className="wf-background-grid">
          <div className="wf-background-card">
            <span className="wf-background-title">🧠 Assistant de diagnostic</span>
            <span className="wf-background-desc">Suggère cause probable + solution à l'étape Diagnostic, à la demande.</span>
          </div>
          <div className="wf-background-card">
            <span className="wf-background-title">🧑‍🔧 Répartition intelligente</span>
            <span className="wf-background-desc">Suggère le technicien le plus pertinent, à la demande, à l'étape Intervenants.</span>
          </div>
          <div className="wf-background-card">
            <span className="wf-background-title">🔎 Détection d'anomalies</span>
            <span className="wf-background-desc">Compare les réclamations des 7 derniers jours à la moyenne historique, par équipement et par service — tous les jours à 6h.</span>
          </div>
          <div className="wf-background-card">
            <span className="wf-background-title">📈 Maintenance prédictive</span>
            <span className="wf-background-desc">Score de risque de panne (fréquence, tendance, âge, garantie) par équipement, à la demande.</span>
          </div>
          <div className="wf-background-card">
            <span className="wf-background-title">⛔ Détection de blocage</span>
            <span className="wf-background-desc">Alerte si un équipement reste à l'arrêt &gt;15 jours sans bon ouvert ni remise en service — tous les jours à 6h30, avec résolution automatique.</span>
          </div>
          <div className="wf-background-card">
            <span className="wf-background-title">⚙️ Machine à états équipement</span>
            <span className="wf-background-desc">Recalcule En service/En panne/En réparation/Hors service à chaque création ou changement d'état de bon, et à chaque remise en service.</span>
          </div>
        </div>
      </div>
    </div>
  );
}