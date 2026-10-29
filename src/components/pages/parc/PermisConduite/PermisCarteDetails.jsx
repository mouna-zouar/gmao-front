import { useEffect } from 'react';
import { CreditCard, Pencil, Printer, User, X } from 'lucide-react';
import { t, locale } from '../../../../i18n';
import './PermisConduite.css';

/*
 * Fiche du permis de conduire au format tunisien (carte en 3D), sortie de PermisConduite.jsx.
 * Échap ou un clic à côté ferme la fiche.
 */

const CATEGORIE_LABELS = {
  A1: 'A1', A: 'A', B: 'B', B_E: 'B+E', C: 'C', C_E: 'C+E', D: 'D', D_E: 'D+E', F: 'F',
};
const categorieLabel = (code) => CATEGORIE_LABELS[code] ?? code;
const formatDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(locale(), { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export default function PermisCarteDetails({ permis, personnel, expire, onFermer, onModifier, onImprimer }) {
  useEffect(() => {
    const touche = (e) => { if (e.key === 'Escape') onFermer(); };
    window.addEventListener('keydown', touche);
    return () => window.removeEventListener('keydown', touche);
  }, [onFermer]);

  return (
    <div
      className="pcd-overlay"
      onClick={onFermer}
      role="dialog"
      aria-modal="true"
      aria-label={t("Détails du permis de conduire")}
    >
      <div
        className="pcd-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Barre d'actions de la popup */}
        <div className="pcd-modal-bar">
          <div className="pcd-modal-bar-left">
            <CreditCard size={16} strokeWidth={2.4} />
            <span>{t("Permis de conduire")}</span>
          </div>
          <div className="pcd-modal-bar-right">
            <button
              type="button"
              className="pcd-modal-btn"
              onClick={onModifier}
              title={t("Modifier ce permis")}
            >
              <Pencil size={14} strokeWidth={2.4} />
              {t("Modifier")}
            </button>
            <button
              type="button"
              className="pcd-modal-btn"
              onClick={onImprimer}
              title={t("Imprimer")}
            >
              <Printer size={14} strokeWidth={2.4} />
              {t("Imprimer")}
            </button>
            <button
              type="button"
              className="pcd-modal-close"
              onClick={onFermer}
              aria-label={t("Fermer")}
            >
              <X size={18} strokeWidth={2.6} />
            </button>
          </div>
        </div>

        {/* Scène 3D */}
        <div className="pcd-permis-stage">
          <div className="pcd-permis-3d">
            <div className="pcd-permis">
              <div className="pcd-permis-face">

                {/* ─── EN-TÊTE ─── */}
                <div className="pcd-permis-header">
                  <div className="pcd-header-fr">
                    <div className="pcd-country-fr">REPUBLIQUE TUNISIENNE</div>
                    <div className="pcd-title-fr">PERMIS DE CONDUIRE</div>
                  </div>

                  <div className="pcd-flag">
                    <div className="pcd-flag-circle">
                      <span className="pcd-flag-crescent">☪</span>
                      <span className="pcd-flag-star">★</span>
                    </div>
                  </div>

                  <div className="pcd-header-ar">
                    <div className="pcd-country-ar">الجمهورية التونسية</div>
                    <div className="pcd-title-ar">رخصة سياقة</div>
                  </div>
                </div>

                {/* ─── CORPS ─── */}
                <div className="pcd-permis-body">

                  {/* Photo */}
                  <div className="pcd-photo-col">
                    <div className="pcd-photo">
                      {personnel ? (
                        <div className="pcd-photo-initials">
                          {(personnel.nom?.[0] || '').toUpperCase()}
                          {(personnel.prenom?.[0] || '').toUpperCase()}
                        </div>
                      ) : (
                        <User size={40} strokeWidth={1.5} />
                      )}
                    </div>
                    <div className="pcd-photo-footer">
                      <div className="pcd-photo-badge">
                        <span className="pcd-photo-badge-icon">🅱</span>
                      </div>
                    </div>
                  </div>

                  {/* Lignes */}
                  <div className="pcd-lines">

                    <div className="pcd-line">
                      <span className="pcd-line-num">1.</span>
                      <span className="pcd-line-fr">
                        <strong>{personnel?.nom || '—'}</strong>
                        {personnel?.prenom ? ` ${personnel.prenom}` : ''}
                      </span>
                      <span className="pcd-line-ar">بن فلان</span>
                    </div>

                    <div className="pcd-line">
                      <span className="pcd-line-num">2.</span>
                      <span className="pcd-line-fr">
                        <strong>{personnel?.prenom || '—'}</strong>
                      </span>
                      <span className="pcd-line-ar">فلان</span>
                    </div>

                    <div className="pcd-line">
                      <span className="pcd-line-num">3.</span>
                      <span className="pcd-line-fr">
                        <strong>{personnel?.lieuNaissance || permis.lieuDelivrance || '—'}</strong>
                        <span className="pcd-line-date">
                          {personnel?.dateNaissance ? formatDate(personnel.dateNaissance) : '—'}
                        </span>
                      </span>
                      <span className="pcd-line-ar">البطان</span>
                    </div>

                    <div className="pcd-line">
                      <span className="pcd-line-num">4a.</span>
                      <span className="pcd-line-fr">
                        {formatDate(permis.dateDelivrance)}
                      </span>
                      <span className="pcd-line-ar">تاريخ</span>
                    </div>

                    <div className="pcd-line">
                      <span className="pcd-line-num">4b.</span>
                      <span className={`pcd-line-fr ${expire ? 'pcd-expired' : ''}`}>
                        {permis.dateExpiration ? formatDate(permis.dateExpiration) : '—'}
                      </span>
                      <span className="pcd-line-ar">ينتهي</span>
                    </div>

                    <div className="pcd-line">
                      <span className="pcd-line-num">4c.</span>
                      <span className="pcd-line-fr">
                        {permis.lieuDelivrance || 'A.T.T.T.'}
                      </span>
                      <span className="pcd-line-ar">السلطة</span>
                    </div>

                    <div className="pcd-line">
                      <span className="pcd-line-num">5.</span>
                      <span className="pcd-line-fr pcd-mono">
                        <strong>{permis.numero || '—'}</strong>
                      </span>
                      <span className="pcd-line-ar">رقم</span>
                    </div>

                    <div className="pcd-line">
                      <span className="pcd-line-num">7.</span>
                      <span className="pcd-line-fr pcd-mono">
                        {permis.reference || `${permis.id} / 270${String(permis.id).padStart(3, '0')}`}
                      </span>
                      <span className="pcd-line-ar">مرجع</span>
                    </div>

                    <div className="pcd-line pcd-line-signature">
                      <span className="pcd-line-num" />
                      <span className="pcd-signature">
                        <svg viewBox="0 0 200 40" preserveAspectRatio="none">
                          <path
                            d="M10,28 C25,10 40,35 55,20 C70,5 85,32 100,18 C115,4 130,30 145,22 C160,14 175,28 190,20"
                            fill="none"
                            stroke="#831843"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                          />
                        </svg>
                      </span>
                    </div>

                    <div className="pcd-line pcd-line-categories">
                      <span className="pcd-line-num">9.</span>
                      <span className="pcd-line-cat-label">A A B B E C C E D D E G H</span>
                      <span className="pcd-line-cat-ar">أ ب ج د هـ و ز ح ط ي</span>
                    </div>

                    <div className="pcd-categories-bar">
                      {['A', 'A1', 'B', 'B_E', 'C', 'C_E', 'D', 'D_E', 'F'].map((code) => {
                        const active = (permis.categories ?? []).includes(code);
                        return (
                          <div
                            key={code}
                            className={`pcd-cat-cell ${active ? 'is-active' : ''}`}
                            title={categorieLabel(code)}
                          >
                            {code.replace('_E', 'E')}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Filigrane */}
                <div className="pcd-watermark" aria-hidden="true">
                  <div className="pcd-watermark-circle" />
                  <div className="pcd-watermark-shield">🛡</div>
                </div>

                {/* Reflet */}
                <div className="pcd-permis-shine" aria-hidden="true" />
              </div>
            </div>

            <div className="pcd-permis-shadow" aria-hidden="true" />
          </div>
        </div>
      </div>
    </div>
  );
}
