import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, useLocation } from 'react-router-dom';
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

// ═════════════════════════════════════════════════════════════
// Application : page de connexion seule, sinon mise en page + routes   (ancien fichier App.jsx)
// ═════════════════════════════════════════════════════════════
function App() {
  const location = useLocation();
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
