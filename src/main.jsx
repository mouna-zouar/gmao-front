import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './constants/Authcontext.js'
import { LangueProvider } from './i18n';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <LangueProvider>
          <App />
        </LangueProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)