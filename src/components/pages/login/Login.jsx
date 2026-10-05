import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../constants/Authcontext';
import logo from '../../../assets/logo_SoftSys.png';
import dashboardBg from '../../../assets/dashboard-bg.jpg';
import './Login.css';

export default function Login() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const { login: doLogin } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!login.trim() || !password) {
      setError('Merci de renseigner le login et le mot de passe.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await doLogin(login.trim(), password);
      navigate('/', { replace: true });
    } catch (err) {
      const status = err.response?.status;
      if (status === 401) {
        setError('Login ou mot de passe incorrect.');
      } else if (status === 503) {
        setError("Service d'authentification indisponible. Réessaie plus tard.");
      } else {
        setError('Une erreur est survenue. Réessaie.');
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <img src={dashboardBg} className="login-bg-img" alt="" />
      <div className="login-card">
        <div className="login-card__header">
          <img src={logo} alt="SoftSys" className="login-card__logo" />
          <h1>GMAO</h1>
          <p>Connecte-toi pour accéder à l'application</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-form__group">
            <label htmlFor="login">Login</label>
            <input
              id="login"
              type="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              autoFocus
              autoComplete="username"
              disabled={loading}
            />
          </div>

          <div className="login-form__group">
            <label htmlFor="password">Mot de passe</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={loading}
            />
          </div>

          {error && <div className="login-form__error">{error}</div>}

          <button type="submit" className="login-form__submit" disabled={loading}>
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  );
}