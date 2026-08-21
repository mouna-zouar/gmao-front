import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Dashboard from '../components/pages/Dashboard/Dashboard';
import CompteurList from '../components/pages/Compteurs/Compteurs';
import Reclamations from '../components/pages/Reclamations/Reclamations';
import BonsMaintenance  from '../components/pages/bonmaintenance/Bonsmaintenance';
import Referentielconsultation from '../components/pages/Referentiel/Referentielconsultation';
import Fichebonmaintenance from '../components/pages/Fichebonmaintenance/Fichebonmaintenance';
import Planningbonmaintenance from '../components/pages/Planning/Planningbonmaintenance';
import Maintenancetaches from '../components/pages/taches/maintenancetaches';
import Reclamationdashboard from '../components/pages/rec-dashboard/Reclamationdashboard';
import Bonmaintenancedashboard from '../components/pages/bon-main/Bonmaintenancedashboard';
import Bonmaintenancetachestable from '../components/pages/bon-main-tache/Bonmaintenancetachestable';

const AppRoutes = () => {
    return (
        <Routes>
            <Route path="/" element={<Dashboard />} />

            <Route path="/referentiels/compteurs" element={<CompteurList />} />
            <Route path="/reclamations" element={<Reclamations />} />
            <Route path="/bons-maintenance" element={<BonsMaintenance />} />
            <Route path="/tables-parametrage" element={<Referentielconsultation  />} />
            <Route path="/fiche-bon-maintenance" element={<Fichebonmaintenance />} />
            <Route path="/planning-bon-maintenance" element={<Planningbonmaintenance />} />
            <Route path="/reclamation-dashboard" element={<Reclamationdashboard />} />
            <Route path="/taches" element={<Maintenancetaches />} />
            <Route path="/bon-maintenance-dashboard" element={<Bonmaintenancedashboard />} />
            <Route path="/bon-maintenance-taches" element={<Bonmaintenancetachestable />} />

        </Routes>
    );
};

export default AppRoutes;