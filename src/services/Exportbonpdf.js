import jsPDF from 'jspdf';
import bonMaintenanceDiagnosticService from './bonMaintenanceDiagnosticService';
import bonMaintenanceTacheService from './Bonmaintenancetacheservice';
import bonMaintenanceIntervenantService from './bonMaintenanceIntervenantService';
import bonMaintenanceDocumentAchatService from './Bonmaintenancedocumentachatservice';
import bonMaintenanceControleEquipementService from './bonMaintenanceControleEquipementService';
import bonMaintenanceRemiseEnServiceService from './bonMaintenanceRemiseEnServiceService';
import bonMaintenanceCommentaireService from './Bonmaintenancecommentaireservice';

const ETAT_LABELS = { 1: 'Nouveau', 2: 'Suspendu', 3: 'En cours', 4: 'Effectué', 10: 'Annulé' };
const URGENCE_LABELS = { 1: 'Faible', 2: 'Moyenne', 3: 'Élevée' };

/** Même logique que le helper générique de Fichebonmaintenance.jsx : tente plusieurs noms
 * de méthode selon le service, pour rester robuste aux petites variations de nommage. */
async function chargerParBon(service, bonMaintenanceId) {
  const candidats = ['getByBonMaintenance', 'getByBonMaintenanceId', 'findByBonMaintenanceId', 'findByBonMaintenance'];
  const methodName = candidats.find((name) => typeof service[name] === 'function');
  if (!methodName) return [];
  try {
    return (await service[methodName](bonMaintenanceId)) ?? [];
  } catch {
    return [];
  }
}

function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function nomPersonnel(id, nomDenormalise, personnels) {
  if (nomDenormalise) return nomDenormalise;
  const p = personnels.find((x) => x.id === id);
  return p ? `${p.nom || ''} ${p.prenom || ''}`.trim() : (id != null ? `#${id}` : '—');
}

/**
 * Génère et télécharge un PDF récapitulatif complet du bon de maintenance : informations
 * générales + toutes les sections enfants (diagnostic, tâches, intervenants, documents
 * d'achat, contrôle, remise en service, commentaires). Récupère les données lui-même
 * (un seul appel suffit depuis le bouton "Exporter PDF").
 */
export async function exporterBonMaintenancePDF(bon, { personnels = [], prestataires = [], immobilisations = [] } = {}) {
  const bonMaintenanceId = bon.id;

  const [diagnostics, taches, intervenants, documents, controles, remises, commentaires] = await Promise.all([
    chargerParBon(bonMaintenanceDiagnosticService, bonMaintenanceId),
    chargerParBon(bonMaintenanceTacheService, bonMaintenanceId),
    chargerParBon(bonMaintenanceIntervenantService, bonMaintenanceId),
    chargerParBon(bonMaintenanceDocumentAchatService, bonMaintenanceId),
    chargerParBon(bonMaintenanceControleEquipementService, bonMaintenanceId),
    chargerParBon(bonMaintenanceRemiseEnServiceService, bonMaintenanceId),
    chargerParBon(bonMaintenanceCommentaireService, bonMaintenanceId),
  ]);

  const doc = new jsPDF();
  const marginX = 14;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 18;

  const sautDePageSiBesoin = (hauteurNecessaire = 10) => {
    if (y + hauteurNecessaire > pageHeight - 14) {
      doc.addPage();
      y = 18;
    }
  };

  const titreSection = (texte) => {
    sautDePageSiBesoin(14);
    doc.setFillColor(241, 245, 249);
    doc.rect(marginX, y - 5, pageWidth - marginX * 2, 8, 'F');
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(texte, marginX + 2, y);
    y += 9;
    doc.setFont(undefined, 'normal');
    doc.setTextColor(0);
  };

  const ligne = (label, valeur) => {
    sautDePageSiBesoin(6);
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(label, marginX, y);
    doc.setTextColor(20);
    doc.text(String(valeur ?? '—'), marginX + 45, y, { maxWidth: pageWidth - marginX * 2 - 45 });
    y += 6;
  };

  const texteLibre = (texte, indent = 0) => {
    if (!texte) return;
    sautDePageSiBesoin(6);
    doc.setFontSize(8.5);
    doc.setTextColor(70);
    const lignes = doc.splitTextToSize(texte, pageWidth - marginX * 2 - indent);
    lignes.forEach((l) => {
      sautDePageSiBesoin(5);
      doc.text(l, marginX + indent, y);
      y += 4.5;
    });
    doc.setTextColor(0);
    y += 1.5;
  };

  const videSection = (texte = 'Aucun élément.') => {
    sautDePageSiBesoin(6);
    doc.setFontSize(8.5);
    doc.setTextColor(150);
    doc.text(texte, marginX, y);
    doc.setTextColor(0);
    y += 7;
  };

  // ─── En-tête ───
  doc.setFontSize(17);
  doc.setFont(undefined, 'bold');
  doc.text(`Bon de maintenance ${bon.num || `#${bon.id}`}`, marginX, y);
  y += 8;
  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(90);
  doc.text(bon.titre || '', marginX, y);
  doc.setTextColor(0);
  y += 6;
  doc.setFontSize(8.5);
  doc.setTextColor(140);
  doc.text(`Document généré le ${formatDateTime(new Date().toISOString())}`, marginX, y);
  doc.setTextColor(0);
  y += 10;

  // ─── Informations générales ───
  titreSection('Informations générales');
  ligne('État', ETAT_LABELS[bon.etat] || bon.etat || '—');
  ligne('Urgence', URGENCE_LABELS[bon.urgence] || '—');
  ligne('Créé par', bon.personnelCreationNom || '—');
  ligne('Demandé par', bon.personnelDemandantNom || '—');
  ligne('Équipement', bon.immobilisation || immobilisations.find((i) => i.id === bon.lotArticleImmobilistationId)?.designation || '—');
  ligne('Prestataire', bon.prestataire?.raisonSociale || prestataires.find((p) => p.id === bon.prestataireId)?.raisonSociale || '—');
  ligne('Service', bon.serviceNom || '—');
  ligne('Dépôt', bon.depotNom || '—');
  ligne('Arrêt obligatoire', bon.arretOblig ? 'Oui' : 'Non');
  ligne('Créé le', formatDateTime(bon.dateCreation));
  ligne('Clôturé le', formatDateTime(bon.dateCloture));
  ligne('Coût total', bon.coutTotal != null ? `${bon.coutTotal} DT` : '—');
  if (bon.description) { y += 1; texteLibre(bon.description); }

  // ─── Diagnostic ───
  titreSection(`Diagnostic (${diagnostics.length})`);
  if (diagnostics.length === 0) videSection();
  diagnostics.forEach((d) => {
    ligne('Date', formatDateTime(d.dateDiagnostic));
    ligne('Technicien', nomPersonnel(d.personnelId, d.personnelNom, personnels));
    ligne('Cause probable', d.causeProbable || '—');
    ligne('Besoin de pièce', d.besoinPiece ? 'Oui' : 'Non');
    if (d.dureeEstimeeHeures) ligne('Durée estimée', `${d.dureeEstimeeHeures} h`);
    texteLibre(d.observations, 2);
    y += 2;
  });

  // ─── Tâches ───
  titreSection(`Tâches (${taches.length})`);
  if (taches.length === 0) videSection();
  taches.forEach((t, idx) => {
    ligne(`Tâche ${idx + 1}`, t.designation || '—');
    ligne('Période', `${formatDateTime(t.dateDebut)} → ${formatDateTime(t.dateFin)}`);
    if (t.qte) ligne('Quantité', t.qte);
    y += 2;
  });

  // ─── Intervenants ───
  titreSection(`Intervenants (${intervenants.length})`);
  if (intervenants.length === 0) videSection();
  intervenants.forEach((i) => {
    const nom = i.personnel ? `${i.personnel.nom || ''} ${i.personnel.prenom || ''}`.trim()
      : (i.intervenantNom || nomPersonnel(i.personnelId, null, personnels));
    ligne('Intervenant', nom || '—');
    ligne('Période', `${formatDateTime(i.dateDebutIntervention)} → ${formatDateTime(i.dateFinIntervention)}`);
    ligne('Heures / Coût', `${i.nbrHeure ?? '—'} h — ${i.coutTotal != null ? `${i.coutTotal} DT` : '—'}`);
    if (i.commentaire) texteLibre(i.commentaire, 2);
    y += 2;
  });

  // ─── Documents d'achat ───
  titreSection(`Documents d'achat (${documents?.length || 0})`);
  if (!documents || documents.length === 0) videSection();
  else {
    documents.forEach((doc_) => {
      ligne('Pièce', doc_.piece?.numPiece || doc_.description || `#${doc_.id}`);
      if (doc_.qte) ligne('Quantité', doc_.qte);
      y += 2;
    });
  }

  // ─── Contrôle ───
  titreSection(`Contrôle (${controles.length})`);
  if (controles.length === 0) videSection();
  controles.forEach((c) => {
    ligne('Date', formatDateTime(c.dateControle));
    ligne('Type', c.typeControle || '—');
    ligne('Technicien', nomPersonnel(c.personnelId, c.personnelNom, personnels));
    if (c.valeurMesuree != null || c.valeurAttendue != null) {
      ligne('Mesuré / Attendu', `${c.valeurMesuree ?? '—'} / ${c.valeurAttendue ?? '—'}`);
    }
    ligne('Conforme', c.conforme == null ? '—' : c.conforme ? 'Oui' : 'Non');
    texteLibre(c.observations, 2);
    y += 2;
  });

  // ─── Remise en service ───
  titreSection(`Remise en service (${remises.length})`);
  if (remises.length === 0) videSection();
  remises.forEach((r) => {
    ligne('Date', formatDateTime(r.date));
    ligne('Décision', r.conforme ? 'Autorisée' : 'Refusée');
    ligne('Autorisé par', nomPersonnel(r.autoriseParId, r.autoriseParNom, personnels));
    texteLibre(r.observations, 2);
    y += 2;
  });

  // ─── Commentaires ───
  titreSection(`Commentaires (${commentaires?.length || 0})`);
  if (!commentaires || commentaires.length === 0) videSection();
  else {
    commentaires.forEach((c) => {
      ligne(formatDateTime(c.date), c.personnelCreationNom || '');
      texteLibre(c.commentaire, 2);
      y += 1;
    });
  }

  const nomFichier = `bon-maintenance-${(bon.num || bon.id || 'sans-numero').toString().replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.pdf`;
  doc.save(nomFichier);
}