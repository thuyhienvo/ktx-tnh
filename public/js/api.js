// ---- Lớp gọi API + lưu token ----
const Auth = {
  get token() { return localStorage.getItem('ktx_token'); },
  set token(v) { v ? localStorage.setItem('ktx_token', v) : localStorage.removeItem('ktx_token'); },
  get user() { try { return JSON.parse(localStorage.getItem('ktx_user')); } catch { return null; } },
  set user(v) { v ? localStorage.setItem('ktx_user', JSON.stringify(v)) : localStorage.removeItem('ktx_user'); },
  logout() { this.token = null; this.user = null; location.reload(); },
};

async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (Auth.token) headers.Authorization = 'Bearer ' + Auth.token;
  const res = await fetch('/api' + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (res.status === 401 && Auth.token) { Auth.logout(); throw new Error('Hết phiên đăng nhập'); }
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) throw new Error((data && data.error) || 'Lỗi kết nối máy chủ');
  return data;
}

const API = {
  login: (username, password) => api('/auth/login', { method: 'POST', body: { username, password } }),
  changePassword: (oldPassword, newPassword) => api('/auth/change-password', { method: 'POST', body: { oldPassword, newPassword } }),

  settings: () => api('/settings'),
  updateSettings: b => api('/settings', { method: 'PUT', body: b }),

  facilities: () => api('/facilities'),
  createFacility: b => api('/facilities', { method: 'POST', body: b }),
  updateFacility: (id, b) => api('/facilities/' + id, { method: 'PUT', body: b }),
  deleteFacility: id => api('/facilities/' + id, { method: 'DELETE' }),

  rooms: () => api('/rooms'),
  createRoom: b => api('/rooms', { method: 'POST', body: b }),
  updateRoom: (id, b) => api('/rooms/' + id, { method: 'PUT', body: b }),
  deleteRoom: id => api('/rooms/' + id, { method: 'DELETE' }),

  students: () => api('/students'),
  student: id => api('/students/' + id),
  createStudent: b => api('/students', { method: 'POST', body: b }),
  updateStudent: (id, b) => api('/students/' + id, { method: 'PUT', body: b }),
  deleteStudent: id => api('/students/' + id, { method: 'DELETE' }),
  checkIn: (id, b) => api('/students/' + id + '/checkin', { method: 'POST', body: b }),
  checkOut: (id, b) => api('/students/' + id + '/checkout', { method: 'POST', body: b }),
  transfer: (id, b) => api('/students/' + id + '/transfer', { method: 'POST', body: b }),
  setAccount: (id, b) => api('/students/' + id + '/account', { method: 'POST', body: b }),
  setDeposit: (id, b) => api('/students/' + id + '/deposit', { method: 'POST', body: b }),
  settleDeposit: (id, b) => api('/students/' + id + '/deposit-settle', { method: 'POST', body: b }),

  vehicles: () => api('/vehicles'),
  createVehicle: b => api('/vehicles', { method: 'POST', body: b }),
  updateVehicle: (id, b) => api('/vehicles/' + id, { method: 'PUT', body: b }),
  deleteVehicle: id => api('/vehicles/' + id, { method: 'DELETE' }),

  assets: () => api('/assets'),
  createAsset: b => api('/assets', { method: 'POST', body: b }),
  updateAsset: (id, b) => api('/assets/' + id, { method: 'PUT', body: b }),
  deleteAsset: id => api('/assets/' + id, { method: 'DELETE' }),

  logs: type => api('/logs' + (type ? '?type=' + type : '')),

  electric: month => api('/electric?month=' + month),
  saveElectric: b => api('/electric/bulk', { method: 'POST', body: b }),

  invoices: month => api('/invoices' + (month ? '?month=' + month : '')),
  invoiceMonths: () => api('/invoices/months'),
  generateInvoices: b => api('/invoices/generate', { method: 'POST', body: b }),
  generateOneInvoice: b => api('/invoices/generate-one', { method: 'POST', body: b }),
  createInvoice: b => api('/invoices', { method: 'POST', body: b }),
  updateInvoice: (id, b) => api('/invoices/' + id, { method: 'PUT', body: b }),
  setInvoiceStatus: (id, status) => api('/invoices/' + id + '/status', { method: 'POST', body: { status } }),
  recalcInvoice: id => api('/invoices/' + id + '/recalc', { method: 'POST' }),
  markPaid: month => api('/invoices/mark-paid', { method: 'POST', body: month ? { month } : {} }),
  deleteInvoice: id => api('/invoices/' + id, { method: 'DELETE' }),

  revenue: year => api('/reports/revenue' + (year ? '?year=' + year : '')),
  revenueYears: () => api('/reports/years'),

  // Vi phạm / nhắc nhở
  violations: () => api('/violations'),
  violationsByStudent: id => api('/violations/student/' + id),
  violationStats: year => api('/violations/stats' + (year ? '?year=' + year : '')),
  createViolation: b => api('/violations', { method: 'POST', body: b }),
  updateViolation: (id, b) => api('/violations/' + id, { method: 'PUT', body: b }),
  deleteViolation: id => api('/violations/' + id, { method: 'DELETE' }),
  notifyViolation: id => api('/violations/student/' + id + '/notify', { method: 'POST' }),
  violationMailStatus: () => api('/violations/mail-status'),
  violationTypes: () => api('/violations/types'),
  createVType: b => api('/violations/types', { method: 'POST', body: b }),
  updateVType: (id, b) => api('/violations/types/' + id, { method: 'PUT', body: b }),
  deleteVType: id => api('/violations/types/' + id, { method: 'DELETE' }),

  meProfile: () => api('/me/profile'),
  meInvoices: () => api('/me/invoices'),
  meLogs: () => api('/me/logs'),
  meViolations: () => api('/me/violations'),
  meDamage: () => api('/me/damage'),
  createMeDamage: b => api('/me/damage', { method: 'POST', body: b }),
  meCheckoutReq: () => api('/me/checkout-request'),
  createMeCheckoutReq: b => api('/me/checkout-request', { method: 'POST', body: b }),

  // Ảnh trang giới thiệu (upload trong Cài đặt)
  mediaList: () => api('/media'),
  uploadMedia: (key, data) => api('/media/' + key, { method: 'POST', body: { data } }),
  deleteMedia: key => api('/media/' + key, { method: 'DELETE' }),

  // Công khai (không cần đăng nhập)
  publicInfo: () => api('/public/info'),
  publicStats: () => api('/public/stats'),
  publicRooms: () => api('/public/available-rooms'),
  publicApply: b => api('/public/apply', { method: 'POST', body: b }),

  // Admin: đơn từ học viên
  applications: () => api('/applications'),
  approveApplication: (id, b) => api('/applications/' + id + '/approve', { method: 'POST', body: b }),
  rejectApplication: id => api('/applications/' + id + '/reject', { method: 'POST' }),
  deleteApplication: id => api('/applications/' + id, { method: 'DELETE' }),
  damageAll: () => api('/requests/damage'),
  updateDamage: (id, b) => api('/requests/damage/' + id, { method: 'PUT', body: b }),
  checkoutReqs: () => api('/requests/checkout'),
  confirmCheckoutReq: (id, b) => api('/requests/checkout/' + id + '/confirm', { method: 'POST', body: b }),
  rejectCheckoutReq: id => api('/requests/checkout/' + id + '/reject', { method: 'POST' }),
};
