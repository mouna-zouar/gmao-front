import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from '../components/pages/Dashboard/Dashboard';
import CompteurList from '../components/pages/Compteurs/Compteurs';
import Reclamations from '../components/pages/Reclamations/Reclamations';
import BonsMaintenance  from '../components/pages/bonmaintenance/Bonsmaintenance';
import Referentielconsultation from '../components/pages/Referentiel/Referentielconsultation';
import Fichebonmaintenance from '../components/pages/Fichebonmaintenance/Fichebonmaintenance';
import Planningbonmaintenance from '../components/pages/Planning/Planningbonmaintenance';
import PlanningParIntervenant from '../components/pages/planning/PlanningParIntervenant';
import PlanningTechnicien from '../components/pages/planning/PlanningTechnicien';
import Maintenancetaches from '../components/pages/taches/maintenancetaches';
import Reclamationdashboard from '../components/pages/rec-dashboard/Reclamationdashboard';
import Bonmaintenancedashboard from '../components/pages/bon-main/Bonmaintenancedashboard';
import Bonmaintenancetachestable from '../components/pages/bon-main-tache/Bonmaintenancetachestable';
import Workflow from '../components/pages/workflow/Workflow';
import Login from '../components/pages/Login/Login';
import Anomalies from '../components/pages/Anomalies/Anomalies';
import MaintenancePredictive from '../components/pages/MaintenancePredictive/MaintenancePredictive';
import BlocagesImmobilisation from '../components/pages/BlocagesImmobilisation/BlocagesImmobilisation';
import Disponibilite from '../components/pages/Disponibilite/Disponibilite';
import Sla from '../components/pages/Sla/Sla';
import VehiculesPage from '../components/pages/parc/vehicules/VehiculesPage';
import VehiculeConducteurs from '../components/pages/parc/VehiculeConducteurs/VehiculeConducteurs'; 
import PermisConduite from '../components/pages/parc/PermisConduite/PermisConduite';
import VehiculeMissions from '../components/pages/parc/VehiculeMissions/VehiculeMissions';
import VehiculeTracage from '../components/pages/parc/VehiculeMissions/VehiculeTracage';
import VehiculeBonsCarburant from '../components/pages/parc/VehiculeBonsCarburant/VehiculeBonsCarburant';
import VehiculeIncidents from '../components/pages/parc/VehiculeIncident/VehiculeIncidents';
import VehiculeReservations from '../components/pages/parc/VehiculeReservations/VehiculeReservations';
import Projets from '../components/pages/parc/Projets/Projets';
import Emplacements from '../components/pages/parc/Emplacements/Emplacements';
import ParcDashboard from '../components/pages/parc/ParcDashboard/ParcDashboard';
import Cout from '../components/pages/Cout/Cout';
import ParcPlanning from '../components/pages/parc/Planning/ParcPlanning';
import Risque from '../components/pages/Risque/Risque';
import Intelligence from '../components/pages/Intelligence/Intelligence';
import ParametresSysteme from '../components/pages/ParametresSysteme/ParametresSysteme';
import EspacePersonnel from '../components/pages/EspacePersonnel/EspacePersonnel';
import EtatEquipement from '../components/pages/EtatEquipement/EtatEquipement';
import EquipementFiche from '../components/pages/Equipements/EquipementFiche';
import VehiculeAmendes from '../components/pages/parc/Vehiculeamendes/Vehiculeamendes';
import VehiculeCouts from '../components/pages/parc/VehiculeCouts/VehiculeCouts';





const AppRoutes = () => {
    return (
        <Routes>
            <Route path="/login" element={<Login />} />

            <Route path="/" element={<Dashboard />} />

            <Route path="/referentiels/compteurs" element={<CompteurList />} />
            <Route path="/reclamations" element={<Reclamations />} />
            <Route path="/mon-espace" element={<EspacePersonnel />} />
            <Route path="/equipements" element={<EtatEquipement />} />
            {/* Ouverte aussi en scannant le QR code collé sur l'appareil */}
            <Route path="/equipement/:id" element={<EquipementFiche />} />
            <Route path="/bons-maintenance" element={<BonsMaintenance />} />
            <Route path="/tables-parametrage" element={<Referentielconsultation  />} />
            <Route path="/parametres-systeme" element={<ParametresSysteme />} />
            <Route path="/fiche-bon-maintenance" element={<Fichebonmaintenance />} />
            <Route path="/planning-bon-maintenance" element={<Planningbonmaintenance />} />
            <Route path="/reclamation-dashboard" element={<Reclamationdashboard />} />
            <Route path="/taches" element={<Maintenancetaches />} />
            <Route path="/bon-maintenance-dashboard" element={<Bonmaintenancedashboard />} />
            <Route path="/bon-maintenance-taches" element={<Bonmaintenancetachestable />} />
            <Route path="/workflow" element={<Workflow />} />
            <Route path="/planning-par-intervenant" element={<PlanningParIntervenant />} />
            <Route path="/planning-technicien" element={<PlanningTechnicien />} />
            <Route path="/anomalies" element={<Anomalies />} />
            <Route path="/maintenance-predictive" element={<MaintenancePredictive />} />
            <Route path="/blocages-immobilisation" element={<BlocagesImmobilisation />} />
            <Route path="/etat-equipement" element={<Navigate to="/equipements" replace />} />
            <Route path="/disponibilite" element={<Disponibilite />} />
            <Route path="/sla" element={<Sla />} />
            <Route path="/cout" element={<Cout />} />
            <Route path="/parc-planning" element={<ParcPlanning />} />
            <Route path="/intelligence" element={<Intelligence />} />
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

        </Routes>
    );
};

export default AppRoutes;