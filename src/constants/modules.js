import {
    Activity, BrainCircuit, Calculator, CalendarCheck, CalendarDays, CalendarRange, Car, ChartColumn,
    ClipboardList, FolderKanban, Fuel, Gauge, House, IdCard, LayoutDashboard, ListChecks, MapPin,
    MessageSquareWarning, Navigation, Receipt, Route, Settings, ShieldAlert, SlidersHorizontal, Table2,
    Timer, TrendingUp, TriangleAlert, UserCheck, UserCog, UserRound, Wrench,
} from 'lucide-react';

/*
 * Une icône par module, et une seule : le menu, le titre de la page et les cartes
 * utilisent la même. Pour changer l'icône d'un module, on la change ici.
 */
export const ICONES_MODULES = {
    accueil: House,
    monEspace: UserRound,
    tableauDeBord: LayoutDashboard,

    /* GMAO */
    reclamations: MessageSquareWarning,
    bonsMaintenance: Wrench,
    tachesBons: ClipboardList,
    maintenancePredictive: TrendingUp,
    planningBons: CalendarDays,
    planningIntervenant: CalendarRange,
    planningTechnicien: UserCog,
    analyse: ChartColumn,
    intelligence: BrainCircuit,
    cout: Calculator,
    sla: Timer,
    disponibilite: Activity,
    risque: ShieldAlert,
    parametres: Settings,
    parametresSysteme: SlidersHorizontal,
    tablesParametrage: Table2,
    referentielTaches: ListChecks,
    compteurs: Gauge,

    /* Parc auto */
    vehicules: Car,
    conducteurs: UserCheck,
    permis: IdCard,
    emplacements: MapPin,
    missions: Route,
    tracage: Navigation,
    reservations: CalendarCheck,
    projets: FolderKanban,
    planningParc: CalendarDays,
    carburant: Fuel,
    incidents: TriangleAlert,
    amendes: Receipt,
};
