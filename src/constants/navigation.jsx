import {
    Activity, BrainCircuit, Briefcase, Calculator, CalendarCheck, CalendarDays, Car, ChartColumn,
    ClipboardCheck, ClipboardList, Fuel, Gauge, House, IdCard, LayoutDashboard, ListChecks, Lock, Map,
    MessageSquareWarning, Navigation, OctagonAlert, Receipt, Route, Settings, ShieldAlert,
    SlidersHorizontal, Table2, Timer, TrendingUp, TriangleAlert, UserCog, UserRound, Workflow, Wrench,
} from 'lucide-react';

/*
 * Menu rangé par métier : chaque page a une place, et une seule.
 *   id     : identifiant stable (couleur du groupe dans Layout.css, cartes du tableau de bord)
 *   path   : page ouverte par défaut ; un enfant peut porter des paramètres (?vue=…)
 *   motsCles : mots supplémentaires pour la recherche du menu
 * Pages volontairement absentes : /fiche-bon-maintenance (ouverte depuis un bon),
 * /equipement/:id (ouverte depuis un équipement) et les Équipements, ouverts depuis la page des bons.
 */

const grand = (Icone) => <Icone className="nav-icon-svg" strokeWidth={1.75} aria-hidden="true" />;
const petit = (Icone) => <Icone aria-hidden="true" />;

const ALL_ITEMS = [
    /* ── Au quotidien ── */
    {
        id: 'dashboard',
        label: 'Tableau de bord',
        path: '/',
        icon: grand(House),
    },
    {
        id: 'mon-espace',
        label: 'Mon espace',
        path: '/mon-espace',
        icon: grand(UserRound),
        motsCles: 'mes bons mes réclamations mes demandes suivi panne profil',
    },

    {
        id: 'reclamations',
        label: 'Demandes',
        path: '/reclamations',
        icon: grand(MessageSquareWarning),
        children: [
            { label: 'Tableau de bord des réclamations', path: '/reclamation-dashboard', icon: petit(LayoutDashboard) },
                    { label: 'Réclamations', path: '/reclamations', icon: petit(MessageSquareWarning), motsCles: 'demande panne signalement' },

        ],
    },

    {
        id: 'maintenance',
        label: 'Interventions',
        path: '/bons-maintenance',
        icon: grand(Wrench),
        children: [
            { label: 'Tableau de bord des bons', path: '/bon-maintenance-dashboard', icon: petit(LayoutDashboard) },
            { label: 'Bons de maintenance', path: '/bons-maintenance', icon: petit(Wrench), motsCles: 'bon intervention équipements' },
            { label: 'Tâches des bons', path: '/bon-maintenance-taches', icon: petit(ClipboardList), motsCles: 'kanban' },
            { label: 'Maintenance prédictive', path: '/maintenance-predictive', icon: petit(TrendingUp) },
        ],
    },

    /* ── Planification ── */
    {
        id: 'planning',
        label: 'Planning',
        path: '/planning-bon-maintenance',
        icon: grand(CalendarDays),
        children: [
            { label: 'Planning des bons', path: '/planning-bon-maintenance', icon: petit(CalendarDays), motsCles: 'calendrier' },
            { label: 'Planning par intervenant', path: '/planning-par-intervenant', icon: petit(CalendarCheck) },
            { label: 'Planning technicien', path: '/planning-technicien', icon: petit(UserCog) },
        ],
    },

    /* ── Pilotage ── */
    {
        id: 'taches',
        label: 'Analyse',
        path: '/intelligence',
        icon: grand(ChartColumn),
        children: [
            { label: 'Intelligence', path: '/intelligence', icon: petit(BrainCircuit), motsCles: 'ia recommandations' },
            { label: 'Coût', path: '/cout', icon: petit(Calculator), motsCles: 'dépenses budget' },
            { label: 'SLA', path: '/sla', icon: petit(Timer), motsCles: 'délais retard' },
            { label: 'Disponibilité', path: '/disponibilite', icon: petit(Activity), motsCles: 'mtbf mttr' },
            { label: 'Risque', path: '/risque', icon: petit(ShieldAlert), motsCles: 'criticité' },
        ],
    },

    /* ── Administration ── */
    {
        id: 'parametres',
        label: 'Paramétrages',
        path: '/parametres-systeme',
        icon: grand(Settings),
        children: [
            { label: 'Paramètres système', path: '/parametres-systeme', icon: petit(SlidersHorizontal) },
            { label: 'Tables de paramétrage', path: '/tables-parametrage', icon: petit(Table2), motsCles: 'listes valeurs' },
            { label: 'Référentiel des tâches', path: '/taches', icon: petit(ListChecks), motsCles: 'gammes' },
            { label: 'Compteurs', path: '/referentiels/compteurs', icon: petit(Gauge), motsCles: 'référentiel' },
        ],
    },

    /* ── Parc automobile ── */
    {
        id: 'parc-dashboard',
        label: 'Dashboard Parc',
        path: '/parc-dashboard',
        icon: grand(LayoutDashboard),
    },
    {
        id: 'parc-vehicules',
        label: 'Véhicules',
        path: '/vehicules',
        icon: grand(Car),
        children: [
            { label: 'Véhicules', path: '/vehicules', icon: petit(Car), motsCles: 'coût frais' },
            { label: 'Conducteurs', path: '/vehicule-conducteurs', icon: petit(UserRound) },
            { label: 'Permis de conduire', path: '/permis-conduite', icon: petit(IdCard) },
            { label: 'Emplacements', path: '/emplacements', icon: petit(Map) },
        ],
    },
    {
        id: 'parc-activites',
        label: 'Activités',
        path: '/vehicule-missions',
        icon: grand(Route),
        children: [
            { label: 'Missions', path: '/vehicule-missions', icon: petit(Route) },
            { label: 'Traçage', path: '/vehicule-tracage', icon: petit(Navigation), motsCles: 'gps trajet' },
            { label: 'Réservations', path: '/vehicule-reservations', icon: petit(ClipboardCheck) },
            { label: 'Projets', path: '/projets', icon: petit(Briefcase) },
            { label: 'Planning Parc', path: '/parc-planning', icon: petit(CalendarDays) },
        ],
    },
    {
        id: 'parc-suivi',
        label: 'Suivi Parc',
        path: '/vehicule-bons-carburant',
        icon: grand(Fuel),
        children: [
            { label: 'Bons de carburant', path: '/vehicule-bons-carburant', icon: petit(Fuel) },
            { label: 'Incidents', path: '/vehicule-incidents', icon: petit(TriangleAlert), motsCles: 'accident' },
            { label: 'Amendes', path: '/vehicule-amendes', icon: petit(Receipt), motsCles: 'infraction contravention' },
        ],
    },
];

const byId = (ids) => ids.map((id) => ALL_ITEMS.find((i) => i.id === id)).filter(Boolean);

// Deux espaces (GMAO + Parc), rangés par métier à l'intérieur
export const NAV_SECTIONS = [
    {
        id: 'gmao',
        label: 'GMAO',
        items: byId(['dashboard', 'mon-espace', 'reclamations', 'maintenance', 'planning', 'taches', 'parametres']),
    },
    {
        id: 'parc',
        label: 'Parc',
        items: byId(['parc-dashboard', 'parc-vehicules', 'parc-activites', 'parc-suivi']),
    },
];

// Liste à plat (utilisée par le fil d'Ariane et la page Dashboard)
export const NAV_ITEMS = NAV_SECTIONS.flatMap((section) => section.items);

/** Toutes les pages du menu, à plat : [{ path, label, parent, icon, motsCles }] */
export const NAV_PAGES = NAV_ITEMS.flatMap((item) =>
    item.children
        ? item.children.map((c) => ({ ...c, parent: item }))
        : [{ path: item.path, label: item.label, icon: item.icon, motsCles: item.motsCles, parent: item, racine: true }],
);

/**
 * Page du menu correspondant à l'adresse courante (la plus précise gagne :
 * /bons-maintenance?vue=equipements ne se confond pas avec /bons-maintenance).
 */
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
