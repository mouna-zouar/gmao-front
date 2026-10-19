import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { NAV_PAGES, NAV_SECTIONS, trouverPage } from '../../constants/navigation';
import notificationService from '../../services/notificationService';
import { useAuth } from '../../constants/Authcontext';
import { t, locale, SelecteurLangue } from '../../i18n';
import { History, X } from 'lucide-react';
import './Layout.css';
import './MenuMetier.css';
import '../ui/BadgeStatut/statuts-harmonises.css';

const NB_RECENTS = 5;
// Minuscules sans accents, pour chercher « reclamation » comme « Réclamation »
const normaliser = (texte) => String(texte || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const cleRecents = (user) => `gmao-pages-recentes-${user?.id ?? user?.userId ?? user?.login ?? 'anonyme'}`;
function lireRecents(cle) {
  try { const v = JSON.parse(localStorage.getItem(cle) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userDropOpen, setUserDropOpen] = useState(false);
  const [openSubmenu, setOpenSubmenu] = useState(null);
  const [activePopup, setActivePopup] = useState(null);
  const [notifDropOpen, setNotifDropOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notifCount, setNotifCount] = useState(0);
  const [notifLoading, setNotifLoading] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const currentPath = location.pathname;

  // Page du menu ouverte (tient compte des paramètres comme ?vue=…)
  const pageActive = trouverPage(currentPath, location.search);
  const activeNavItem = pageActive?.parent;
  const activeChild = pageActive && !pageActive.racine ? pageActive : null;

  /* ── Pages récentes (propres à l'utilisateur, gardées dans ce navigateur) ── */
  const cle = cleRecents(user);
  const [recents, setRecents] = useState(() => ({ cle, liste: lireRecents(cle) }));
  let listeRecents = recents.cle === cle ? recents.liste : lireRecents(cle);
  if (pageActive && pageActive.path !== '/' && (recents.cle !== cle || listeRecents[0] !== pageActive.path)) {
    // Mise à jour pendant le rendu (pas d'effet) : la page ouverte passe en tête
    listeRecents = [pageActive.path, ...listeRecents.filter((p) => p !== pageActive.path)].slice(0, NB_RECENTS);
    setRecents({ cle, liste: listeRecents });
  }
  useEffect(() => {
    try { localStorage.setItem(recents.cle, JSON.stringify(recents.liste)); } catch { /* stockage indisponible */ }
  }, [recents]);
  const pagesRecentes = listeRecents
    .map((p) => NAV_PAGES.find((page) => page.path === p))
    .filter((page) => page && page !== pageActive)
    .slice(0, 4);

  /* ── Fenêtre d'un groupe (menu réduit) : placée à côté de son icône, toujours entière à l'écran ── */
  const popupRef = useRef(null);
  useLayoutEffect(() => {
    const el = popupRef.current;
    if (!el) return undefined;
    const placer = () => {
      const bouton = el.parentElement?.querySelector('.nav-item');
      if (!bouton) return;
      const marge = 12;
      const b = bouton.getBoundingClientRect();
      const aDroite = b.left > window.innerWidth / 2; // menu collé au bord droit : fenêtre à gauche de l'icône
      el.style.position = 'fixed';
      el.style.maxHeight = `${window.innerHeight - 2 * marge}px`;
      el.style.overflowY = 'auto';
      if (aDroite) { el.style.left = 'auto'; el.style.right = `${window.innerWidth - b.left + 8}px`; }
      else { el.style.right = 'auto'; el.style.left = `${b.right + 8}px`; }
      const h = el.offsetHeight;
      // En face de l'icône, remontée si elle dépasse le bas de l'écran
      el.style.top = `${Math.max(marge, Math.min(b.top, window.innerHeight - marge - h))}px`;
    };
    placer();
    const fermer = () => setActivePopup(null);
    const nav = el.closest('.sidebar__nav');
    window.addEventListener('resize', placer);
    nav?.addEventListener('scroll', fermer, { passive: true });
    return () => {
      window.removeEventListener('resize', placer);
      nav?.removeEventListener('scroll', fermer);
    };
  }, [activePopup, sidebarOpen]);

  /* ── Recherche dans le menu ── */
  const [recherche, setRecherche] = useState('');
  const champRecherche = useRef(null);
  const resultats = useMemo(() => {
    const mots = normaliser(recherche).split(/\s+/).filter(Boolean);
    if (mots.length === 0) return [];
    return NAV_PAGES.filter((page) => {
      const texte = normaliser([t(page.label), page.label, t(page.parent.label), page.parent.label, page.motsCles].join(' '));
      return mots.every((m) => texte.includes(m));
    });
  }, [recherche]);
  const ouvrirPage = (page) => {
    setRecherche('');
    setActivePopup(null);
    navigate(page.path);
  };
  // Ctrl+K (ou ⌘K) : ouvrir le menu et chercher une page
  useEffect(() => {
    const surTouche = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSidebarOpen(true);
        setTimeout(() => champRecherche.current?.focus(), 50);
      }
    };
    window.addEventListener('keydown', surTouche);
    return () => window.removeEventListener('keydown', surTouche);
  }, []);

  useEffect(() => {
    if (activeNavItem && sidebarOpen) {
      setOpenSubmenu(activeNavItem.id);
    }
  }, [activeNavItem, sidebarOpen]);

  const loadCount = () => {
    notificationService.countNonLues()
      .then(setNotifCount)
      .catch((err) => console.error('Erreur chargement compteur notifications :', err));
  };

  useEffect(() => {
    loadCount();
    const interval = setInterval(loadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadNotifications = () => {
    setNotifLoading(true);
    notificationService.getAll(0, 20)
      .then((page) => setNotifications(page.content ?? []))
      .catch((err) => console.error('Erreur chargement notifications :', err))
      .finally(() => setNotifLoading(false));
  };

  const toggleNotifDrop = () => {
    const opening = !notifDropOpen;
    setNotifDropOpen(opening);
    if (opening) loadNotifications();
  };

  const handleNotifClick = async (notif) => {
    if (!notif.lue) {
      try {
        await notificationService.marquerLue(notif.id);
        setNotifications((prev) => prev.filter((n) => n.id !== notif.id));
        setNotifCount((prev) => Math.max(0, prev - 1));
      } catch (err) {
        console.error('Erreur marquage notification lue :', err);
      }
    }
    setNotifDropOpen(false);
    if (notif.lien) navigate(notif.lien);
  };

  const handleMarquerToutesLues = async (e) => {
    e.stopPropagation();
    try {
      await notificationService.marquerToutesLues();
      setNotifications([]);
      setNotifCount(0);
    } catch (err) {
      console.error('Erreur marquage toutes notifications lues :', err);
    }
  };

  function formatNotifDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const diffMs = Date.now() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return t("à l'instant");
    if (diffMin < 60) return t('il y a {n} min', { n: diffMin });
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return t('il y a {n} h', { n: diffH });
    return d.toLocaleDateString(locale(), { day: '2-digit', month: '2-digit' });
  }

  return (
    <div className="app-shell">

      {/* ── SIDEBAR ── */}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar--open' : 'sidebar--closed'}`}>
        {/* Logo / Toggle */}
        <div className="sidebar__header">
          {sidebarOpen ? (
            <>
              <Link to="/" onClick={() => { setActivePopup(null); setOpenSubmenu(null); }} className="sidebar__logo-link">
                <span style={{ fontWeight: 800, fontSize: '18px', color: '#0f172a' }}>GMAO</span>
              </Link>
              <button className="sidebar__close-btn" onClick={() => setSidebarOpen(false)} title={t('Réduire le menu')} aria-label={t('Réduire le menu')}>
                <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            </>
          ) : (
            <button className="sidebar__menu-btn" onClick={() => setSidebarOpen(true)} title={t('Ouvrir le menu')} aria-label={t('Ouvrir le menu')}>
              <svg fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zm0 10.5a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </div>

        {/* Search */}
        {sidebarOpen && (
          <div className="sidebar__search">
            <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0Z" />
            </svg>
            <input
              ref={champRecherche}
              type="search"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && resultats[0]) ouvrirPage(resultats[0]);
                if (e.key === 'Escape') setRecherche('');
              }}
              placeholder={t('Chercher une page…')}
              aria-label={t('Chercher une page')}
              title={t('Raccourci : Ctrl+K')}
            />
            {recherche && (
              <button type="button" className="menu-recherche__effacer" onClick={() => setRecherche('')} aria-label={t('Effacer la recherche')}>
                <X size={14} aria-hidden="true" />
              </button>
            )}
          </div>
        )}

        {/* Nav */}
        <nav className="sidebar__nav">
          {sidebarOpen && recherche.trim() ? (
            <div className="menu-recherche">
              <span className="menu-groupe__titre">
                {resultats.length === 0 ? t('Aucune page trouvée') : t('Pages trouvées : {n}', { n: resultats.length })}
              </span>
              {resultats.map((page) => (
                <button key={page.path} type="button" className={`menu-lien nav-theme--${page.parent.id}`} onClick={() => ouvrirPage(page)}>
                  <span className="menu-lien__icone">{page.icon}</span>
                  <span className="menu-lien__textes">
                    <span className="menu-lien__titre">{t(page.label)}</span>
                    {!page.racine && <span className="menu-lien__groupe">{t(page.parent.label)}</span>}
                  </span>
                </button>
              ))}
            </div>
          ) : (<>
          {sidebarOpen && pagesRecentes.length > 0 && (
            <div className="menu-recents">
              <span className="menu-groupe__titre"><History size={13} aria-hidden="true" /> {t('Pages récentes')}</span>
              {pagesRecentes.map((page) => (
                <Link key={page.path} to={page.path} className={`menu-lien menu-lien--compact nav-theme--${page.parent.id}`}>
                  <span className="menu-lien__icone">{page.icon}</span>
                  <span className="menu-lien__textes">
                    <span className="menu-lien__titre">{t(page.label)}</span>
                    {!page.racine && <span className="menu-lien__groupe">{t(page.parent.label)}</span>}
                  </span>
                </Link>
              ))}
            </div>
          )}
          {NAV_SECTIONS.map((section) => (
          <div key={section.id} className={`sidebar__section sidebar__section--${section.id}`}>
          {sidebarOpen ? (
            <span className={`sidebar__section-label sidebar__section-label--${section.id}`}>{t(section.label)}</span>
          ) : (
            <div className="sidebar__section-mini"><span>{t(section.label)}</span></div>
          )}
          {section.items.map((item) => (
            <div key={item.id} className="nav-item-wrap">
              <button
                className={`nav-item nav-item--${item.id} ${activeNavItem?.id === item.id ? 'nav-item--active' : ''} ${!sidebarOpen ? 'nav-item--icon-only' : ''}`}
                onClick={() => {
                  if (!sidebarOpen) {
                    setActivePopup(p => p === item.id ? null : item.id);
                  } else {
                    if (item.children) setOpenSubmenu(p => p === item.id ? null : item.id);
                  }
                }}
              >
                <span className="nav-item__icon">{item.icon}</span>
                {sidebarOpen && <span className="nav-item__label">{t(item.label)}</span>}
                {sidebarOpen && item.badge && <span className="nav-item__badge">{item.badge}</span>}
                {sidebarOpen && item.children && (
                  <svg className={`nav-item__chevron--${item.id} ${openSubmenu === item.id ? 'nav-item__chevron--open' : ''}`} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                  </svg>
                )}
                {item.badge && !sidebarOpen && <span className="nav-item__badge-dot" />}
              </button>

              {/* Popup (collapsed) — scroll si > 6 enfants */}
              {!sidebarOpen && activePopup === item.id && (
                <div className="nav-popup" ref={popupRef}>
                  <span className="nav-popup__title">{t(item.label)}</span>
                  {item.children ? (
                    <div
                      className={`nav-popup__grid ${item.children.length > 3 ? 'nav-popup__grid--many' : 'nav-popup__grid--few'}`}
                      style={{
                        maxHeight: item.children.length > 6 ? '320px' : 'none',
                        overflowY: item.children.length > 6 ? 'auto' : 'visible'
                      }}
                    >
                      {item.children.map(child => (
                        <Link key={child.path} to={child.path || '#'} className="nav-popup__card"
                          onClick={() => setActivePopup(null)}>
                          <div className={`nav-popup__card-icon nav-popup__card-icon--${item.id}`}>
                            {child.icon}
                          </div>
                          <span className="nav-popup__card-label">{t(child.label)}</span>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="nav-popup__simple">
                      <Link to={item.path || '#'} className={`nav-popup__simple-link nav-popup__simple-link--${item.id}`}
                        onClick={() => setActivePopup(null)}>
                        <div className={`nav-popup__card-icon nav-popup__card-icon--${item.id}`}>
                          {item.icon}
                        </div>
                        <span>{t(item.label)}</span>
                      </Link>
                    </div>
                  )}
                </div>
              )}

              {/* Submenu (expanded) — 6 items max visibles, puis ascenseur */}
              {sidebarOpen && item.children && (
                <div
                  className={`submenu ${openSubmenu === item.id ? 'submenu--open' : ''}`}
                  style={{
                    maxHeight: openSubmenu === item.id
                      ? (item.children.length > 8 ? '320px' : `${item.children.length * 40}px`)
                      : '0'
                  }}
                >
                  {item.children.map(child => (
                    <Link key={child.path} to={child.path || '#'}
                      aria-current={activeChild === child ? 'page' : undefined}
                      className={`submenu__link--${item.id} ${activeChild === child ? 'submenu__link--active' : ''}`}>
                      <span className={`submenu__link-icon submenu__link-icon--${item.id}`}>
                        {child.icon}
                      </span>
                      {t(child.label)}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
          </div>
          ))}
          </>)}
        </nav>

        {/* Logout */}
        <div className="sidebar__footer">
          <button className={`nav-item nav-item--logout ${!sidebarOpen ? 'nav-item--icon-only' : ''}`} onClick={handleLogout}>
            <span className="nav-item__icon">
              <svg className="nav-icon-svg" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 12H4m12 0-4 4m4-4-4-4m3-4h2a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3h-2" />
              </svg>
            </span>
            {sidebarOpen && <span className="nav-item__label">{t('Déconnexion')}</span>}
          </button>
        </div>
      </aside>

      <header className={`navbar ${sidebarOpen ? 'navbar--shifted' : ''}`}>
        <div className="navbar__left">
          <button className="navbar__mobile-toggle" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label={t('Menu')}>
            <svg fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zm0 10.5a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10z" clipRule="evenodd" />
            </svg>
          </button>
          {!sidebarOpen && (
            <Link to="/" onClick={() => { setActivePopup(null); setOpenSubmenu(null); }} className="navbar__logo-link">
              <img src="../src/assets/logo_SoftSys.png" className="navbar__logo-img" alt="SoftSys" />
            </Link>
          )}
          <div className="navbar__breadcrumb">
            <Link to="/" className="navbar__breadcrumb-root" onClick={() => { setActivePopup(null); setOpenSubmenu(null); }}>
              {t('Accueil')}
            </Link>

            {activeNavItem && currentPath !== '/' && (
              <>
                <svg className="rtl-miroir" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
                </svg>
                <span className="navbar__breadcrumb-parent">
                  {t(activeNavItem.label)}
                </span>

                {activeChild && (
                  <>
                    <svg className="rtl-miroir" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
                    </svg>
                    <span className="navbar__breadcrumb-current">{t(activeChild.label)}</span>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        <div className="navbar__right">

          <div className="navbar__notif-container" style={{ position: 'relative' }}>
            <button className="navbar__icon-btn navbar__icon-btn--notif" onClick={toggleNotifDrop} title={t('Notifications')} aria-label={t('Notifications')}>
              <svg fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 5.365V3m0 2.365a5.338 5.338 0 0 1 5.133 5.368v1.8c0 2.386 1.867 2.982 1.867 4.175 0 .593 0 1.292-.538 1.292H5.538C5 18 5 17.301 5 16.708c0-1.193 1.867-1.789 1.867-4.175v-1.8A5.338 5.338 0 0 1 12 5.365ZM8.733 18c.094.852.306 1.54.944 2.112a3.48 3.48 0 0 0 4.646 0c.638-.572.85-1.26.944-2.112H8.733Z" />
              </svg>
              {notifCount > 0 && (
                <span className="navbar__notif-badge">{notifCount > 99 ? '99+' : notifCount}</span>
              )}
            </button>

            {notifDropOpen && (
              <div className="user-dropdown notif-dropdown" style={{ insetInlineEnd: 0, width: '350px' }}>
                <div className="user-dropdown__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p className="user-dropdown__name">{t('Notifications')}</p>
                  {notifCount > 0 && (
                    <button className="notif-dropdown__mark-all" onClick={handleMarquerToutesLues}>
                      {t('Tout marquer lu')}
                    </button>
                  )}
                </div>
                <div className="user-dropdown__menu" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  {notifLoading ? (
                    <div style={{ padding: '16px', textAlign: 'center', color: '#666' }}>{t('Chargement...')}</div>
                  ) : notifications.length === 0 ? (
                    <div style={{ padding: '16px', textAlign: 'center', color: '#666' }}>{t('Aucune notification')}</div>
                  ) : (
                    notifications.map((notif) => (
                      <button
                        key={notif.id}
                        className={`notif-dropdown__item ${!notif.lue ? 'notif-dropdown__item--non-lue' : ''}`}
                        onClick={() => handleNotifClick(notif)}
                      >
                        <span className="notif-dropdown__icon">{notif.icone || '🔔'}</span>
                        <span className="notif-dropdown__body">
                          <span className="notif-dropdown__message">{notif.message}</span>
                          <span className="notif-dropdown__date">{formatNotifDate(notif.dateCreation)}</span>
                        </span>
                        {!notif.lue && <span className="notif-dropdown__dot" />}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="navbar__divider" />

          <div className="navbar__user">
            <button className="user-btn" onClick={() => setUserDropOpen(!userDropOpen)}>
              <div className="user-btn__info">
                <span className="user-btn__name">{user?.login || t('Utilisateur')}</span>
                <span className="user-btn__role">{user?.admin ? t('Administrateur') : t('Utilisateur')}</span>
              </div>
              <svg className={`user-btn__chevron ${userDropOpen ? 'user-btn__chevron--open' : ''}`} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
              </svg>
            </button>

            {userDropOpen && (
              <div className="user-dropdown">
                <div className="user-dropdown__header">
                  <p className="user-dropdown__name">{user?.login || t('Utilisateur')}</p>
                  <p className="user-dropdown__email">{user?.admin ? t('Administrateur') : t('Utilisateur')}</p>
                </div>
                {/* Choix de la langue, accessible depuis toutes les pages */}
                <div className="user-dropdown__langue">
                  <span className="user-dropdown__langue-titre">{t('Langue')}</span>
                  <SelecteurLangue className="layout-langue" />
                </div>
                <div className="user-dropdown__menu">
                  <Link to="/" className="user-dropdown__link" onClick={() => setUserDropOpen(false)}>{t('Dashboard')}</Link>
                  <Link to="/parametres-systeme" className="user-dropdown__link" onClick={() => setUserDropOpen(false)}>{t('Paramètres')}</Link>
                  <div className="user-dropdown__separator" />
                  <a href="#" className="user-dropdown__link user-dropdown__link--danger" onClick={(e) => { e.preventDefault(); handleLogout(); }}>{t('Déconnexion')}</a>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className={`main-content ${sidebarOpen ? 'main-content--shifted' : ''}`} onClick={() => setActivePopup(null)}>
        {children}
      </main>

      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
    </div>
  );
}