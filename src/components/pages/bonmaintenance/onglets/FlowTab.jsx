import {
  FileText,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  User,
  Building2,
  Calendar,
  Activity,
  Loader2,
  Pause,
  RotateCcw,
  ChevronDown,
  Circle,
  Workflow,
  Inbox,
} from 'lucide-react';
import { prioriteLabel, prioriteColor } from '../../../../constants/Priorite';
import {
  INTERVENANT_ETAT_LABELS,
  ETAT_IMMOBILISATION_OPTIONS,
  formatDateTime,
  formatDate,
  formatMontant,
  coutIntervenant,
} from '../BmdCommun';
import { t } from '../../../../i18n';

const ETAT_LABELS = {
  1: 'Nouveau',
  2: 'Suspendu',
  3: 'En cours',
  4: 'Effectué',
  10: 'Annulé',
};

const ETAT_CLASSES = {
  1: 'etat-nouveau',
  2: 'etat-suspendu',
  3: 'etat-encours',
  4: 'etat-effectue',
  10: 'etat-annule',
};

const ETAT_ICONS = {
  1: Circle,
  2: Pause,
  3: Activity,
  4: CheckCircle,
  10: XCircle,
};

function getEtatLabel(etat) {
  return ETAT_LABELS[etat] || t("Inconnu");
}

function getEtatClass(etat) {
  return ETAT_CLASSES[etat] || '';
}

function getEtatIcon(etat) {
  return ETAT_ICONS[etat] || Circle;
}

export function FlowTab({
  bon,
  reclamation,
  reclamations,
  equipement,
  interventions,
  loadingInterventions,
  controle,
  remiseService,
  historique,
  expandedSections,
  toggleSection,
  loadingReclamations
}) {
  const renderStepConnector = () => (
    <div className="bmd-flow-connector">
      <ChevronDown size={18} className="connector-arrow" />
    </div>
  );

  const renderStepIcon = (type) => {
    const icons = {
      reclamation: { icon: AlertCircle, class: 'reclamation' },
      bon: { icon: FileText, class: 'bon' },
      equipement: { icon: Building2, class: 'equipement' },
      intervention: { icon: Activity, class: 'intervention' },
      controle: { icon: CheckCircle, class: 'controle' },
      remise: { icon: RotateCcw, class: 'remise' },
    };
    const { icon: Icon, class: className } = icons[type] || icons.bon;
    return (
      <div className={`bmd-flow-icon ${className}`}>
        <Icon size={20} />
      </div>
    );
  };

  const renderEtatBadge = (etat) => {
    const Icon = getEtatIcon(etat);
    return (
      <span className={`bmd-badge-etat ${getEtatClass(etat)}`}>
        <Icon size={12} />
        {t(getEtatLabel(etat))}
      </span>
    );
  };

  return (
    <div className="bmd-flow-container">
      <div className="bmd-flow-title">
        <Workflow size={24} className="text-primary" />
        <div>
          <h3>{t("Chaîne de traitement")}</h3>
        </div>
      </div>

      <div className="bmd-flow-step">
        <div className="bmd-flow-header" onClick={() => toggleSection('reclamation')}>
          <div className="bmd-flow-header-left">
            {renderStepIcon('reclamation')}
            <div className="bmd-flow-header-text">
              <span className="bmd-flow-step-label">{t("Étape 1")}</span>
              <h4>{t("Réclamation")}</h4>
              {reclamation && <span className="bmd-flow-subtitle">{reclamation.num || t("REC-XXXX")}</span>}
              {reclamations.length > 1 && (
                <span className="bmd-flow-subtitle badge-multiple">
                  +{reclamations.length - 1} {t("autre(s)")}
                </span>
              )}
            </div>
          </div>
          <button className="bmd-flow-toggle">
            {expandedSections.reclamation ? '−' : '+'}
          </button>
        </div>
        {expandedSections.reclamation && (
          <div className="bmd-flow-content">
            {loadingReclamations ? (
              <p className="bmd-flow-empty"><Loader2 size={20} className="spinner" /> {t("Chargement...")}</p>
            ) : reclamations.length === 0 ? (
              <p className="bmd-flow-empty">
                <Inbox size={20} className="empty-icon" /> {t("Aucune réclamation associée")}
              </p>
            ) : (
              <div className="bmd-flow-details">
                {reclamations.map((r, index) => (
                  <div key={r.id} className="bmd-reclamation-item">
                    <div className="bmd-reclamation-header">
                      <span className="bmd-reclamation-num">#{index + 1}</span>
                      <span className="bmd-reclamation-title">{r.num || `REC-${r.id}`}</span>
                      {r.priorite && (
                        <span className={`priorite-badge priorite-${r.priorite}`}>
                          {r.priorite === 1 ? t("Basse") : r.priorite === 2 ? t("Moyenne") : t("Haute")}
                        </span>
                      )}
                    </div>
                    <div className="bmd-reclamation-details">
                      <div className="detail-row">
                        <span className="detail-label">{t("Date")}</span>
                        <span className="detail-value">{formatDate(r.date)}</span>
                      </div>
                      {r.description && (
                        <div className="detail-row">
                          <span className="detail-label">{t("Description")}</span>
                          <span className="detail-value">{t(r.description)}</span>
                        </div>
                      )}
                      {r.statut && (
                        <div className="detail-row">
                          <span className="detail-label">{t("Statut")}</span>
                          <span className="detail-value">{r.statut}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {renderStepConnector()}

      <div className="bmd-flow-step active">
        <div className="bmd-flow-header" onClick={() => toggleSection('bon')}>
          <div className="bmd-flow-header-left">
            {renderStepIcon('bon')}
            <div className="bmd-flow-header-text">
              <span className="bmd-flow-step-label">{t("Étape 2")}</span>
              <h4>{t("Bon de Maintenance")}</h4>
              <span className="bmd-flow-subtitle">{bon.num || t("BM-XXXX")} • {renderEtatBadge(bon.etat)}</span>
            </div>
          </div>
          <button className="bmd-flow-toggle">
            {expandedSections.bon ? '−' : '+'}
          </button>
        </div>
        {expandedSections.bon && (
          <div className="bmd-flow-content">
            <div className="bmd-flow-details">
              <div className="detail-row">
                <span className="detail-label">{t("Titre")}</span>
                <span className="detail-value">{bon.titre || t("Sans titre")}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">{t("Description")}</span>
                <span className="detail-value">{bon.description || t("Aucune description")}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">{t("Urgence")}</span>
                <span className="detail-value">
                  <span className={`bmd-urgence-badge urgence-${bon.urgence || 0}`}>
                    {bon.urgence ? ['Faible', 'Moyenne', 'Élevée'][bon.urgence - 1] : t("Non définie")}
                  </span>
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">{t("Priorité")}</span>
                <span className="detail-value" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span
                    className={`bmd-urgence-badge priorite-color-${prioriteColor(bon.priorite)}`}
                    title={t("Priorité calculée automatiquement (criticité + urgence + disponibilité d'alternative)")}
                  >
                    {t(prioriteLabel(bon.priorite))}
                  </span>
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">{t("Prestataire")}</span>
                <span className="detail-value">{bon.prestataire?.raisonSociale || bon.prestataire?.nom || t("Non spécifié")}</span>
              </div>
              {bon.sousTraitant && (
                <div className="detail-row">
                  <span className="detail-label">{t("Sous-traitant")}</span>
                  <span className="detail-value">{bon.sousTraitant}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {renderStepConnector()}

      <div className="bmd-flow-step">
        <div className="bmd-flow-header" onClick={() => toggleSection('equipement')}>
          <div className="bmd-flow-header-left">
            {renderStepIcon('equipement')}
            <div className="bmd-flow-header-text">
              <span className="bmd-flow-step-label">{t("Étape 3")}</span>
              <h4>{t("Équipement")}</h4>
              {equipement && <span className="bmd-flow-subtitle">{equipement.designation || 'N/A'}</span>}
            </div>
          </div>
          <button className="bmd-flow-toggle">
            {expandedSections.equipement ? '−' : '+'}
          </button>
        </div>
        {expandedSections.equipement && (
          <div className="bmd-flow-content">
            {equipement ? (
              <div className="bmd-flow-details">
                <div className="detail-row">
                  <span className="detail-label">{t("Désignation")}</span>
                  <span className="detail-value">{equipement.designation || 'N/A'}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">{t("Marque")}</span>
                  <span className="detail-value">{equipement.marque || 'N/A'}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">{t("Modèle")}</span>
                  <span className="detail-value">{equipement.modele || 'N/A'}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">{t("N° pièce")}</span>
                  <span className="detail-value">{equipement.numPiece || 'N/A'}</span>
                </div>
                {equipement.codeBarre && (
                  <div className="detail-row">
                    <span className="detail-label">{t("Code-barre")}</span>
                    <span className="detail-value">{equipement.codeBarre}</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="bmd-flow-empty">
                <Inbox size={20} className="empty-icon" /> {t("Aucun équipement associé")}
              </p>
            )}
          </div>
        )}
      </div>

      {renderStepConnector()}

      <div className="bmd-flow-step">
        <div className="bmd-flow-header" onClick={() => toggleSection('interventions')}>
          <div className="bmd-flow-header-left">
            {renderStepIcon('intervention')}
            <div className="bmd-flow-header-text">
              <span className="bmd-flow-step-label">{t("Étape 4")}</span>
              <h4>{t("Interventions")}</h4>
              <span className="bmd-flow-subtitle">{interventions.length} {t("intervention(s)")}</span>
            </div>
          </div>
          <button className="bmd-flow-toggle">
            {expandedSections.interventions ? '−' : '+'}
          </button>
        </div>
        {expandedSections.interventions && (
          <div className="bmd-flow-content">
            {loadingInterventions ? (
              <p className="bmd-flow-empty"><Loader2 size={20} className="spinner" /> {t("Chargement...")}</p>
            ) : interventions.length > 0 ? (
              <div className="bmd-flow-details">
                {interventions.map((intervention, index) => {
                  const nomIntervenant = intervention.personnel
                    ? `${intervention.personnel.nom} ${intervention.personnel.prenom}`
                    : (intervention.sousTraitant?.raisonSociale
                        || intervention.intervenantNom
                        || t('Intervenant #{id}', { id: intervention.id }));
                  return (
                    <div key={intervention.id ?? index} className="bmd-intervention-item">
                      <div className="bmd-intervention-header">
                        <span className="bmd-intervention-num">#{index + 1}</span>
                        <span className="bmd-intervention-titre">{nomIntervenant}</span>
                        {intervention.nbrHeure != null && (
                          <span className="bmd-intervention-duree">
                            <Clock size={14} />
                            {intervention.nbrHeure}{t("h")}
                          </span>
                        )}
                      </div>
                      {intervention.commentaire && (
                        <p className="bmd-intervention-description">{intervention.commentaire}</p>
                      )}
                      <div className="bmd-intervention-meta">
                        {intervention.dateDebutIntervention && (
                          <span><Calendar size={14} /> {formatDateTime(intervention.dateDebutIntervention)} → {formatDateTime(intervention.dateFinIntervention)}</span>
                        )}
                        {intervention.etat != null && (
                          <span className={`intervention-statut statut-${intervention.etat}`}>
                            {INTERVENANT_ETAT_LABELS[intervention.etat] || t('État {n}', { n: intervention.etat })}
                          </span>
                        )}
                        {coutIntervenant(intervention) != null && (
                          <span>{formatMontant(coutIntervenant(intervention))}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="bmd-flow-empty">
                <Inbox size={20} className="empty-icon" /> {t("Aucune intervention enregistrée")}
              </p>
            )}
          </div>
        )}
      </div>

      {renderStepConnector()}

      <div className="bmd-flow-step">
        <div className="bmd-flow-header" onClick={() => toggleSection('controle')}>
          <div className="bmd-flow-header-left">
            {renderStepIcon('controle')}
            <div className="bmd-flow-header-text">
              <span className="bmd-flow-step-label">{t("Étape 5")}</span>
              <h4>{t("Contrôle")}</h4>
              {controle && (
                <span className={`bmd-flow-subtitle ${controle.conforme ? 'conforme' : 'non-conforme'}`}>
                  {controle.conforme ? (
                    <><CheckCircle size={14} className="text-success" /> {t("Conforme")}</>
                  ) : (
                    <><XCircle size={14} className="text-danger" /> {t("Non conforme")}</>
                  )}
                </span>
              )}
            </div>
          </div>
          <button className="bmd-flow-toggle">
            {expandedSections.controle ? '−' : '+'}
          </button>
        </div>
        {expandedSections.controle && (
          <div className="bmd-flow-content">
            {controle ? (
              <div className="bmd-flow-details">
                <div className="detail-row">
                  <span className="detail-label">{t("Statut")}</span>
                  <span className={`detail-value ${controle.conforme ? 'text-success' : 'text-danger'}`}>
                    {controle.conforme ? (
                      <><CheckCircle size={16} className="text-success" /> {t("Conforme")}</>
                    ) : (
                      <><XCircle size={16} className="text-danger" /> {t("Non conforme")}</>
                    )}
                  </span>
                </div>
                {controle.dateControle && (
                  <div className="detail-row">
                    <span className="detail-label">{t("Date")}</span>
                    <span className="detail-value">{formatDateTime(controle.dateControle)}</span>
                  </div>
                )}
                {controle.personnelNom && (
                  <div className="detail-row">
                    <span className="detail-label">{t("Contrôleur")}</span>
                    <span className="detail-value">{controle.personnelNom}</span>
                  </div>
                )}
                {controle.typeControle && (
                  <div className="detail-row">
                    <span className="detail-label">{t("Type")}</span>
                    <span className="detail-value">{controle.typeControle}</span>
                  </div>
                )}
               
                {controle.resultat && (
                  <div className="detail-row">
                    <span className="detail-label">{t("Résultat")}</span>
                    <span className="detail-value">{controle.resultat}</span>
                  </div>
                )}
                {controle.observations && (
                  <div className="detail-row">
                    <span className="detail-label">{t("Observations")}</span>
                    <span className="detail-value">{controle.observations}</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="bmd-flow-empty">
                <Inbox size={20} className="empty-icon" /> {t("Contrôle non encore effectué")}
              </p>
            )}
          </div>
        )}
      </div>

      {renderStepConnector()}

      <div className="bmd-flow-step">
        <div className="bmd-flow-header" onClick={() => toggleSection('remiseService')}>
          <div className="bmd-flow-header-left">
            {renderStepIcon('remise')}
            <div className="bmd-flow-header-text">
              <span className="bmd-flow-step-label">{t("Étape 6")}</span>
              <h4>{t("Remise en service")}</h4>
              {remiseService && (
                <span className={`bmd-flow-subtitle ${remiseService.conforme ? 'effectuee' : 'non-effectuee'}`}>
                  {remiseService.conforme ? (
                    <><CheckCircle size={14} className="text-success" /> {t("Autorisée")}</>
                  ) : (
                    <><XCircle size={14} className="text-danger" /> {t("Refusée")}</>
                  )}
                </span>
              )}
            </div>
          </div>
          <button className="bmd-flow-toggle">
            {expandedSections.remiseService ? '−' : '+'}
          </button>
        </div>
        {expandedSections.remiseService && (
          <div className="bmd-flow-content">
            {remiseService ? (
              <div className="bmd-flow-details">
                <div className="detail-row">
                  <span className="detail-label">{t("Statut")}</span>
                  <span className={`detail-value ${remiseService.conforme ? 'text-success' : 'text-danger'}`}>
                    {remiseService.conforme ? (
                      <><CheckCircle size={16} className="text-success" /> {t("Autorisée")}</>
                    ) : (
                      <><XCircle size={16} className="text-danger" /> {t("Refusée")}</>
                    )}
                  </span>
                </div>
                {remiseService.date && (
                  <div className="detail-row">
                    <span className="detail-label">{t("Date")}</span>
                    <span className="detail-value">{formatDateTime(remiseService.date)}</span>
                  </div>
                )}
                {remiseService.autoriseParNom && (
                  <div className="detail-row">
                    <span className="detail-label">{t("Autorisé par")}</span>
                    <span className="detail-value">{remiseService.autoriseParNom}</span>
                  </div>
                )}
                {remiseService.etatApres != null && (
                  <div className="detail-row">
                    <span className="detail-label">{t("État après")}</span>
                    <span className="detail-value">
                      {ETAT_IMMOBILISATION_OPTIONS.find(o => o.value === remiseService.etatApres)?.label || 'N/A'}
                    </span>
                  </div>
                )}
                {remiseService.observations && (
                  <div className="detail-row">
                    <span className="detail-label">{t("Observations")}</span>
                    <span className="detail-value">{remiseService.observations}</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="bmd-flow-empty">
                <Inbox size={20} className="empty-icon" /> {t("Remise en service non encore effectuée")}
              </p>
            )}
          </div>
        )}
      </div>

      {historique.length > 0 && (
        <div className="bmd-flow-historique">
          <div className="bmd-flow-header" onClick={() => toggleSection('historique')}>
            <div className="bmd-flow-header-left">
              <div className="bmd-flow-icon historique">
                <Clock size={20} />
              </div>
              <div className="bmd-flow-header-text">
                <h4>{t("Historique")}</h4>
                <span className="bmd-flow-subtitle">{historique.length} {t("événement(s)")}</span>
              </div>
            </div>
            <button className="bmd-flow-toggle">
              {expandedSections.historique ? '−' : '+'}
            </button>
          </div>
          {expandedSections.historique && (
            <div className="bmd-flow-content">
              <div className="bmd-timeline">
                {historique.map((event, index) => (
                  <div key={index} className="bmd-timeline-item">
                    <div className="bmd-timeline-dot"></div>
                    <div className="bmd-timeline-content">
                      <div className="bmd-timeline-header">
                        <span className="bmd-timeline-date">{formatDateTime(event.date)}</span>
                        <span className="bmd-timeline-action">{event.action || event.type}</span>
                      </div>
                      {event.description && (
                        <p className="bmd-timeline-description">{t(event.description)}</p>
                      )}
                      {event.utilisateur && (
                        <span className="bmd-timeline-user">
                          <User size={12} />
                          {event.utilisateur}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
