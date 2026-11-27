export function masquerEcranChargement() {
  const ecran = document.getElementById('ecran-chargement');
  if (!ecran || ecran.classList.contains('is-fini')) return;
  ecran.classList.add('is-fini');
  setTimeout(() => ecran.remove(), 400);
}
