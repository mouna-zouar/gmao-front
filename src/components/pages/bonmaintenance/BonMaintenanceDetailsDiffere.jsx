import { lazy, Suspense } from 'react';
import ChargementPage from '../../../routes/ChargementPage';

const importer = () => import('./Bonmaintenancedetails');
const BonMaintenanceDetails = lazy(importer);

let precharge = false;
/** Télécharge la fiche d'un bon en arrière-plan, pour qu'elle s'ouvre sans attente au clic. */
function prechargerDetailsBon() {
  if (precharge) return;
  precharge = true;
  importer().catch(() => { precharge = false; });
}

if (typeof window !== 'undefined') {
  const auRepos = window.requestIdleCallback || ((f) => setTimeout(f, 3000));
  auRepos(prechargerDetailsBon, { timeout: 10000 });
}

export default function BonMaintenanceDetailsDiffere(props) {
  return (
    <Suspense fallback={<ChargementPage />}>
      <BonMaintenanceDetails {...props} />
    </Suspense>
  );
}
