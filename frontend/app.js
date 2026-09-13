let auth = JSON.parse(sessionStorage.getItem('lintech.auth') || 'null');
let me = auth?.user || null;
let currentView = 'overview';

const loginShell = document.querySelector('#login-shell');
const appShell = document.querySelector('#app-shell');
const content = document.querySelector('#content');
const notice = document.querySelector('#notice');

async function api(path, options = {}) {
  const headers = { 'content-type': 'application/json', ...(options.headers || {}) };
  if (auth) {
    headers.authorization = `Bearer ${auth.accessToken}`;
    if (options.method && options.method !== 'GET') headers['x-csrf-token'] = auth.csrfToken;
  }
  const response = await fetch(`/api${path}`, { ...options, headers });
  if (response.status === 401 && path !== '/auth/login') signOut(false);
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try { message = (await response.json()).error || message; } catch {}
    throw new Error(message);
  }
  return response.status === 204 ? null : response.json();
}

function node(tag, properties = {}, ...children) {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(properties)) {
    if (key === 'class') element.className = value;
    else if (key.startsWith('on')) element.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value !== undefined && value !== null) element.setAttribute(key, value);
  }
  for (const child of children.flat()) element.append(child instanceof Node ? child : document.createTextNode(String(child)));
  return element;
}

function showNotice(message, bad = false) {
  notice.textContent = message; notice.className = `notice${bad ? ' bad' : ''}`;
  clearTimeout(showNotice.timer); showNotice.timer = setTimeout(() => notice.classList.add('hidden'), 5000);
}

function roleLabel(role) { return role.replaceAll('_', ' '); }
function date(value) { return value ? new Date(value).toLocaleString() : '—'; }
function badge(text, good = true) { return node('span', { class: `badge ${good ? 'ok' : 'bad'}` }, text); }
function empty(text) { return node('div', { class: 'empty' }, text); }
function panel(title, body) { return node('section', { class: 'panel' }, node('div', { class: 'section-head' }, node('h2', {}, title)), body); }
function field(label, name, type = 'text', value = '', properties = {}) { return node('label', {}, label, node('input', { name, type, value, ...properties })); }
function selectField(label, name, choices) { const select = node('select', { name }); for (const choice of choices) select.append(node('option', { value: choice.value }, choice.label)); return node('label', {}, label, select); }

const navigation = [
  ['overview', '⌂', 'Overview', ['super_admin', 'reseller', 'customer']],
  ['users', '◎', 'Users', ['super_admin', 'reseller']],
  ['packages', '◇', 'Packages', ['super_admin']],
  ['domains', '◉', 'Domains', ['super_admin', 'reseller', 'customer']],
  ['jobs', '↻', 'Jobs', ['super_admin', 'reseller', 'customer']],
  ['notifications', '◌', 'Notifications', ['super_admin', 'reseller', 'customer']],
  ['audit', '≡', 'Audit log', ['super_admin', 'reseller', 'customer']],
  ['account', '⚙', 'Account', ['super_admin', 'reseller', 'customer']]
];

function buildNavigation() {
  const nav = document.querySelector('#navigation'); nav.replaceChildren();
  for (const [id, icon, label, roles] of navigation.filter(item => item[3].includes(me.role))) {
    nav.append(node('button', { class: `nav-button${currentView === id ? ' active' : ''}`, type: 'button', onclick: () => openView(id) }, node('span', { class: 'nav-icon' }, icon), label));
  }
}

async function openView(id) {
  currentView = id; buildNavigation(); content.replaceChildren(empty('Loading…'));
  const item = navigation.find(entry => entry[0] === id);
  document.querySelector('#view-title').textContent = item?.[2] || 'Control panel';
  try { await views[id](); } catch (error) { content.replaceChildren(empty(error.message)); showNotice(error.message, true); }
}

async function overview() {
  const dashboard = await api('/dashboard');
  const cards = [
    ['Users', dashboard.counts.users], ['Domains', dashboard.counts.domains], ['Jobs', dashboard.counts.jobs],
    ['Unread alerts', dashboard.counts.unreadNotifications]
  ];
  if (me.role === 'super_admin') cards[0] = ['Hosting packages', dashboard.counts.packages];
  const stats = node('div', { class: 'stat-grid' }, cards.map(([label, value]) => node('article', { class: 'stat' }, node('span', {}, label), node('strong', {}, value ?? 0))));
  const activities = dashboard.recentActivity.length ? node('div', { class: 'stack' }, dashboard.recentActivity.map(item => node('div', { class: 'activity' }, node('strong', {}, item.action), node('span', {}, `${item.result} · ${date(item.at)}`)))) : empty('No activity recorded yet.');
  const jobs = dashboard.recentJobs.length ? node('div', { class: 'stack' }, dashboard.recentJobs.map(item => node('div', { class: 'activity' }, node('strong', {}, item.type), node('span', {}, `${item.status} · ${item.progress}% · ${date(item.createdAt)}`)))) : empty('No jobs submitted yet.');
  const warning = me.mustChangePassword ? node('div', { class: 'warning-banner' }, 'This account is using a temporary password. Change it from Account before continuing.') : null;
  content.replaceChildren(...(warning ? [warning] : []), stats, node('div', { class: 'two-column' }, panel('Recent activity', activities), panel('Recent jobs', jobs)));
}

async function users() {
  const [users, packages] = await Promise.all([api('/users'), api('/packages')]);
  const form = node('form', { class: 'form-grid' },
    field('Username', 'username', 'text', '', { required: true, pattern: '[a-z][a-z0-9_-]{2,31}' }), field('Email', 'email', 'email', '', { required: true }),
    field('Temporary password', 'password', 'password', '', { required: true, minlength: 14 }),
    selectField('Role', 'role', me.role === 'super_admin' ? [{ value: 'customer', label: 'Customer' }, { value: 'reseller', label: 'Reseller' }] : [{ value: 'customer', label: 'Customer' }]),
    selectField('Hosting package', 'packageId', [{ value: '', label: 'No package' }, ...packages.map(item => ({ value: item.id, label: item.name }))]),
    node('button', { type: 'submit' }, 'Create account')
  );
  form.addEventListener('submit', async event => {
    event.preventDefault(); const values = Object.fromEntries(new FormData(form));
    try { await api('/users', { method: 'POST', body: JSON.stringify(values) }); form.reset(); showNotice('Account created.'); await usersView(); } catch (error) { showNotice(error.message, true); }
  });
  const rows = users.map(user => {
    const packageControl = user.role === 'customer' ? node('select', { 'aria-label': `Package for ${user.username}`, onchange: async event => { try { await api(`/users/${user.id}`, { method: 'PATCH', body: JSON.stringify({ packageId: event.target.value }) }); showNotice('Hosting package updated.'); } catch (error) { showNotice(error.message, true); await usersView(); } } },
      node('option', { value: '', selected: !user.packageId ? true : null }, 'No package'),
      packages.map(item => node('option', { value: item.id, selected: item.id === user.packageId ? true : null }, item.name))) : node('span', { class: 'muted' }, '—');
    return node('tr', {}, node('td', {}, node('strong', {}, user.username), node('div', { class: 'muted' }, user.email)), node('td', {}, roleLabel(user.role)), node('td', {}, packageControl), node('td', {}, badge(user.suspended ? 'Suspended' : 'Active', !user.suspended)), node('td', { class: 'actions' },
      user.id === me.id ? node('span', { class: 'muted' }, 'Current account') : [
      node('button', { class: 'ghost', type: 'button', onclick: async () => { const email = prompt(`Email for ${user.username}:`, user.email); if (!email || email === user.email) return; try { await api(`/users/${user.id}`, { method: 'PATCH', body: JSON.stringify({ email }) }); showNotice('Email updated.'); await usersView(); } catch (error) { showNotice(error.message, true); } } }, 'Edit email'),
      node('button', { class: user.suspended ? 'ghost' : 'warning', type: 'button', onclick: async () => { try { await api(`/users/${user.id}/${user.suspended ? 'unsuspend' : 'suspend'}`, { method: 'POST', body: '{}' }); showNotice('Account status updated.'); await usersView(); } catch (error) { showNotice(error.message, true); } } }, user.suspended ? 'Unsuspend' : 'Suspend'),
      node('button', { class: 'ghost', type: 'button', onclick: async () => { const password = prompt(`New temporary password for ${user.username}:`); if (!password) return; try { await api(`/users/${user.id}/reset-password`, { method: 'POST', body: JSON.stringify({ newPassword: password }) }); showNotice('Password reset and sessions revoked.'); } catch (error) { showNotice(error.message, true); } } }, 'Reset password'),
      node('button', { class: 'danger', type: 'button', onclick: async () => { if (!confirm(`Delete ${user.username}? The operation is refused while resources remain.`)) return; try { await api(`/users/${user.id}`, { method: 'DELETE', body: '{}' }); showNotice('Account deleted.'); await usersView(); } catch (error) { showNotice(error.message, true); } } }, 'Delete')
    ]));
  });
  const table = users.length ? node('div', { class: 'table-wrap' }, node('table', {}, node('thead', {}, node('tr', {}, ['Account', 'Role', 'Package', 'Status', 'Actions'].map(label => node('th', {}, label)))), node('tbody', {}, rows))) : empty('No managed accounts yet.');
  content.replaceChildren(node('div', { class: 'two-column' }, panel('Create account', form), panel('Managed accounts', table)));
}
const usersView = users;

async function packagesView() {
  const packages = await api('/packages');
  const limitFields = [['domains', 'Domains'], ['diskMb', 'Disk MB'], ['bandwidthGb', 'Bandwidth GB'], ['databases', 'Databases'], ['phpSites', 'PHP sites'], ['pythonApps', 'Python apps'], ['nodeApps', 'Node apps'], ['memoryMb', 'Memory MB'], ['cpuPercent', 'CPU percent'], ['processes', 'Processes'], ['backups', 'Backups'], ['cronJobs', 'Cron jobs']];
  const form = node('form', {}, field('Package name', 'name', 'text', '', { required: true }), node('div', { class: 'limit-grid' }, limitFields.map(([name, label]) => field(label, name, 'number', ['diskMb', 'memoryMb'].includes(name) ? '1024' : ['bandwidthGb'].includes(name) ? '10' : ['cpuPercent'].includes(name) ? '100' : ['processes'].includes(name) ? '50' : '1', { required: true, min: 0 }))), node('button', { type: 'submit' }, 'Create package'));
  form.addEventListener('submit', async event => { event.preventDefault(); const values = Object.fromEntries(new FormData(form)); const name = values.name; delete values.name; const limits = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, Number(value)])); try { await api('/packages', { method: 'POST', body: JSON.stringify({ name, limits }) }); form.reset(); showNotice('Hosting package created.'); await packagesView(); } catch (error) { showNotice(error.message, true); } });
  const cards = packages.length ? node('div', { class: 'stack' }, packages.map(item => node('article', { class: 'panel' }, node('div', { class: 'section-head' }, node('h2', {}, item.name), node('button', { class: 'danger', type: 'button', onclick: async () => { if (!confirm(`Delete unassigned package ${item.name}?`)) return; try { await api(`/packages/${item.id}`, { method: 'DELETE', body: '{}' }); showNotice('Package deleted.'); await packagesView(); } catch (error) { showNotice(error.message, true); } } }, 'Delete')), node('div', { class: 'limit-grid' }, Object.entries(item.limits).map(([key, value]) => node('div', { class: 'stat' }, node('span', {}, key), node('strong', {}, String(value)))))))) : empty('No hosting packages yet.');
  content.replaceChildren(node('div', { class: 'two-column' }, panel('New hosting package', form), node('div', {}, cards)));
}

async function domainsView() {
  const requests = [api('/domains')]; if (me.role !== 'customer') requests.push(api('/users'));
  const [domains, users = []] = await Promise.all(requests);
  const fields = [field('Domain name', 'domain', 'text', '', { required: true, placeholder: 'example.com' })];
  if (me.role !== 'customer') fields.push(selectField('Owner', 'ownerId', users.filter(item => item.role === 'customer').map(item => ({ value: item.id, label: item.username }))));
  const form = node('form', { class: 'form-grid' }, fields, node('button', { type: 'submit' }, 'Add domain'));
  form.addEventListener('submit', async event => { event.preventDefault(); try { await api('/domains', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) }); form.reset(); showNotice('Domain accepted for provisioning.'); await domainsView(); } catch (error) { showNotice(error.message, true); } });
  const act = async (item, action) => {
    if (action === 'delete' && !confirm(`Delete ${item.name}? Its Nginx configuration will be removed.`)) return;
    try {
      await api(`/domains/${item.id}${action === 'delete' ? '' : `/${action}`}`, { method: action === 'delete' ? 'DELETE' : 'POST', body: '{}' });
      showNotice(`Domain ${action} queued.`); await domainsView();
    } catch (error) { showNotice(error.message, true); }
  };
  const table = domains.length ? node('div', { class: 'table-wrap' }, node('table', {}, node('thead', {}, node('tr', {}, ['Domain', 'Type', 'Status', 'SSL', 'Created', 'Actions'].map(label => node('th', {}, label)))), node('tbody', {}, domains.map(item => {
    const busy = ['queued', 'deleting'].includes(item.status);
    const status = item.status || (item.enabled ? 'active' : 'disabled');
    return node('tr', {},
      node('td', { class: 'code' }, item.name), node('td', {}, item.type), node('td', {}, badge(status, status === 'active')),
      node('td', {}, badge(item.ssl, item.ssl === 'active')), node('td', {}, date(item.createdAt)),
      node('td', { class: 'actions' },
        node('button', { class: 'ghost', type: 'button', disabled: busy ? true : null, onclick: () => act(item, item.enabled ? 'disable' : 'enable') }, item.enabled ? 'Disable' : 'Enable'),
        node('button', { class: 'danger', type: 'button', disabled: busy ? true : null, onclick: () => act(item, 'delete') }, 'Delete')));
  })))) : empty('No domains yet.');
  content.replaceChildren(panel('Add domain', form), node('br'), panel('Domains', table));
}

async function jobsView() {
  const jobs = await api('/jobs');
  const form = node('form', { class: 'form-grid' }, selectField('Operation', 'type', ['deploy_static', 'deploy_php', 'deploy_python', 'deploy_node', 'issue_ssl', 'backup', 'restore', 'git_pull'].map(value => ({ value, label: value.replaceAll('_', ' ') }))), node('button', { type: 'submit' }, 'Queue operation'));
  form.addEventListener('submit', async event => { event.preventDefault(); try { await api('/jobs', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) }); showNotice('Job queued.'); await jobsView(); } catch (error) { showNotice(error.message, true); } });
  const table = jobs.length ? node('div', { class: 'table-wrap' }, node('table', {}, node('thead', {}, node('tr', {}, ['Operation', 'Status', 'Progress', 'Created'].map(label => node('th', {}, label)))), node('tbody', {}, jobs.map(item => node('tr', {}, node('td', {}, item.type), node('td', {}, badge(item.status, item.status === 'successful' || item.status === 'queued')), node('td', {}, `${item.progress}%`), node('td', {}, date(item.createdAt))))))) : empty('No jobs yet.');
  content.replaceChildren(panel('Queue operation', form), node('br'), panel('Job history', table));
}

async function notificationsView() {
  const items = await api('/notifications');
  const list = items.length ? node('div', { class: 'stack' }, items.map(item => node('article', { class: 'panel' }, node('div', { class: 'section-head' }, node('h2', {}, item.title), item.readAt ? badge('Read') : node('button', { class: 'ghost', onclick: async () => { await api(`/notifications/${item.id}/read`, { method: 'POST', body: '{}' }); await notificationsView(); } }, 'Mark read')), node('p', { class: 'muted' }, item.body), node('span', { class: 'muted' }, date(item.createdAt))))) : empty('No notifications.');
  content.replaceChildren(list);
}

async function auditView() {
  const items = await api('/audit');
  const table = items.length ? node('div', { class: 'table-wrap' }, node('table', {}, node('thead', {}, node('tr', {}, ['Action', 'Target', 'Result', 'Time'].map(label => node('th', {}, label)))), node('tbody', {}, items.map(item => node('tr', {}, node('td', { class: 'code' }, item.action), node('td', { class: 'code' }, item.target), node('td', {}, badge(item.result, item.result === 'success')), node('td', {}, date(item.at))))))) : empty('No audit events visible to this account.');
  content.replaceChildren(panel('Audit events', table));
}

async function accountView() {
  const form = node('form', {}, field('Current password', 'currentPassword', 'password', '', { required: true }), field('New password', 'newPassword', 'password', '', { required: true, minlength: 14 }), node('button', { type: 'submit' }, 'Change password'));
  form.addEventListener('submit', async event => { event.preventDefault(); try { await api('/account/password', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) }); me.mustChangePassword = false; auth.user = me; sessionStorage.setItem('lintech.auth', JSON.stringify(auth)); form.reset(); showNotice('Password changed; other sessions were revoked.'); } catch (error) { showNotice(error.message, true); } });
  content.replaceChildren(node('div', { class: 'two-column' }, panel('Account details', node('div', { class: 'stack' }, node('div', { class: 'activity' }, node('strong', {}, me.username), node('span', {}, me.email)), node('div', { class: 'activity' }, node('strong', {}, roleLabel(me.role)), node('span', {}, 'Backend-enforced role')))), panel('Change password', form)));
}

const views = { overview, users, packages: packagesView, domains: domainsView, jobs: jobsView, notifications: notificationsView, audit: auditView, account: accountView };

async function enterApplication() {
  try { me = await api('/me'); auth.user = me; sessionStorage.setItem('lintech.auth', JSON.stringify(auth)); }
  catch { return; }
  loginShell.classList.add('hidden'); appShell.classList.remove('hidden');
  document.querySelector('#sidebar-name').textContent = me.username;
  document.querySelector('#sidebar-role').textContent = roleLabel(me.role);
  document.querySelector('#avatar').textContent = me.username[0].toUpperCase();
  currentView = me.mustChangePassword ? 'account' : 'overview'; buildNavigation(); await openView(currentView);
}

function signOut(callApi = true) {
  const request = callApi && auth ? api('/auth/logout', { method: 'POST', body: '{}' }).catch(() => {}) : Promise.resolve();
  request.finally(() => { auth = null; me = null; sessionStorage.removeItem('lintech.auth'); appShell.classList.add('hidden'); loginShell.classList.remove('hidden'); });
}

document.querySelector('#login-form').addEventListener('submit', async event => {
  event.preventDefault(); const error = document.querySelector('#login-error'); error.textContent = '';
  try { auth = await api('/auth/login', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) }); sessionStorage.setItem('lintech.auth', JSON.stringify(auth)); event.currentTarget.reset(); await enterApplication(); }
  catch (failure) { error.textContent = failure.message; }
});
document.querySelector('#logout').addEventListener('click', () => signOut());
document.querySelector('#refresh').addEventListener('click', () => openView(currentView));
if (auth) enterApplication();
