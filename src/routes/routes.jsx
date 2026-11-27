import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import ChargementPage, { LimiteChargement } from './ChargementPage';
import Dashboard from '../components/pages/Dashboard/Dashboard';
const PageIntrouvable = lazy(() => import('../components/pages/Introuvable/PageIntrouvable'));
const Login = lazy(() => import('../components/pages/login/Login'));

const IMPORTS = {
    CompteurList: () => import('../components/pages/Compteurs/Compteurs'),
    Formations: () => import('../components/pages/Formations/Formations'),
    Reclamations: () => import('../components/pages/Reclamations/Reclamations'),
    BonsMaintenance: () => import('../components/pages/bonmaintenance/Bonsmaintenance'),
    Referentielconsultation: () => import('../components/pages/Referentiel/Referentielconsultation'),
    Fichebonmaintenance: () => import('../components/pages/Fichebonmaintenance/Fichebonmaintenance'),
    Planningbonmaintenance: () => import('../components/pages/planning/Planningbonmaintenance'),
    PlanningParIntervenant: () => import('../components/pages/planning/PlanningParIntervenant'),
    PlanningTechnicien: () => import('../components/pages/planning/Planningtechnicien'),
    PlanningEquipe: () => import('../components/pages/planning/PlanningEquipe'),
    StockAlertes: () => import('../components/pages/stock/StockAlertes'),
    IndicateursPerformance: () => import('../components/pages/Indicateurs/IndicateursPerformance'),
    Metrologie: () => import('../components/pages/Metrologie/Metrologie'),
    Materiovigilance: () => import('../components/pages/Metrologie/Materiovigilance'),
    Maintenancetaches: () => import('../components/pages/taches/Maintenancetaches'),
    Gammes: () => import('../components/pages/gammes/Gammes'),
    Reclamationdashboard: () => import('../components/pages/rec-dashboard/Reclamationdashboard'),
    Bonmaintenancedashboard: () => import('../components/pages/bon-main/Bonmaintenancedashboard'),
    Bonmaintenancetachestable: () => import('../components/pages/bon-main-tache/Bonmaintenancetachestable'),
    Workflow: () => import('../components/pages/workflow/Workflow'),
    Anomalies: () => import('../components/pages/Anomalies/Anomalies'),
    MaintenancePredictive: () => import('../components/pages/MaintenancePredictive/Maintenancepredictive'),
    BlocagesImmobilisation: () => import('../components/pages/Blocagesimmobilisation/Blocagesimmobilisation'),
    Disponibilite: () => import('../components/pages/Disponibilite/Disponibilite'),
    Sla: () => import('../components/pages/Sla/Sla'),
    VehiculesPage: () => import('../components/pages/parc/vehicules/VehiculesPage'),
    VehiculeConducteurs: () => import('../components/pages/parc/VehiculeConducteurs/VehiculeConducteurs'),
    PermisConduite: () => import('../components/pages/parc/PermisConduite/PermisConduite'),
    VehiculeMissions: () => import('../components/pages/parc/VehiculeMissions/VehiculeMissions'),
    VehiculeTracage: () => import('../components/pages/parc/VehiculeMissions/VehiculeTracage'),
    VehiculeBonsCarburant: () => import('../components/pages/parc/VehiculeBonsCarburant/VehiculeBonsCarburant'),
    VehiculeIncidents: () => import('../components/pages/parc/VehiculeIncident/VehiculeIncidents'),
    VehiculeReservations: () => import('../components/pages/parc/VehiculeReservations/VehiculeReservations'),
    Projets: () => import('../components/pages/parc/Projets/Projets'),
    Emplacements: () => import('../components/pages/parc/Emplacements/Emplacements'),
    ParcDashboard: () => import('../components/pages/parc/ParcDashboard/ParcDashboard'),
    Cout: () => import('../components/pages/Cout/Cout'),
    ParcPlanning: () => import('../components/pages/parc/Planning/ParcPlanning'),
    Risque: () => import('../components/pages/Risque/Risque'),
    Intelligence: () => import('../components/pages/Intelligence/Intelligence'),
    AlertesMachines: () => import('../components/pages/AlertesMachines/AlertesMachines'),
    Supervision: () => import('../components/pages/Supervision/Supervision'),
    Renouvellement: () => import('../components/pages/Renouvellement/Renouvellement'),
    TableauDeBord: () => import('../components/pages/TableauDeBord/TableauDeBord'),
    ParametresSysteme: () => import('../components/pages/ParametresSysteme/ParametresSysteme'),
    EspacePersonnel: () => import('../components/pages/EspacePersonnel/EspacePersonnel'),
    EtatEquipement: () => import('../components/pages/Etatequipement/Etatequipement'),
    EquipementFiche: () => import('../components/pages/Equipements/EquipementFiche'),
    VehiculeAmendes: () => import('../components/pages/parc/Vehiculeamendes/Vehiculeamendes'),
    VehiculeCouts: () => import('../components/pages/parc/VehiculeCouts/VehiculeCouts'),
};

const CompteurList = lazy(IMPORTS.CompteurList);
const Formations = lazy(IMPORTS.Formations);
const Reclamations = lazy(IMPORTS.Reclamations);
const BonsMaintenance = lazy(IMPORTS.BonsMaintenance);
const Referentielconsultation = lazy(IMPORTS.Referentielconsultation);
const Fichebonmaintenance = lazy(IMPORTS.Fichebonmaintenance);
const Planningbonmaintenance = lazy(IMPORTS.Planningbonmaintenance);
const PlanningParIntervenant = lazy(IMPORTS.PlanningParIntervenant);
const PlanningTechnicien = lazy(IMPORTS.PlanningTechnicien);
const PlanningEquipe = lazy(IMPORTS.PlanningEquipe);
const StockAlertes = lazy(IMPORTS.StockAlertes);
const IndicateursPerformance = lazy(IMPORTS.IndicateursPerformance);
const Metrologie = lazy(IMPORTS.Metrologie);
const Materiovigilance = lazy(IMPORTS.Materiovigilance);
const Maintenancetaches = lazy(IMPORTS.Maintenancetaches);
const Gammes = lazy(IMPORTS.Gammes);
const Reclamationdashboard = lazy(IMPORTS.Reclamationdashboard);
const Bonmaintenancedashboard = lazy(IMPORTS.Bonmaintenancedashboard);
const Bonmaintenancetachestable = lazy(IMPORTS.Bonmaintenancetachestable);
const Workflow = lazy(IMPORTS.Workflow);
const Anomalies = lazy(IMPORTS.Anomalies);
const MaintenancePredictive = lazy(IMPORTS.MaintenancePredictive);
const BlocagesImmobilisation = lazy(IMPORTS.BlocagesImmobilisation);
const Disponibilite = lazy(IMPORTS.Disponibilite);
const Sla = lazy(IMPORTS.Sla);
const VehiculesPage = lazy(IMPORTS.VehiculesPage);
const VehiculeConducteurs = lazy(IMPORTS.VehiculeConducteurs);
const PermisConduite = lazy(IMPORTS.PermisConduite);
const VehiculeMissions = lazy(IMPORTS.VehiculeMissions);
const VehiculeTracage = lazy(IMPORTS.VehiculeTracage);
const VehiculeBonsCarburant = lazy(IMPORTS.VehiculeBonsCarburant);
const VehiculeIncidents = lazy(IMPORTS.VehiculeIncidents);
const VehiculeReservations = lazy(IMPORTS.VehiculeReservations);
const Projets = lazy(IMPORTS.Projets);
const Emplacements = lazy(IMPORTS.Emplacements);
const ParcDashboard = lazy(IMPORTS.ParcDashboard);
const Cout = lazy(IMPORTS.Cout);
const ParcPlanning = lazy(IMPORTS.ParcPlanning);
const Risque = lazy(IMPORTS.Risque);
const Intelligence = lazy(IMPORTS.Intelligence);
const AlertesMachines = lazy(IMPORTS.AlertesMachines);
const Supervision = lazy(IMPORTS.Supervision);
const Renouvellement = lazy(IMPORTS.Renouvellement);
const TableauDeBord = lazy(IMPORTS.TableauDeBord);
const ParametresSysteme = lazy(IMPORTS.ParametresSysteme);
const EspacePersonnel = lazy(IMPORTS.EspacePersonnel);
const EtatEquipement = lazy(IMPORTS.EtatEquipement);
const EquipementFiche = lazy(IMPORTS.EquipementFiche);
const VehiculeAmendes = lazy(IMPORTS.VehiculeAmendes);
const VehiculeCouts = lazy(IMPORTS.VehiculeCouts);

const IMPORT_PAR_CHEMIN = {
    '/referentiels/compteurs': IMPORTS.CompteurList,
    '/formations': IMPORTS.Formations,
    '/reclamations': IMPORTS.Reclamations,
    '/mon-espace': IMPORTS.EspacePersonnel,
    '/equipements': IMPORTS.EtatEquipement,
    '/equipement/:id': IMPORTS.EquipementFiche,
    '/bons-maintenance': IMPORTS.BonsMaintenance,
    '/tables-parametrage': IMPORTS.Referentielconsultation,
    '/parametres-systeme': IMPORTS.ParametresSysteme,
    '/fiche-bon-maintenance': IMPORTS.Fichebonmaintenance,
    '/planning-bon-maintenance': IMPORTS.Planningbonmaintenance,
    '/reclamation-dashboard': IMPORTS.Reclamationdashboard,
    '/taches': IMPORTS.Maintenancetaches,
    '/gammes': IMPORTS.Gammes,
    '/bon-maintenance-dashboard': IMPORTS.Bonmaintenancedashboard,
    '/bon-maintenance-taches': IMPORTS.Bonmaintenancetachestable,
    '/workflow': IMPORTS.Workflow,
    '/planning-par-intervenant': IMPORTS.PlanningParIntervenant,
    '/planning-technicien': IMPORTS.PlanningTechnicien,
    '/planning-equipe': IMPORTS.PlanningEquipe,
    '/stock-alertes': IMPORTS.StockAlertes,
    '/indicateurs': IMPORTS.IndicateursPerformance,
    '/metrologie': IMPORTS.Metrologie,
    '/materiovigilance': IMPORTS.Materiovigilance,
    '/anomalies': IMPORTS.Anomalies,
    '/maintenance-predictive': IMPORTS.MaintenancePredictive,
    '/blocages-immobilisation': IMPORTS.BlocagesImmobilisation,
    '/disponibilite': IMPORTS.Disponibilite,
    '/sla': IMPORTS.Sla,
    '/cout': IMPORTS.Cout,
    '/parc-planning': IMPORTS.ParcPlanning,
    '/intelligence': IMPORTS.Intelligence,
    '/alertes-machines': IMPORTS.AlertesMachines,
    '/supervision': IMPORTS.Supervision,
    '/tableau-de-bord': IMPORTS.TableauDeBord,
    '/renouvellement': IMPORTS.Renouvellement,
    '/vehicules': IMPORTS.VehiculesPage,
    '/vehicule-conducteurs': IMPORTS.VehiculeConducteurs,
    '/permis-conduite': IMPORTS.PermisConduite,
    '/vehicule-missions': IMPORTS.VehiculeMissions,
    '/vehicule-tracage': IMPORTS.VehiculeTracage,
    '/vehicule-bons-carburant': IMPORTS.VehiculeBonsCarburant,
    '/vehicule-incidents': IMPORTS.VehiculeIncidents,
    '/vehicule-reservations': IMPORTS.VehiculeReservations,
    '/vehicule-amendes': IMPORTS.VehiculeAmendes,
    '/vehicule-couts': IMPORTS.VehiculeCouts,
    '/parc-dashboard': IMPORTS.ParcDashboard,
    '/risque': IMPORTS.Risque,
    '/projets': IMPORTS.Projets,
    '/emplacements': IMPORTS.Emplacements,
};

const PAGES_FREQUENTES = ['/bons-maintenance', '/reclamations', '/mon-espace', '/tableau-de-bord', '/equipements'];

const prechargees = new Set();
function prechargerChemin(chemin) {
    const importer = IMPORT_PAR_CHEMIN[chemin];
    if (!importer || prechargees.has(chemin)) return;
    prechargees.add(chemin);
    importer().catch(() => prechargees.delete(chemin));
}

const connexionLente = () => {
    const c = typeof navigator !== 'undefined' ? navigator.connection : null;
    return Boolean(c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || '')));
};

if (import.meta.env.PROD && typeof window !== 'undefined' && !connexionLente()) {
    const surLien = (e) => {
        const lien = e.target?.closest?.('a[href]');
        if (!lien || lien.origin !== window.location.origin) return;
        prechargerChemin(lien.pathname);
    };
    document.addEventListener('pointerover', surLien, { passive: true });
    document.addEventListener('focusin', surLien);
    const auRepos = window.requestIdleCallback || ((f) => setTimeout(f, 2500));
    const prechargerFrequentes = () => auRepos(() => PAGES_FREQUENTES.forEach(prechargerChemin), { timeout: 8000 });
    if (document.readyState === 'complete') prechargerFrequentes();
    else window.addEventListener('load', prechargerFrequentes, { once: true });
}

const VersMesDemandes = () => {
    const params = new URLSearchParams(useLocation().search);
    params.set('onglet', 'demandes');
    return <Navigate to={`/mon-espace?${params.toString()}`} replace />;
};

const AppRoutes = () => {
    return (
        <LimiteChargement>
        <Suspense fallback={<ChargementPage />}>
        <Routes>
            <Route path="/login" element={<Login />} />

            <Route path="/" element={<Dashboard />} />

            <Route path="/referentiels/compteurs" element={<CompteurList />} />
            <Route path="/formations" element={<Formations />} />
            <Route path="/reclamations" element={<Reclamations />} />
            <Route path="/mes-demandes" element={<VersMesDemandes />} />
            <Route path="/mon-espace" element={<EspacePersonnel />} />
            <Route path="/equipements" element={<EtatEquipement />} />
            <Route path="/equipement/:id" element={<EquipementFiche />} />
            <Route path="/bons-maintenance" element={<BonsMaintenance />} />
            <Route path="/tables-parametrage" element={<Referentielconsultation  />} />
            <Route path="/parametres-systeme" element={<ParametresSysteme />} />
            <Route path="/fiche-bon-maintenance" element={<Fichebonmaintenance />} />
            <Route path="/planning-bon-maintenance" element={<Planningbonmaintenance />} />
            <Route path="/reclamation-dashboard" element={<Reclamationdashboard />} />
            <Route path="/taches" element={<Maintenancetaches />} />
            <Route path="/gammes" element={<Gammes />} />
            <Route path="/bon-maintenance-dashboard" element={<Bonmaintenancedashboard />} />
            <Route path="/bon-maintenance-taches" element={<Bonmaintenancetachestable />} />
            <Route path="/workflow" element={<Workflow />} />
            <Route path="/planning-par-intervenant" element={<PlanningParIntervenant />} />
            <Route path="/planning-technicien" element={<PlanningTechnicien />} />
            <Route path="/planning-equipe" element={<PlanningEquipe />} />
            <Route path="/stock-alertes" element={<StockAlertes />} />
            <Route path="/indicateurs" element={<IndicateursPerformance />} />
            <Route path="/metrologie" element={<Metrologie />} />
            <Route path="/materiovigilance" element={<Materiovigilance />} />
            <Route path="/anomalies" element={<Anomalies />} />
            <Route path="/maintenance-predictive" element={<MaintenancePredictive />} />
            <Route path="/blocages-immobilisation" element={<BlocagesImmobilisation />} />
            <Route path="/etat-equipement" element={<Navigate to="/equipements" replace />} />
            <Route path="/disponibilite" element={<Disponibilite />} />
            <Route path="/sla" element={<Sla />} />
            <Route path="/cout" element={<Cout />} />
            <Route path="/parc-planning" element={<ParcPlanning />} />
            <Route path="/intelligence" element={<Intelligence />} />
            <Route path="/alertes-machines" element={<AlertesMachines />} />
            <Route path="/supervision" element={<Supervision />} />
            <Route path="/tableau-de-bord" element={<TableauDeBord />} />
            <Route path="/renouvellement" element={<Renouvellement />} />
            <Route path="/vehicules" element={<VehiculesPage />} />
            <Route path="/vehicule-conducteurs" element={<VehiculeConducteurs />} />
            <Route path="/permis-conduite" element={<PermisConduite />} />
            <Route path="/vehicule-missions" element={<VehiculeMissions />} />
            <Route path="/vehicule-tracage" element={<VehiculeTracage />} />
            <Route path="/vehicule-bons-carburant" element={<VehiculeBonsCarburant />} />
            <Route path="/vehicule-incidents" element={<VehiculeIncidents />} />
            <Route path="/vehicule-reservations" element={<VehiculeReservations />} />
            <Route path="/vehicule-amendes" element={<VehiculeAmendes />} />
            <Route path="/vehicule-couts" element={<VehiculeCouts />} />

            <Route path="/parc-dashboard" element={<ParcDashboard />} />
            <Route path="/risque" element={<Risque />} />
            <Route path="/projets" element={<Projets />} />
            <Route path="/emplacements" element={<Emplacements />} />

            <Route path="*" element={<PageIntrouvable />} />

        </Routes>
        </Suspense>
        </LimiteChargement>
    );
};

export default AppRoutes;