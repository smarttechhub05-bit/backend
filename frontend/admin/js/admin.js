const studioTimeZone = 'Africa/Douala';

function formatStudioDate(value, options = {}) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: studioTimeZone, dateStyle: 'medium', ...options }).format(new Date(value));
}

function removeStaticDashboardContent() {
  document.querySelectorAll('.dash-panel').forEach((panel) => {
    const heading = panel.querySelector('h2')?.textContent.trim();
    if (['Website visitors', 'Recent activity', 'Popular services', 'Quick actions'].includes(heading)) panel.remove();
  });
  document.querySelector('.booking-table tbody')?.replaceChildren();
  document.querySelectorAll('.stat-card').forEach((card) => { const value = card.querySelector('strong'); const note = card.querySelector('small'); if (value) value.textContent = '0'; if (note) note.textContent = 'Loading live data'; });
  const dateLabel = document.querySelector('.date-label');
  if (dateLabel) dateLabel.textContent = new Intl.DateTimeFormat('en-GB', { timeZone: studioTimeZone, dateStyle: 'long' }).format(new Date());
}

removeStaticDashboardContent();

const loginForm = document.querySelector('[data-admin-login]');
if (loginForm) {
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const note = loginForm.querySelector('.admin-note');
    const email = loginForm.querySelector('[name="email"]').value.trim();
    const password = loginForm.querySelector('[name="password"]').value;
    if (!email || !password) { note.textContent = 'Email and password are required.'; return; }
    try {
      const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ email, password }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Login failed.');
      window.location.href = 'dashboard.html';
    } catch (error) { note.textContent = error.message; }
  });
}

async function loadCurrentAdmin() {
  const dashboard = document.querySelector('.dashboard-shell');
  if (!dashboard) return;
  try {
    const response = await fetch('/api/auth/me', { credentials: 'same-origin' });
    if (!response.ok) throw new Error('Authentication required.');
    const result = await response.json();
    const user = result.user;
    dashboard.dataset.role = user.role;
    dashboard.dataset.permissions = (user.permissions || []).join(',');
    document.querySelectorAll('.sidebar-nav a').forEach((link) => {
      const label = link.textContent.trim();
      const hiddenForRole = (label === 'Staff & Users' && user.role !== 'superadmin') ||
        (label === 'Settings' && user.role !== 'superadmin') ||
        label === 'Payment Records' ||
        (label === 'Services & Packages' && !['superadmin', 'manager'].includes(user.role));
      if (hiddenForRole) link.remove();
    });
    if (['superadmin', 'manager'].includes(user.role) && !document.querySelector('[data-cms-nav]')) {
      const cmsLink = document.createElement('a');
      cmsLink.href = '#website-cms';
      cmsLink.textContent = 'Website / CMS';
      cmsLink.dataset.cmsNav = 'true';
      document.querySelector('.sidebar-nav')?.insertBefore(cmsLink, document.querySelector('.sidebar-nav a[href="#clients"]'));
    }
    const top = document.querySelector('.dashboard-top');
    const welcome = top?.querySelector('h1');
    if (welcome) welcome.textContent = `Welcome, ${user.name}.`;
    const subtitle = top?.querySelector('p');
    if (subtitle) subtitle.textContent = `${user.email} · ${user.role}`;
    const logout = document.createElement('button');
    logout.className = 'admin-logout';
    logout.type = 'button';
    logout.textContent = 'Logout';
    logout.addEventListener('click', async () => { await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }); window.location.href = 'login.html'; });
    top?.appendChild(logout);
    await setupNotificationCenter();
  } catch (error) {
    window.location.href = 'login.html?message=session-expired';
    return false;
  }
}

function notificationRelativeTime(value) {
    const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    if (seconds < 172800) return 'Yesterday';
    return formatStudioDate(value);
  }
async function setupNotificationCenter() {
    const top = document.querySelector('.dashboard-top');
    if (!top || document.querySelector('[data-notification-center]')) return;
    const center = document.createElement('div');
    center.dataset.notificationCenter = 'true';
    center.className = 'notification-center';
    center.innerHTML = '<button type="button" class="notification-trigger" aria-expanded="false" aria-label="Notifications">Notifications <span class="notification-badge" hidden>0</span></button><div class="notification-panel" hidden><div class="notification-panel-header"><strong>Notifications</strong><button type="button" data-notifications-read-all>Mark all read</button></div><div data-notification-list><p class="management-empty">No new notifications.</p></div></div>';
    top.appendChild(center);
    const trigger = center.querySelector('.notification-trigger');
    const panel = center.querySelector('.notification-panel');
    const badge = center.querySelector('.notification-badge');
    const list = center.querySelector('[data-notification-list]');
    const refreshCount = async () => { const result = await requestJson('/api/notifications/unread-count'); badge.textContent = result.count; badge.hidden = !result.count; };
    const loadList = async () => {
      const notifications = await requestJson('/api/notifications?limit=30');
      list.innerHTML = notifications.length ? notifications.map((item) => `<button type="button" class="notification-item${item.read ? '' : ' notification-item--unread'}" data-notification-id="${item._id}" data-related-type="${item.relatedType || ''}" data-related-id="${item.relatedId || ''}"><strong>${item.title}</strong><span>${item.message}</span><small>${notificationRelativeTime(item.createdAt)}</small></button>`).join('') : '<p class="management-empty">No new notifications.</p>';
      list.querySelectorAll('[data-notification-id]').forEach((item) => item.addEventListener('click', async () => { await requestJson(`/api/notifications/${item.dataset.notificationId}/read`, { method: 'PUT' }); if (item.dataset.relatedType === 'booking') window.location.href = `dashboard.html#bookings?booking=${item.dataset.relatedId}`; else if (item.dataset.relatedType === 'project') window.location.href = `dashboard.html#projects?project=${item.dataset.relatedId}`; else window.location.href = `dashboard.html#website-cms`; }));
    };
    trigger.addEventListener('click', async () => { const open = panel.hidden; panel.hidden = !open; trigger.setAttribute('aria-expanded', String(open)); if (open) await loadList(); });
    center.querySelector('[data-notifications-read-all]').addEventListener('click', async () => { await requestJson('/api/notifications/read-all', { method: 'PUT' }); await refreshCount(); await loadList(); });
    await refreshCount();
    window.setInterval(refreshCount, 30000);
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'Request failed');
  return result.data || [];
}

function cmsEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));
}

async function loadWebsitePanel(role) {
  if (!['superadmin', 'manager'].includes(role)) return;
  try {
    const settings = await requestJson('/api/website/admin/settings');
    const testimonials = await requestJson('/api/website/admin/testimonials');
    const promotions = await requestJson('/api/website/admin/promotions');
    const homepage = settings.homepage || {};
    const about = settings.about || {};
    const social = settings.socialLinks || {};
    const panel = addDashboardPanel('Website / CMS', `<p class="management-status" data-cms-status aria-live="polite">Manage normal website content. Empty fields keep the public fallback copy.</p><form class="management-form cms-form" data-cms-settings><h3>Studio Information</h3><input name="businessName" placeholder="Business name" value="${cmsEscape(settings.businessName)}"><input name="tagline" placeholder="Tagline" value="${cmsEscape(settings.tagline)}"><textarea name="description" placeholder="Studio description">${cmsEscape(settings.description)}</textarea><input name="phone" placeholder="Phone" value="${cmsEscape(settings.phone)}"><input name="WhatsApp" placeholder="WhatsApp" value="${cmsEscape(settings.WhatsApp)}"><input name="email" type="email" placeholder="Email" value="${cmsEscape(settings.email)}"><input name="address" placeholder="Address" value="${cmsEscape(settings.address)}"><input name="city" placeholder="City" value="${cmsEscape(settings.city || 'Limbe')}"><input name="country" placeholder="Country" value="${cmsEscape(settings.country || 'Cameroon')}"><input name="businessHours" placeholder="Business hours" value="${cmsEscape(settings.businessHours)}"><h3>Homepage</h3><input name="homepage.heroHeadline" placeholder="Hero headline" value="${cmsEscape(homepage.heroHeadline)}"><textarea name="homepage.heroSubheadline" placeholder="Hero subheadline">${cmsEscape(homepage.heroSubheadline)}</textarea><input name="homepage.heroImage" placeholder="Hero image URL" value="${cmsEscape(homepage.heroImage)}"><input name="homepage.primaryButtonText" placeholder="Primary button text" value="${cmsEscape(homepage.primaryButtonText)}"><input name="homepage.primaryButtonLink" placeholder="Primary button link" value="${cmsEscape(homepage.primaryButtonLink)}"><input name="homepage.secondaryButtonText" placeholder="Secondary button text" value="${cmsEscape(homepage.secondaryButtonText)}"><input name="homepage.secondaryButtonLink" placeholder="Secondary button link" value="${cmsEscape(homepage.secondaryButtonLink)}"><h3>About and SEO</h3><input name="about.heading" placeholder="About heading" value="${cmsEscape(about.heading)}"><textarea name="about.description" placeholder="About description">${cmsEscape(about.description)}</textarea><textarea name="about.story" placeholder="Studio story">${cmsEscape(about.story)}</textarea><textarea name="about.mission" placeholder="Mission">${cmsEscape(about.mission)}</textarea><textarea name="about.vision" placeholder="Vision">${cmsEscape(about.vision)}</textarea><input name="about.image" placeholder="About image URL" value="${cmsEscape(about.image)}"><input name="seoTitle" placeholder="SEO title" value="${cmsEscape(settings.seoTitle)}"><textarea name="seoDescription" placeholder="SEO description">${cmsEscape(settings.seoDescription)}</textarea><input name="socialLinks.instagram" placeholder="Instagram URL" value="${cmsEscape(social.instagram)}"><input name="socialLinks.facebook" placeholder="Facebook URL" value="${cmsEscape(social.facebook)}"><input name="socialLinks.youtube" placeholder="YouTube URL" value="${cmsEscape(social.youtube)}"><button class="admin-button" type="submit">Save Website Content</button></form><section><h3>Testimonials</h3><form class="management-form" data-testimonial-form><input name="clientName" placeholder="Client name" required><textarea name="content" placeholder="Testimonial" required></textarea><input name="rating" type="number" min="1" max="5" value="5"><label><input name="published" type="checkbox" checked> Published</label><button class="admin-button" type="submit">Add Testimonial</button></form><div class="management-list" data-testimonial-list>${testimonials.map((item) => `<div class="management-item"><span><strong>${cmsEscape(item.clientName)}</strong><small>${cmsEscape(item.content)}</small></span><button type="button" data-testimonial-delete="${item._id}">Unpublish</button></div>`).join('') || '<p class="management-empty">No testimonials yet.</p>'}</div></section><section><h3>Promotions</h3><form class="management-form" data-promotion-form><input name="title" placeholder="Promotion title" required><textarea name="description" placeholder="Short description"></textarea><input name="startDate" type="date"><input name="endDate" type="date"><input name="buttonText" placeholder="Button text"><input name="buttonLink" placeholder="Button link"><label><input name="active" type="checkbox"> Active</label><label><input name="published" type="checkbox"> Published</label><button class="admin-button" type="submit">Add Promotion</button></form><div class="management-list">${promotions.map((item) => `<div class="management-item"><span><strong>${cmsEscape(item.title)}</strong><small>${item.active && item.published ? 'Published' : 'Draft / inactive'}</small></span><button type="button" data-promotion-delete="${item._id}">Unpublish</button></div>`).join('') || '<p class="management-empty">No promotions yet.</p>'}</div></section>`);
    const publishToggle = document.createElement('label');
    publishToggle.innerHTML = `<input name="published" type="checkbox" ${settings.published !== false ? 'checked' : ''}> Publish website content`;
    panel.querySelector('[data-cms-settings] button[type="submit"]')?.before(publishToggle);
    panel.id = 'website-cms';
    const mediaPanel = document.createElement('section');
    mediaPanel.innerHTML = '<h3>Media Library</h3><form class="management-form" data-media-form><input name="title" placeholder="Media title" required><input name="caption" placeholder="Short caption" maxlength="140"><textarea name="description" placeholder="Description"></textarea><input name="altText" placeholder="Alt text (optional)"><select name="usage"><option value="general">General</option><option value="hero">Hero</option><option value="about">About</option><option value="portfolio">Portfolio</option><option value="promotion">Promotion</option><option value="testimonial">Testimonial</option></select><select name="category"><option value="photography">Photography</option><option value="videography">Videography</option><option value="weddings">Weddings</option><option value="portraits">Portraits</option><option value="events">Events</option><option value="fashion">Fashion</option><option value="commercial">Commercial</option><option value="portfolio">Portfolio</option></select><input name="file" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" required><button class="admin-button" type="submit">Upload Media</button></form><div class="management-list" data-media-list></div>';
    panel.appendChild(mediaPanel);
    const mediaList = mediaPanel.querySelector('[data-media-list]');
    const renderMedia = (media) => { mediaList.innerHTML = media.length ? media.map((item) => `<div class="management-item"><span><strong>${cmsEscape(item.title)}</strong><small>${cmsEscape(item.usage)} · ${cmsEscape(item.mimeType)}</small></span><button type="button" data-media-delete="${item._id}">Delete</button></div>`).join('') : '<p class="management-empty">No media assets yet.</p>'; mediaList.querySelectorAll('[data-media-delete]').forEach((button) => button.addEventListener('click', async () => { await requestJson(`/api/website/admin/media/${button.dataset.mediaDelete}`, { method: 'DELETE' }); button.closest('.management-item').remove(); status.textContent = 'Media asset deleted.'; })); };
    const media = await requestJson('/api/website/admin/media');
    renderMedia(media);
    mediaPanel.querySelector('[data-media-form]').addEventListener('submit', async (event) => { event.preventDefault(); const formData = new FormData(event.currentTarget); try { const asset = await requestJson('/api/website/admin/media', { method: 'POST', body: formData }); media.push(asset); renderMedia(media); event.currentTarget.reset(); status.textContent = 'Media uploaded successfully.'; } catch (error) { status.textContent = error.message; } });
    const status = panel.querySelector('[data-cms-status]');
    panel.querySelector('[data-cms-settings]').addEventListener('submit', async (event) => { event.preventDefault(); const payload = { socialLinks: {}, homepage: {}, about: {}, published: event.currentTarget.published.checked }; for (const [key, value] of new FormData(event.currentTarget).entries()) { const parts = key.split('.'); if (parts.length === 1 && key !== 'published') payload[key] = value; else if (parts.length > 1) payload[parts[0]][parts[1]] = value; } try { await requestJson('/api/website/admin/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); status.textContent = 'Changes saved successfully.'; } catch (error) { status.textContent = error.message; } });
    panel.querySelector('[data-testimonial-form]').addEventListener('submit', async (event) => { event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget).entries()); values.published = event.currentTarget.published.checked; await requestJson('/api/website/admin/testimonials', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) }); status.textContent = 'Testimonial created.'; });
    panel.querySelector('[data-promotion-form]').addEventListener('submit', async (event) => { event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget).entries()); values.active = event.currentTarget.active.checked; values.published = event.currentTarget.published.checked; await requestJson('/api/website/admin/promotions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) }); status.textContent = 'Promotion created.'; });
    panel.querySelectorAll('[data-testimonial-delete]').forEach((button) => button.addEventListener('click', async () => { await requestJson(`/api/website/admin/testimonials/${button.dataset.testimonialDelete}`, { method: 'DELETE' }); button.closest('.management-item').remove(); status.textContent = 'Testimonial unpublished.'; }));
    panel.querySelectorAll('[data-promotion-delete]').forEach((button) => button.addEventListener('click', async () => { await requestJson(`/api/website/admin/promotions/${button.dataset.promotionDelete}`, { method: 'DELETE' }); button.closest('.management-item').remove(); status.textContent = 'Promotion unpublished.'; }));
  } catch (error) { console.error(error); }
}

async function loadAnalyticsPanel(role) {
  if (!['superadmin', 'manager'].includes(role)) return;
  try {
    const panel = addDashboardPanel('Analytics & Business Insights', '<div class="management-form"><label>Date range<select data-analytics-range><option value="today">Today</option><option value="last7">Last 7 Days</option><option value="last30" selected>Last 30 Days</option><option value="thisMonth">This Month</option><option value="lastMonth">Last Month</option></select></label></div><div data-analytics-content><p class="management-empty">Loading live analytics...</p></div>');
    panel.id = 'analytics';
    const content = panel.querySelector('[data-analytics-content]');
    const render = async () => {
      content.innerHTML = '<p class="management-empty">Loading live analytics...</p>';
      const data = await requestJson(`/api/analytics/overview?range=${panel.querySelector('[data-analytics-range]').value}`);
      const website = data.website.totals;
      const business = data.business.totals;
      const cards = [['Visitors', website.visitors], ['Page Views', website.pageViews], ['Booking Submissions', website.bookingSubmitted], ['Total Bookings', business.totalBookings], ['Active Projects', business.activeProjects], ['Active Galleries', business.activeGalleries]];
      content.innerHTML = `<div class="stats-grid analytics-cards">${cards.map(([label, value]) => `<article class="stat-card"><span>${label}</span><strong>${value || 0}</strong><small>Live data</small></article>`).join('')}</div><div class="analytics-grid"><section><h3>Website Performance</h3><p>Booking page views: ${website.bookingPageViews || 0}</p><p>Booking starts: ${website.bookingStarted || 0}</p><p>WhatsApp clicks: ${website.whatsappClicks || 0}</p><p>Phone clicks: ${website.phoneClicks || 0}</p><p>Portfolio views: ${website.portfolioViews || 0}</p><p>Service views: ${website.serviceViews || 0}</p></section><section><h3>Booking Funnel</h3><p>Visitors → Booking page: ${website.visitors || 0} → ${website.bookingPageViews || 0}</p><p>Started → Submitted: ${website.bookingStarted || 0} → ${website.bookingSubmitted || 0}</p><p>Confirmed bookings: ${business.confirmedBookings || 0}</p></section><section><h3>Most Viewed Services</h3>${data.website.servicesViewed.length ? data.website.servicesViewed.map((item) => `<p>${item.service}: ${item.views}</p>`).join('') : '<p class="management-empty">No service view data available yet.</p>'}</section><section><h3>Most Requested Services</h3>${data.business.requestedServices.length ? data.business.requestedServices.map((item) => `<p>${item.service}: ${item.bookings}</p>`).join('') : '<p class="management-empty">No booking data available yet.</p>'}</section><section><h3>Project Status</h3>${data.business.projectStatuses.length ? data.business.projectStatuses.map((item) => `<p>${item.status}: ${item.count}</p>`).join('') : '<p class="management-empty">No project data available yet.</p>'}</section><section><h3>Devices</h3>${data.website.devices.length ? data.website.devices.map((item) => `<p>${item.device}: ${item.count}</p>`).join('') : '<p class="management-empty">No visitor data available yet.</p>'}</section></div>`;
    };
    panel.querySelector('[data-analytics-range]').addEventListener('change', () => render().catch((error) => { content.innerHTML = `<p class="management-status">${error.message}</p>`; }));
    await render();
  } catch (error) { console.error(error); }
}

function adminPanel(title, formMarkup, listId) {
  const panel = document.createElement('section');
  panel.className = 'dash-panel management-panel';
  panel.innerHTML = `<h2>${title}</h2>${formMarkup}<div id="${listId}" class="management-list"></div>`;
  return panel;
}

function serviceForm() {
  return '<form class="management-form" data-service-form><input name="name" placeholder="Service name" required><select name="category"><option>Photography</option><option>Videography</option><option>Weddings</option><option>Portraits</option><option>Events</option><option>Commercial</option><option>Other</option></select><input name="price" type="number" min="0" placeholder="Price (XAF)"><input name="duration" placeholder="Duration"><input name="description" placeholder="Short description"><button class="admin-button" type="submit">Add service</button><p class="management-status" aria-live="polite"></p></form>';
}

function packageForm(services) {
  const options = services.map((service) => `<option value="${service._id}">${service.name}</option>`).join('');
  return `<form class="management-form" data-package-form><input name="name" placeholder="Package name" required><select name="service" required>${options || '<option value="">Add a service first</option>'}</select><input name="price" type="number" min="0" placeholder="Price (XAF)"><input name="selectionLimit" type="number" min="0" placeholder="Selected photo limit (optional)"><input name="duration" placeholder="Duration"><input name="description" placeholder="Short description"><input name="features" placeholder="Features separated by commas"><button class="admin-button" type="submit">Add package</button><p class="management-status" aria-live="polite"></p></form>`;
}

function renderManagementList(container, items, type) {
  container.innerHTML = items.length ? items.map((item) => `<div class="management-item"><span><strong>${item.name}</strong><small>${type === 'service' ? item.category : `${item.service?.name || 'Service'} · ${item.price || 0} XAF`}</small></span><span class="management-actions"><button data-edit-type="${type}" data-edit-id="${item._id}" data-edit-name="${item.name}" title="Edit">Edit</button><button data-toggle-type="${type}" data-toggle-id="${item._id}" data-toggle-active="${item.active}" title="Activate or deactivate">${item.active ? 'Deactivate' : 'Activate'}</button><button data-delete-type="${type}" data-delete-id="${item._id}" title="Delete">Delete</button></span></div>`).join('') : '<p class="management-empty">No records yet.</p>';
  container.querySelectorAll('[data-edit-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      const name = window.prompt('Update name', button.dataset.editName);
      if (!name || name === button.dataset.editName) return;
      try { await requestJson(`/api/${button.dataset.editType === 'service' ? 'services' : 'packages'}/${button.dataset.editId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }); loadDashboardManagement(); } catch (error) { window.alert(error.message); }
    });
  });
  container.querySelectorAll('[data-toggle-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      try { await requestJson(`/api/${button.dataset.toggleType === 'service' ? 'services' : 'packages'}/${button.dataset.toggleId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: button.dataset.toggleActive !== 'true' }) }); loadDashboardManagement(); } catch (error) { window.alert(error.message); }
    });
  });
  container.querySelectorAll('[data-delete-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        await requestJson(`/api/${button.dataset.deleteType === 'service' ? 'services' : 'packages'}/${button.dataset.deleteId}`, { method: 'DELETE' });
        loadDashboardManagement();
      } catch (error) { window.alert(error.message); }
    });
  });
}

async function loadDashboardManagement() {
  const dashboardGrid = document.querySelector('.dashboard-grid');
  if (!dashboardGrid) return;
  let services = [];
  let packages = [];
  try { services = await requestJson('/api/services?admin=true'); } catch (error) { console.error(error); }
  try { packages = await requestJson('/api/packages?admin=true'); } catch (error) { console.error(error); }
  document.querySelector('[data-management-panels]')?.remove();
  const management = document.createElement('div');
  management.dataset.managementPanels = 'true';
  management.className = 'dashboard-grid management-grid';
  management.appendChild(adminPanel('Services', serviceForm(), 'service-management-list'));
  management.appendChild(adminPanel('Packages', packageForm(services), 'package-management-list'));
  dashboardGrid.after(management);
  renderManagementList(document.querySelector('#service-management-list'), services, 'service');
  renderManagementList(document.querySelector('#package-management-list'), packages, 'package');
  management.querySelector('[data-service-form]').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    try { await requestJson('/api/services', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); form.reset(); loadDashboardManagement(); } catch (error) { form.querySelector('.management-status').textContent = error.message; }
  });
  management.querySelector('[data-package-form]').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    payload.features = payload.features ? payload.features.split(',').map((feature) => feature.trim()).filter(Boolean) : [];
    try { await requestJson('/api/packages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); form.reset(); loadDashboardManagement(); } catch (error) { form.querySelector('.management-status').textContent = error.message; }
  });
}

async function loadBookings() {
  const tableBody = document.querySelector('.booking-table tbody');
  if (!tableBody) return;
  try {
    const bookings = await requestJson('/api/bookings');
    tableBody.innerHTML = bookings.length ? bookings.map((booking) => `<tr><td>${booking.client?.fullName || 'Client unavailable'}</td><td>${booking.service?.name || 'Service unavailable'}</td><td>${formatStudioDate(booking.preferredDate)}</td><td><button type="button" data-booking-view="${booking._id}">Details</button></td></tr>`).join('') : '<tr><td colspan="4">No booking requests yet.</td></tr>';
    const panel = tableBody.closest('.dash-panel');
    panel?.querySelector('[data-booking-details]')?.remove();
    const showDetails = async (bookingId) => {
      const booking = await requestJson(`/api/bookings/${bookingId}`);
      const phone = String(booking.client?.phone || '').trim();
      const email = String(booking.client?.email || '').trim();
      const whatsappPhone = phone.replace(/[^\d]/g, '');
      const message = `Hello ${booking.client?.fullName || ''}, this is Rap Eugene Studio regarding your booking request for ${booking.service?.name || 'your session'}${booking.package?.name ? ` (${booking.package.name})` : ''}. We would like to discuss the details of your booking with you.`;
      const contact = `${whatsappPhone ? `<a class="admin-button" target="_blank" rel="noopener" href="https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}">WhatsApp Customer</a>` : ''}${phone ? `<a class="admin-button" href="tel:${phone.replace(/[^\d+]/g, '')}">Call Customer</a>` : ''}${email ? `<a class="admin-button" href="mailto:${email}">Email Customer</a>` : ''}` || '<span>No customer contact details available.</span>';
      const projectAction = booking.status === 'confirmed' && !booking.project ? `<button type="button" data-booking-project="${booking._id}">Create Project</button>` : '';
      const details = document.createElement('section');
      details.dataset.bookingDetails = 'true';
      details.className = 'booking-details';
      details.innerHTML = `<h3>Booking Details</h3><p><strong>Client</strong><br>${booking.client?.fullName || 'Client unavailable'}<br>${phone || 'No phone provided'}<br>${email || 'No email provided'}</p><p><strong>Booking</strong><br>${booking.service?.name || 'Service unavailable'}${booking.package?.name ? ` · ${booking.package.name}` : ''}<br>${formatStudioDate(booking.preferredDate)} · ${booking.preferredTime || 'Time not specified'}<br>${booking.eventType || 'Event type not specified'}<br>${booking.message || 'No customer message.'}<br>Status: ${booking.status}<br>Created: ${formatStudioDate(booking.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}</p><div class="management-actions"><select data-booking-status="${booking._id}">${['pending', 'confirmed', 'completed', 'cancelled', 'rescheduled'].map((status) => `<option value="${status}" ${status === booking.status ? 'selected' : ''}>${status}</option>`).join('')}</select>${projectAction}</div><h4>Contact Customer</h4><div class="management-actions">${contact}</div><h4>Internal Notes</h4><textarea data-booking-notes rows="3" placeholder="Operational notes only">${booking.notes || ''}</textarea><button type="button" data-booking-save-notes="${booking._id}">Save Notes</button><p class="management-status" data-booking-status-message></p>`;
      panel?.appendChild(details);
      details.querySelector('[data-booking-status]')?.addEventListener('change', async (event) => {
        try { await requestJson(`/api/bookings/${bookingId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: event.target.value }) }); event.target.closest('.booking-details').querySelector('[data-booking-status-message]').textContent = 'Booking status updated.'; } catch (error) { event.target.closest('.booking-details').querySelector('[data-booking-status-message]').textContent = error.message; }
      });
      details.querySelector('[data-booking-save-notes]')?.addEventListener('click', async () => {
        try { await requestJson(`/api/bookings/${bookingId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notes: details.querySelector('[data-booking-notes]').value }) }); details.querySelector('[data-booking-status-message]').textContent = 'Internal notes saved.'; } catch (error) { details.querySelector('[data-booking-status-message]').textContent = error.message; }
      });
      details.querySelector('[data-booking-project]')?.addEventListener('click', async () => {
        try { await requestJson(`/api/bookings/${bookingId}/create-project`, { method: 'POST' }); details.querySelector('[data-booking-status-message]').textContent = 'Project created successfully.'; details.querySelector('[data-booking-project]').remove(); } catch (error) { details.querySelector('[data-booking-status-message]').textContent = error.message; }
      });
    };
    tableBody.querySelectorAll('[data-booking-view]').forEach((button) => button.addEventListener('click', () => showDetails(button.dataset.bookingView).catch((error) => window.alert(error.message))));
  } catch (error) { console.error(error); }
}

async function loadDashboardStats() {
  const dashboard = document.querySelector('.dashboard-shell');
  if (!dashboard) return;
  const cards = [...document.querySelectorAll('.stat-card')];
  cards.forEach((card) => { card.querySelector('strong').textContent = '...'; });
  try {
    const stats = await requestJson('/api/dashboard/stats');
    const values = [stats.totalClients, stats.totalBookings, stats.upcomingShoots, stats.pendingBookings, stats.galleryProjects, stats.activeServices];
    const labels = ['Total Clients', 'Total Bookings', 'Upcoming Shoots', 'Pending Bookings', 'Gallery Projects', 'Active Services'];
    cards.forEach((card, index) => { if (values[index] !== undefined) { card.querySelector('span').textContent = labels[index]; card.querySelector('strong').textContent = values[index]; card.querySelector('small').textContent = 'Live from MongoDB'; } });
    const extra = document.querySelector('[data-live-stats]') || document.createElement('section');
    extra.dataset.liveStats = 'true';
    extra.className = 'stats-grid live-extra-stats';
    extra.innerHTML = `<article class="stat-card"><span>Completed Bookings</span><strong>${stats.completedBookings}</strong><small>Live from MongoDB</small></article><article class="stat-card"><span>Total Projects</span><strong>${stats.totalProjects}</strong><small>Live from MongoDB</small></article>`;
    if (!extra.parentElement) document.querySelector('.stats-grid').after(extra);
  } catch (error) {
    cards.forEach((card) => { card.querySelector('strong').textContent = '—'; card.querySelector('small').textContent = 'Unable to load'; });
  }
}

function addDashboardPanel(title, content) {
  const panel = document.createElement('section');
  panel.className = 'dash-panel management-panel';
  panel.innerHTML = `<h2>${title}</h2>${content}`;
  document.querySelector('.dashboard-grid')?.after(panel);
  return panel;
}

async function loadStaffPanel(role) {
  if (!['superadmin', 'manager'].includes(role)) return;
  try {
    const staff = await requestJson('/api/staff');
    const form = role === 'superadmin' ? '<form class="management-form" data-staff-form><input name="name" placeholder="Full name" required><input name="email" type="email" placeholder="Email" required><input name="password" type="password" placeholder="Temporary password" minlength="8" required><select name="role"><option>manager</option><option>photographer</option><option>videographer</option><option>editor</option></select><button class="admin-button" type="submit">Create staff</button><p class="management-status"></p></form>' : '<p class="management-empty">Managers can view staff, but only Super Admins can change staff accounts.</p>';
    const panel = addDashboardPanel('Staff & Users', `${form}<div class="management-list">${staff.map((item) => `<div class="management-item"><span><strong>${item.name}</strong><small>${item.email} · ${item.role} · ${item.active ? 'Active' : 'Inactive'}</small></span>${role === 'superadmin' ? `<span class="management-actions"><button data-staff-edit="${item._id}" data-staff-name="${item.name}" data-staff-email="${item.email}" data-staff-role="${item.role}">Edit</button><button data-staff-toggle="${item._id}" data-staff-active="${item.active}">${item.active ? 'Disable' : 'Activate'}</button></span>` : ''}</div>`).join('')}</div>`);
    panel.querySelector('[data-staff-form]')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const formElement = event.currentTarget;
      const payload = Object.fromEntries(new FormData(formElement).entries());
      try { await requestJson('/api/staff', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); formElement.reset(); loadStaffPanel(role); } catch (error) { formElement.querySelector('.management-status').textContent = error.message; }
    });
    panel.querySelectorAll('[data-staff-toggle]').forEach((button) => button.addEventListener('click', async () => {
      try { await requestJson(`/api/staff/${button.dataset.staffToggle}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: button.dataset.staffActive !== 'true' }) }); loadStaffPanel(role); } catch (error) { window.alert(error.message); }
    }));
    panel.querySelectorAll('[data-staff-edit]').forEach((button) => button.addEventListener('click', async () => {
      const name = window.prompt('Staff name', button.dataset.staffName);
      const email = window.prompt('Staff email', button.dataset.staffEmail);
      const nextRole = window.prompt('Role: superadmin, manager, photographer, videographer, editor', button.dataset.staffRole);
      if (!name || !email || !nextRole) return;
      try { await requestJson(`/api/staff/${button.dataset.staffEdit}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, role: nextRole }) }); loadStaffPanel(role); } catch (error) { window.alert(error.message); }
    }));
  } catch (error) { console.error(error); }
}

async function loadProjectPanel(role) {
  try {
    const projects = await requestJson('/api/projects');
    const staff = ['superadmin', 'manager'].includes(role) ? await requestJson('/api/staff') : [];
    const assignmentForm = ['superadmin', 'manager'].includes(role) ? `<form class="management-form" data-assignment-form><select name="project" required><option value="">Choose project</option>${projects.map((project) => `<option value="${project._id}">${project.title}</option>`).join('')}</select><select name="photographer"><option value="">Photographer</option>${staff.filter((item) => item.role === 'photographer' && item.active).map((item) => `<option value="${item._id}">${item.name}</option>`).join('')}</select><select name="videographer"><option value="">Videographer</option>${staff.filter((item) => item.role === 'videographer' && item.active).map((item) => `<option value="${item._id}">${item.name}</option>`).join('')}</select><select name="editor"><option value="">Editor</option>${staff.filter((item) => item.role === 'editor' && item.active).map((item) => `<option value="${item._id}">${item.name}</option>`).join('')}</select><button class="admin-button" type="submit">Save assignments</button><p class="management-status"></p></form>` : '';
    const panel = addDashboardPanel('Assigned Projects', `${assignmentForm}<div class="management-list">${projects.length ? projects.map((project) => `<div class="management-item"><span><strong>${project.title}</strong><small>${project.client?.fullName || 'Client unavailable'} · ${project.status}</small></span></div>`).join('') : '<p class="management-empty">No assigned projects yet.</p>'}</div>`);
    panel.querySelector('[data-assignment-form]')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(event.currentTarget).entries());
      const assignments = ['photographer', 'videographer', 'editor'].filter((assignmentRole) => values[assignmentRole]).map((assignmentRole) => ({ user: values[assignmentRole], assignmentRole }));
      try { await requestJson(`/api/projects/${values.project}/assignments`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assignments }) }); event.currentTarget.querySelector('.management-status').textContent = 'Assignments saved.'; } catch (error) { event.currentTarget.querySelector('.management-status').textContent = error.message; }
    });
  } catch (error) { console.error(error); }
}

async function loadCalendarPanel() {
  try {
    const projects = await requestJson('/api/projects/calendar/events');
    const panel = addDashboardPanel('Projects / Shoots Calendar', '<div class="calendar-toolbar"><button type="button" data-calendar-view="month">Month</button><button type="button" data-calendar-view="list">Upcoming list</button></div><div data-calendar-content></div>');
    const content = panel.querySelector('[data-calendar-content]');
    const renderList = () => { content.innerHTML = projects.length ? `<div class="calendar-list">${projects.map((project) => `<button class="calendar-event" data-project-id="${project._id}"><strong>${formatStudioDate(project.shootDate)}</strong><span>${project.title} · ${project.client?.fullName || 'Client unavailable'}</span><small>${project.startTime || 'Time not specified'} · ${project.location || 'Location not specified'} · ${project.status}</small></button>`).join('')}</div>` : '<p class="management-empty">No scheduled projects yet.</p>'; };
    const renderMonth = () => {
      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth();
      const firstDay = new Date(year, month, 1).getDay();
      const days = new Date(year, month + 1, 0).getDate();
      const byDay = projects.reduce((map, project) => { const day = new Date(project.shootDate).getDate(); (map[day] ||= []).push(project); return map; }, {});
      let cells = '';
      for (let index = 0; index < firstDay; index += 1) cells += '<div class="calendar-day calendar-day--empty"></div>';
      for (let day = 1; day <= days; day += 1) cells += `<div class="calendar-day"><strong>${day}</strong>${(byDay[day] || []).map((project) => `<button class="calendar-event" data-project-id="${project._id}">${project.title}</button>`).join('')}</div>`;
      content.innerHTML = `<p class="calendar-month-label">${new Intl.DateTimeFormat('en-GB', { timeZone: studioTimeZone, month: 'long', year: 'numeric' }).format(today)}</p><div class="calendar-grid">${cells}</div>`;
    };
    const showDetails = async (id) => { const result = await requestJson(`/api/projects/${id}`); const project = result; content.innerHTML = `<button class="calendar-back" type="button">← Back to calendar</button><div class="project-detail"><h3>${project.title}</h3><p>${project.client?.fullName || 'Client unavailable'} · ${project.client?.phone || 'No phone provided'} · ${project.client?.email || 'No email provided'}</p><p><strong>Shoot:</strong> ${formatStudioDate(project.shootDate)} ${project.startTime || ''}–${project.endTime || ''} · ${project.location || 'Location not specified'}</p><p><strong>Status:</strong> ${project.status}</p><p>${project.description || project.notes || 'No additional notes.'}</p><h3>Assigned team</h3><p>${(project.assignments || []).map((item) => `${item.assignmentRole}: ${item.user?.name || 'Unassigned'}`).join(' · ') || 'No team assigned yet.'}</p></div>`; content.querySelector('.calendar-back').addEventListener('click', renderMonth); };
    panel.querySelector('[data-calendar-view="month"]').addEventListener('click', renderMonth);
    panel.querySelector('[data-calendar-view="list"]').addEventListener('click', renderList);
    panel.addEventListener('click', (event) => { const button = event.target.closest('[data-project-id]'); if (button) showDetails(button.dataset.projectId); });
    renderMonth();
  } catch (error) { console.error(error); }
}

async function loadGalleryPanel(role) {
  if (!['superadmin', 'manager', 'editor'].includes(role)) return;
  try {
    const galleries = await requestJson('/api/galleries');
    const projects = await requestJson('/api/projects');
    const canManage = ['superadmin', 'manager'].includes(role) || role === 'editor';
    const createForm = canManage ? `<form class="management-form" data-gallery-form><select name="project" required><option value="">Choose project</option>${projects.map((project) => `<option value="${project._id}" data-client="${project.client?._id || project.client}">${project.title}</option>`).join('')}</select><input name="title" placeholder="Gallery title" required><input name="description" placeholder="Description"><button class="admin-button" type="submit">Create gallery</button><p class="management-status"></p></form>` : '';
    const panel = addDashboardPanel('Client Galleries', `${createForm}<div class="management-list">${galleries.length ? galleries.map((gallery) => `<div class="management-item"><span><strong>${gallery.title}</strong><small>${gallery.client?.fullName || 'Client unavailable'} · ${gallery.project?.title || 'Project unavailable'} · ${gallery.galleryStatus} · ${gallery.mediaStats.total} media · ${gallery.selectionStatus}</small></span><button data-gallery-review="${gallery._id}">Review</button></div>`).join('') : '<p class="management-empty">No galleries yet.</p>'}</div><div data-gallery-review-panel></div>`);
    panel.querySelector('[data-gallery-form]')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const values = Object.fromEntries(new FormData(form).entries());
      try { await requestJson(`/api/projects/${values.project}/create-gallery`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: values.title, description: values.description }) }); form.reset(); loadGalleryPanel(role); } catch (error) { form.querySelector('.management-status').textContent = error.message; }
    });
    panel.querySelectorAll('[data-gallery-review]').forEach((button) => button.addEventListener('click', async () => {
      const gallery = await requestJson(`/api/galleries/${button.dataset.galleryReview}`);
      const revisions = await requestJson(`/api/revisions/gallery/${button.dataset.galleryReview}`);
      const review = panel.querySelector('[data-gallery-review-panel]');
      review.innerHTML = `<div class="gallery-review"><h3>${gallery.title} · Selection: ${gallery.selectionStatus}</h3><p>Selected: ${gallery.mediaStats.selected} · Approved: ${gallery.mediaStats.approved} · Total: ${gallery.mediaStats.total}</p><select data-gallery-filter><option value="all">All</option><option value="selected">Selected</option><option value="not-selected">Not Selected</option><option value="approved">Approved</option></select><div class="management-list" data-gallery-items></div><h3>Revision Requests</h3><div class="management-list">${revisions.length ? revisions.map((revision) => `<div class="management-item"><span><strong>${revision.galleryItem?.title || 'Media item'}</strong><small>${revision.message} · ${revision.status}</small></span><select data-revision-id="${revision._id}"><option ${revision.status === 'open' ? 'selected' : ''}>open</option><option ${revision.status === 'in-progress' ? 'selected' : ''}>in-progress</option><option ${revision.status === 'completed' ? 'selected' : ''}>completed</option><option ${revision.status === 'cancelled' ? 'selected' : ''}>cancelled</option></select></div>`).join('') : '<p class="management-empty">No revision requests.</p>'}</div></div>`;
      const renderItems = (filter = 'all') => { const items = gallery.items.filter((item) => filter === 'all' || (filter === 'selected' && item.selected) || (filter === 'not-selected' && !item.selected) || (filter === 'approved' && item.approved)); review.querySelector('[data-gallery-items]').innerHTML = items.map((item) => `<div class="management-item"><span><strong>${item.title || 'Untitled media'}</strong><small>${item.type} · ${item.selected ? 'Selected' : 'Not selected'} · ${item.approved ? 'Approved' : 'Not approved'} · ${item.downloadable ? 'Downloadable' : 'Not downloadable'}</small></span><span class="management-actions"><button data-media-approve="${item._id}">${item.approved ? 'Approved' : 'Approve'}</button><button data-media-download="${item._id}">${item.downloadable ? 'Remove download' : 'Allow download'}</button></span></div>`).join('') || '<p class="management-empty">No media matches this filter.</p>'; };
      renderItems();
      review.querySelector('[data-gallery-filter]').addEventListener('change', (event) => renderItems(event.target.value));
      review.querySelectorAll('[data-revision-id]').forEach((select) => select.addEventListener('change', async () => { await requestJson(`/api/revisions/${select.dataset.revisionId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: select.value }) }); }));
      review.addEventListener('click', async (event) => { const approve = event.target.closest('[data-media-approve]'); const download = event.target.closest('[data-media-download]'); const item = gallery.items.find((entry) => entry._id === (approve?.dataset.mediaApprove || download?.dataset.mediaDownload)); if (!item) return; const updates = approve ? { approved: true } : { downloadable: !item.downloadable }; await requestJson(`/api/galleries/${gallery._id}/media/${item._id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) }); item[approve ? 'approved' : 'downloadable'] = updates[approve ? 'approved' : 'downloadable']; renderItems(review.querySelector('[data-gallery-filter]').value); });
    }));
  } catch (error) { console.error(error); }
}

async function loadClientPanel(role) {
  if (!['superadmin', 'manager'].includes(role)) return;
  try {
    const clients = await requestJson('/api/clients');
    const panel = addDashboardPanel('Client CRM', `<div class="management-form"><input type="search" data-client-search placeholder="Search name, phone or email"><select data-client-status><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select></div><div class="management-list">${clients.length ? clients.map((client) => `<div class="management-item"><span><strong>${client.fullName}</strong><small>${client.phone || 'No phone'} · ${client.email || 'No email'} · ${client.status || 'active'} · ${client.bookingCount || 0} bookings · ${client.projectCount || 0} projects</small></span><span class="management-actions"><button data-client-view="${client._id}">View</button><button data-client-edit="${client._id}">Edit</button></span></div>`).join('') : '<p class="management-empty">No clients yet.</p>'}</div>`);
    const searchInput = panel.querySelector('[data-client-search]');
    const statusInput = panel.querySelector('[data-client-status]');
    const updateList = () => {
      const search = normalize(searchInput.value);
      const status = statusInput.value;
      const filtered = clients.filter((client) => {
        const matchesText = !search || `${client.fullName} ${client.phone || ''} ${client.email || ''}`.toLowerCase().includes(search);
        const matchesStatus = status === 'all' || (client.status || 'active') === status;
        return matchesText && matchesStatus;
      });
      const list = panel.querySelector('.management-list');
      list.innerHTML = filtered.length ? filtered.map((client) => `<div class="management-item"><span><strong>${client.fullName}</strong><small>${client.phone || 'No phone'} · ${client.email || 'No email'} · ${client.status || 'active'} · ${client.bookingCount || 0} bookings · ${client.projectCount || 0} projects</small></span><span class="management-actions"><button data-client-view="${client._id}">View</button><button data-client-edit="${client._id}">Edit</button></span></div>`).join('') : '<p class="management-empty">No clients match the current filter.</p>';
      list.querySelectorAll('[data-client-view]').forEach((button) => button.addEventListener('click', async () => {
        const client = await requestJson(`/api/clients/${button.dataset.clientView}`);
        const history = await requestJson(`/api/clients/${button.dataset.clientView}/history`);
        const profile = panel.querySelector('[data-client-profile]') || document.createElement('div');
        profile.dataset.clientProfile = 'true';
        profile.innerHTML = `<div class="client-profile"><h3>${client.fullName}</h3><p>${client.phone || 'No phone provided'} · ${client.email || 'No email provided'}<br>${client.address || 'No address provided'}<br>${client.status || 'active'}</p><h4>Bookings</h4>${history.bookings.length ? history.bookings.map((booking) => `<div class="management-item"><span><strong>${booking.service?.name || 'Service unavailable'}</strong><small>${formatStudioDate(booking.preferredDate)} · ${booking.status}</small></span></div>`).join('') : '<p class="management-empty">No bookings yet.</p>'}<h4>Projects</h4>${history.projects.length ? history.projects.map((project) => `<div class="management-item"><span><strong>${project.title}</strong><small>${project.status} · ${project.location || 'Location not specified'}</small></span></div>`).join('') : '<p class="management-empty">No projects yet.</p>'}<h4>Galleries</h4>${history.galleries.length ? history.galleries.map((gallery) => `<div class="management-item"><span><strong>${gallery.title}</strong><small>${gallery.galleryStatus} · ${gallery.project?.title || 'Project unavailable'}</small></span></div>`).join('') : '<p class="management-empty">No galleries yet.</p>'}<h4>Revisions</h4>${history.revisions.length ? history.revisions.map((revision) => `<div class="management-item"><span><strong>${revision.galleryItem?.title || 'Media item'}</strong><small>${revision.message} · ${revision.status}</small></span></div>`).join('') : '<p class="management-empty">No revisions yet.</p>'}<h4>Timeline</h4>${history.timeline.length ? history.timeline.map((entry) => `<div class="management-item"><span><strong>${formatStudioDate(entry.date)}</strong><small>${entry.label} · ${entry.detail}</small></span></div>`).join('') : '<p class="management-empty">No activity yet.</p>'}</div>`;
        panel.appendChild(profile);
      }));
      list.querySelectorAll('[data-client-edit]').forEach((button) => button.addEventListener('click', async () => {
        const client = await requestJson(`/api/clients/${button.dataset.clientEdit}`);
        const fullName = window.prompt('Client name', client.fullName);
        const phone = window.prompt('Phone', client.phone || '');
        const email = window.prompt('Email', client.email || '');
        const address = window.prompt('Address', client.address || '');
        const notes = window.prompt('Notes', client.notes || '');
        const status = window.prompt('Status: active or inactive', client.status || 'active');
        if (!fullName) return;
        await requestJson(`/api/clients/${button.dataset.clientEdit}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fullName, phone, email, address, notes, status }) });
        loadClientPanel(role);
      }));
    };
    searchInput.addEventListener('input', updateList);
    statusInput.addEventListener('change', updateList);
    const normalize = (value) => (value || '').trim().toLowerCase();
    updateList();
  } catch (error) { console.error(error); }
}

loadCurrentAdmin().then(async (authenticated) => {
  if (authenticated !== false) {
    const role = document.querySelector('.dashboard-shell')?.dataset.role;
    await loadDashboardStats();
    if (['superadmin', 'manager'].includes(role)) { loadBookings(); loadDashboardManagement(); }
    loadStaffPanel(role);
    loadProjectPanel(role);
    loadCalendarPanel();
    loadGalleryPanel(role);
    loadClientPanel(role);
    loadWebsitePanel(role);
    loadAnalyticsPanel(role);
  }
});
