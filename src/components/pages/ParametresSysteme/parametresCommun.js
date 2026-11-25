import { t } from '../../../i18n';

export const messageErreur = (e) => {
  const d = e?.response?.data;
  if (typeof d === 'string' && d.trim()) return d;
  return d?.message || d?.error || t('Enregistrement impossible.');
};
