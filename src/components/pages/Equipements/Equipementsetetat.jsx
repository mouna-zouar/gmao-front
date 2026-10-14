import EtatEquipement from '../EtatEquipement/EtatEquipement';

/*
 * « Équipements » : une seule vue (état, fiche, historique, QR code, étiquettes).
 * Conservé pour la fenêtre des bons de maintenance ; les props d'onglet sont ignorées.
 */
export default function EquipementsEtEtat() {
  return <EtatEquipement isModal />;
}