import { useLocation } from 'react-router-dom';
import Layout from './components/Layout/Layout'
import AppRoutes from './routes/routes';

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

export default App;