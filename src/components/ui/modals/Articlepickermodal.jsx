import React, { useState, useEffect, useMemo } from 'react';
import Button from '../Button';
import articleService from '../../../services/articleService';
import './Modal.css';
import './ArticlePickerModal.css';

const ArticlePickerModal = ({ isOpen, onClose, onValidate, initialSelectedIds = [] }) => {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());

  useEffect(() => {
    if (!isOpen) return;
    setSelectedIds(new Set(initialSelectedIds));
    setSearchTerm('');

    const fetchArticles = async () => {
      setLoading(true);
      try {
        const page = await articleService.getAll(0, 300);
        setArticles(page.content ?? []);
      } catch (err) {
        console.error('Erreur chargement articles :', err);
        setArticles([]);
      } finally {
        setLoading(false);
      }
    };

    fetchArticles();
  }, [isOpen, initialSelectedIds]);

  const filteredArticles = useMemo(() => {
    if (!searchTerm) return articles;
    const term = searchTerm.toLowerCase();
    return articles.filter((a) =>
      a.designation?.toLowerCase().includes(term)
      || a.code?.toLowerCase().includes(term)
      || a.marque?.toLowerCase().includes(term)
      || a.modele?.toLowerCase().includes(term)
      || a.articleFamille?.nom?.toLowerCase().includes(term)
    );
  }, [articles, searchTerm]);

  const toggleArticle = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleValidate = () => {
    const selected = articles.filter((a) => selectedIds.has(a.id));
    onValidate(selected);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container article-picker-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Sélectionner des articles</h2>
          <button type="button" className="close-btn" onClick={onClose}>
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="modal-body">
          <div className="article-picker-search">
            <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0Z" />
            </svg>
            <input
              type="text"
              placeholder="Rechercher par désignation, code, marque, modèle..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />
          </div>

          <div className="article-picker-list">
            {loading ? (
              <p className="article-picker-empty">Chargement...</p>
            ) : filteredArticles.length === 0 ? (
              <p className="article-picker-empty">Aucun article ne correspond.</p>
            ) : (
              filteredArticles.map((a) => (
                <label key={a.id} className="article-picker-item">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(a.id)}
                    onChange={() => toggleArticle(a.id)}
                  />
                  <div className="article-picker-item-info">
                    <span className="article-picker-item-title">{a.designation || `Article #${a.id}`}</span>
                    <span className="article-picker-item-subtitle">
                      {[a.code, a.marque, a.modele, a.articleFamille?.nom].filter(Boolean).join(' · ') || '—'}
                    </span>
                  </div>
                </label>
              ))
            )}
          </div>

          <div className="article-picker-footer-count">
            {selectedIds.size} article{selectedIds.size > 1 ? 's' : ''} sélectionné{selectedIds.size > 1 ? 's' : ''}
          </div>
        </div>

        <div className="navigation-footer">
          <div className="nav-buttons">
            <Button type="button" variant="primary" onClick={handleValidate}>
              Valider la sélection
            </Button>
          </div>
          <Button type="button" variant="ghost" onClick={onClose}>
            Annuler
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ArticlePickerModal;