import { ICONES_MODULES as M } from './modules';


const grand = (Icone) => <Icone className="nav-icon-svg" strokeWidth={1.75} aria-hidden="true" />;
const petit = (Icone) => <Icone aria-hidden="true" />;

const ALL_ITEMS = [
    {
        id: 'dashboard',
        label: 'Accueil',
        path: '/',
        icon: grand(M.accueil),
        children: [
            { label: 'Accueil', path: '/', icon: petit(M.accueil), motsCles: 'modules page d’accueil' },
            { label: 'Tableau de bord', path: '/tableau-de-bord', icon: petit(M.tableauDeBord), motsCles: 'indicateurs kpi synthèse vue d’ensemble statistiques mttr mtbf disponibilité coûts sla' },
        ],
    },
    {
        id: 'mon-espace',
        label: 'Mon espace',
        path: '/mon-espace',
        icon: grand(M.monEspace),
        motsCles: 'mes bons mes réclamations mes demandes suivi panne profil',
    },

    {
        id: 'reclamations',
        label: 'Demandes',
        path: '/reclamations',
        icon: grand(M.reclamations),
        children: [
            { label: 'Tableau de bord des réclamations', path: '/reclamation-dashboard', icon: petit(M.tableauDeBord) },
                    { label: 'Réclamations', path: '/reclamations', icon: petit(M.reclamations), motsCles: 'demande panne signalement' },

        ],
    },

    {
        id: 'maintenance',
        label: 'Interventions',
        path: '/bons-maintenance',
        icon: grand(M.bonsMaintenance),
        children: [
            { label: 'Tableau de bord des bons', path: '/bon-maintenance-dashboard', icon: petit(M.tableauDeBord) },
            { label: 'Bons de maintenance', path: '/bons-maintenance', icon: petit(M.bonsMaintenance), motsCles: 'bon intervention équipements' },
            { label: 'Tâches des bons', path: '/bon-maintenance-taches', icon: petit(M.tachesBons), motsCles: 'kanban' },
            { label: 'Alertes de stock', path: '/stock-alertes', icon: petit(M.stock), motsCles: 'seuil rupture réapprovisionnement commande pièces magasin cubix' },
            { label: 'Maintenance prédictive', path: '/maintenance-predictive', icon: petit(M.maintenancePredictive) },
            
        ],
    },

    {
        id: 'planning',
        label: 'Planning',
        path: '/planning-bon-maintenance',
        icon: grand(M.planningBons),
        children: [
            { label: 'Planning des bons', path: '/planning-bon-maintenance', icon: petit(M.planningBons), motsCles: 'calendrier' },
            { label: 'Planning technicien', path: '/planning-technicien', icon: petit(M.planningTechnicien) },
            { label: 'Planning de l’équipe', path: '/planning-equipe', icon: petit(M.planningBons), motsCles: 'glisser déposer semaine affectation techniciens' },
            { label: 'Formations des techniciens', path: '/formations', icon: petit(M.formations), motsCles: 'formation habilitation compétence stage certificat' },
        ],
    },

    {
        id: 'equipements',
        label: 'Équipements',
        path: '/equipements',
        icon: grand(M.equipements),
        motsCles: 'parc immobilisations état en service en panne hors service famille matériel cubix',
        children: [
            { label: 'Équipements', path: '/equipements', icon: petit(M.equipements), motsCles: 'parc immobilisations état en service en panne hors service famille matériel cubix' },
            { label: 'Plan de renouvellement', path: '/renouvellement', icon: petit(M.renouvellement), motsCles: 'remplacement investissement budget fin de vie vétusté amortissement maximo' },
            { label: 'Supervision', path: '/supervision', icon: petit(M.supervision), motsCles: 'temps réel capteurs sondes réseau en ligne hors ligne agents alertes machines' },
            { label: 'Métrologie', path: '/metrologie', icon: petit(M.metrologie), motsCles: 'étalonnage vérification contrôle qualité sécurité électrique certificat échéance' },
            { label: 'Matériovigilance', path: '/materiovigilance', icon: petit(M.materiovigilance), motsCles: 'incident dispositif médical déclaration autorité vigilance' },
        ],
    },

    {
        id: 'supervision',
        label: 'Supervision',
        path: '/supervision',
        icon: grand(M.supervision),
        motsCles: 'Tableau de bord temps réel capteurs sondes réseau en ligne hors ligne agents alertes machines',
    },

    {
        id: 'parametres',
        label: 'Paramétrages',
        path: '/parametres-systeme',
        icon: grand(M.parametres),
        children: [
            { label: 'Paramètres système', path: '/parametres-systeme', icon: petit(M.parametresSysteme) },
            { label: 'Tables de paramétrage', path: '/tables-parametrage', icon: petit(M.tablesParametrage), motsCles: 'listes valeurs' },
            { label: 'Référentiel des tâches', path: '/taches', icon: petit(M.referentielTaches), motsCles: 'tâches types' },
            { label: 'Gammes d’intervention', path: '/gammes', icon: petit(M.gammes), motsCles: 'gammes procédures modèles job plans' },
            { label: 'Compteurs', path: '/referentiels/compteurs', icon: petit(M.compteurs), motsCles: 'référentiel' },
        ],
    },

    {
        id: 'parc-dashboard',
        label: 'Dashboard Parc',
        path: '/parc-dashboard',
        icon: grand(M.tableauDeBord),
    },
    {
        id: 'parc-vehicules',
        label: 'Véhicules',
        path: '/vehicules',
        icon: grand(M.vehicules),
        children: [
            { label: 'Véhicules', path: '/vehicules', icon: petit(M.vehicules), motsCles: 'coût frais' },
            { label: 'Conducteurs', path: '/vehicule-conducteurs', icon: petit(M.conducteurs) },
            { label: 'Permis de conduire', path: '/permis-conduite', icon: petit(M.permis) },
            { label: 'Emplacements', path: '/emplacements', icon: petit(M.emplacements) },
        ],
    },
    {
        id: 'parc-activites',
        label: 'Activités',
        path: '/vehicule-missions',
        icon: grand(M.missions),
        children: [
            { label: 'Missions', path: '/vehicule-missions', icon: petit(M.missions) },
            { label: 'Traçage', path: '/vehicule-tracage', icon: petit(M.tracage), motsCles: 'gps trajet' },
            { label: 'Réservations', path: '/vehicule-reservations', icon: petit(M.reservations) },
            { label: 'Projets', path: '/projets', icon: petit(M.projets) },
            { label: 'Planning Parc', path: '/parc-planning', icon: petit(M.planningParc) },
        ],
    },
    {
        id: 'parc-suivi',
        label: 'Suivi Parc',
        path: '/vehicule-bons-carburant',
        icon: grand(M.carburant),
        children: [
            { label: 'Bons de carburant', path: '/vehicule-bons-carburant', icon: petit(M.carburant) },
            { label: 'Incidents', path: '/vehicule-incidents', icon: petit(M.incidents), motsCles: 'accident' },
            { label: 'Amendes', path: '/vehicule-amendes', icon: petit(M.amendes), motsCles: 'infraction contravention' },
        ],
    },
];

const byId = (ids) => ids.map((id) => ALL_ITEMS.find((i) => i.id === id)).filter(Boolean);

export const NAV_SECTIONS = [
    {
        id: 'gmao',
        label: 'GMAO',
        items: byId(['dashboard', 'mon-espace', 'reclamations', 'maintenance', 'planning', 'equipements', 'taches', 'parametres']),
    },
    {
        id: 'parc',
        label: 'Parc',
        items: byId(['parc-dashboard', 'parc-vehicules', 'parc-activites', 'parc-suivi']),
    },
];

export const NAV_ITEMS = NAV_SECTIONS.flatMap((section) => section.items);

export const NAV_PAGES = NAV_ITEMS.flatMap((item) =>
    item.children
        ? item.children.map((c) => ({ ...c, parent: item }))
        : [{ path: item.path, label: item.label, icon: item.icon, motsCles: item.motsCles, parent: item, racine: true }],
);

export function trouverPage(pathname, search = '') {
    const params = new URLSearchParams(search);
    let meilleure = null;
    let score = -1;
    for (const page of NAV_PAGES) {
        const [chemin, requete] = page.path.split('?');
        if (chemin !== pathname) continue;
        const attendus = [...new URLSearchParams(requete || '')];
        if (!attendus.every(([k, v]) => params.get(k) === v)) continue;
        if (attendus.length > score) { meilleure = page; score = attendus.length; }
    }
    return meilleure;
}
