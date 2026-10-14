import api from './api';

const login = async (login, password) => {
  const { data } = await api.post('/auth/login', {
    login,
    password,
  });

  setSession(data);

  return getSession();
};

const setSession = (data) => {
  localStorage.setItem(
    'user',
    JSON.stringify({
      login: data.login,
      admin: data.admin,
      userId: data.userId ?? null,
      userNom: data.userNom ?? null,
      serviceId: data.serviceId ?? null,
      serviceNom: data.serviceNom ?? null,
      prestataireId: data.prestataireId ?? null,
      prestataireNom: data.prestataireNom ?? null,
      cliniqueId: data.cliniqueId ?? null,
      cliniqueNom: data.cliniqueNom ?? null,
    })
  );

  localStorage.setItem(
    'privileges',
    JSON.stringify(data.privileges || [])
  );

  localStorage.setItem('sessionId', data.sessionId);
};

const logout = () => {
  localStorage.removeItem('user');
  localStorage.removeItem('privileges');
  localStorage.removeItem('sessionId');
};

const getCurrentUser = () => {
  const raw = localStorage.getItem('user');

  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem('user');
    return null;
  }
};

const getPrivileges = () => {
  const raw = localStorage.getItem('privileges');

  if (!raw) return [];

  try {
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem('privileges');
    return [];
  }
};

const getSessionId = () => {
  return localStorage.getItem('sessionId');
};

const getSession = () => {
  const user = getCurrentUser();

  if (!user) return null;

  return {
    ...user,
    sessionId: getSessionId(),
    privileges: getPrivileges(),
  };
};

const getUserId = () => {
  return getCurrentUser()?.userId ?? null;
};

const getServiceId = () => {
  return getCurrentUser()?.serviceId ?? null;
};

const getServiceNom = () => {
  return getCurrentUser()?.serviceNom ?? null;
};

const getPrestataireId = () => {
  return getCurrentUser()?.prestataireId ?? null;
};

const getPrestataireNom = () => {
  return getCurrentUser()?.prestataireNom ?? null;
};

const getCliniqueId = () => {
  return getCurrentUser()?.cliniqueId ?? null;
};

const getCliniqueNom = () => {
  return getCurrentUser()?.cliniqueNom ?? null;
};

const getContexteMetier = () => {
  const user = getCurrentUser();

  return {
    userId: user?.userId ?? null,
    user: user?.login ?? null,
    serviceId: user?.serviceId ?? null,
    serviceNom: user?.serviceNom ?? null,
    prestataireId: user?.prestataireId ?? null,
    prestataireNom: user?.prestataireNom ?? null,
    cliniqueId: user?.cliniqueId ?? null,
    cliniqueNom: user?.cliniqueNom ?? null,
  };
};

const hasPrivilege = (code) => {
  return getPrivileges().includes(code);
};

const isAuthenticated = () => {
  return !!getSessionId();
};

const authService = {
  login,
  logout,
  setSession,
  getSession,
  getCurrentUser,
  getPrivileges,
  getSessionId,
  getUserId,
  getServiceId,
  getServiceNom,
  getPrestataireId,
  getPrestataireNom,
  getCliniqueId,
  getCliniqueNom,
  getContexteMetier,
  hasPrivilege,
  isAuthenticated,
};

export default authService;