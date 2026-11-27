import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { masquerEcranChargement } from './routes/ecranChargement';
import { Provider } from 'react-redux'
import { store } from './store'
import './index.css'
import Layout from './components/Layout/Layout';
import AppRoutes from './routes/routes';
import { AuthProvider } from './constants/Authcontext.js'
import { LangueProvider } from './i18n';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Provider store={store}>
    <BrowserRouter>
      <AuthProvider>
        <LangueProvider>
          <App />
        </LangueProvider>
      </AuthProvider>
    </BrowserRouter>
    </Provider>
  </StrictMode>,
)

function App() {
  const location = useLocation();
  useEffect(masquerEcranChargement, []);
  const isLoginPage = location.pathname === '/login';

  if (isLoginPage) {
    return <AppRoutes />;
  }

  return (
    <Layout>
      <AppRoutes />
    </Layout>
  );
}
