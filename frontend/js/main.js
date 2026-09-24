const menuToggle = document.querySelector('.menu-toggle');
const navLinks = document.querySelector('.nav-links');

function analyticsSessionId() {
  try {
    let id = localStorage.getItem('rap_eugene_analytics_session');
    if (!id) { id = `${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`}`; localStorage.setItem('rap_eugene_analytics_session', id); }
    return id;
  } catch (error) { return `${Date.now()}-${Math.random()}`; }
}

function deviceType() {
  const width = window.innerWidth;
  return width < 700 ? 'mobile' : width < 1024 ? 'tablet' : 'desktop';
}

function trackAnalytics(eventType, service) {
  const payload = { eventType, page: window.location.pathname, sessionId: analyticsSessionId(), deviceType: deviceType(), referrer: document.referrer ? new URL(document.referrer).origin : '' };
  if (service) payload.service = service;
  fetch('/api/analytics/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), keepalive: true }).catch(() => {});
}

trackAnalytics('page_view');
document.addEventListener('click', (event) => {
  const link = event.target.closest('a');
  if (!link) return;
  if (link.href.startsWith('https://wa.me/')) trackAnalytics('whatsapp_click');
  if (link.href.startsWith('tel:')) trackAnalytics('phone_click');
});

if (menuToggle && navLinks) {
  menuToggle.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('is-open');
    menuToggle.setAttribute('aria-expanded', String(isOpen));
    menuToggle.textContent = isOpen ? '×' : '☰';
  });

  navLinks.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('is-open');
      menuToggle.setAttribute('aria-expanded', 'false');
      menuToggle.textContent = '☰';
    });
  });
}

async function getJson(url) {
  const response = await fetch(url);
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'Request failed');
  return result.data || [];
}

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element && value) element.textContent = value;
}

function setCurrentCopyright() {
  const year = '2020';
  document.querySelectorAll('.copyright-year').forEach((element) => { element.textContent = `© ${year} Rap Eugene Studio. All rights reserved.`; });
  document.querySelectorAll('.footer-bottom span:first-child:not(.copyright-year)').forEach((element) => { element.textContent = `© ${year} Rap Eugene Studio. All rights reserved.`; });
}

setCurrentCopyright();

async function loadPublicContent() {
  document.querySelectorAll('body *').forEach((element) => {
    if (element.childElementCount === 0 && element.textContent.includes('[placeholder]')) element.textContent = 'Not provided';
  });
  try {
    const content = await getJson('/api/website/public/content');
    const settings = content.settings || {};
    const homepage = settings.homepage || {};
    const about = settings.about || {};
    const page = window.location.pathname;
    if (page.endsWith('/index.html') || page === '/' || page.endsWith('/')) {
      setText('.hero h1', homepage.heroHeadline);
      setText('.hero-copy', homepage.heroSubheadline);
      const hero = document.querySelector('.hero');
      if (hero && homepage.heroImage) hero.style.backgroundImage = `url("${homepage.heroImage.replace(/"/g, '')}")`;
      const heroButtons = document.querySelectorAll('.hero-actions a');
      if (homepage.primaryButtonText && heroButtons[0]) { heroButtons[0].textContent = homepage.primaryButtonText; heroButtons[0].href = homepage.primaryButtonLink || 'booking.html'; }
      if (homepage.secondaryButtonText && heroButtons[1]) { heroButtons[1].textContent = homepage.secondaryButtonText; heroButtons[1].href = homepage.secondaryButtonLink || 'portfolio.html'; }
      setText('.about-copy h2', homepage.aboutHeading);
      setText('.about-copy p:last-of-type', homepage.aboutDescription);
      const aboutImage = document.querySelector('.about-image');
      if (aboutImage && homepage.aboutImage) aboutImage.src = homepage.aboutImage;
      const testimonialGrid = document.querySelector('.testimonial-grid');
      if (testimonialGrid) {
        testimonialGrid.innerHTML = content.testimonials?.length ? content.testimonials.map((item) => `<figure class="testimonial"><blockquote></blockquote><cite></cite></figure>`).join('') : '<p class="empty-state">No testimonials have been added yet.</p>';
        testimonialGrid.querySelectorAll('.testimonial').forEach((item, index) => { item.querySelector('blockquote').textContent = `“${content.testimonials[index].content}”`; item.querySelector('cite').textContent = content.testimonials[index].clientName; });
      }
      const promotion = content.promotions?.[0];
      if (promotion) {
        const band = document.createElement('section'); band.className = 'section section--cream cms-promotion'; band.innerHTML = '<div class="container"><p class="eyebrow">Studio promotion</p><h2></h2><p></p><a class="btn" hidden></a></div>';
        band.querySelector('h2').textContent = promotion.title; band.querySelector('p:not(.eyebrow)').textContent = promotion.description || '';
        const link = band.querySelector('a'); if (promotion.buttonText && promotion.buttonLink) { link.textContent = promotion.buttonText; link.href = promotion.buttonLink; link.hidden = false; }
        document.querySelector('main')?.insertBefore(band, document.querySelector('.cta-band'));
      }
    }
    if (page.endsWith('/about.html')) {
      setText('.page-hero h1', about.heading);
      setText('.about-copy h2', about.heading);
      const story = document.querySelector('.about-copy');
      if (story && about.description) story.querySelectorAll('p')[1].textContent = about.description;
      if (story && about.story) story.querySelectorAll('p')[2].textContent = about.story;
      const image = document.querySelector('.about-image'); if (image && about.image) image.src = about.image;
    }
    if (page.endsWith('/contact.html')) {
      const values = [settings.phone || 'Not provided', settings.email || 'Not provided', settings.WhatsApp || 'Not provided', [settings.address, settings.city, settings.country].filter(Boolean).join(', ') || 'Not provided', settings.businessHours || 'By appointment'];
      document.querySelectorAll('.contact-detail').forEach((detail, index) => { const value = detail.childNodes[1]; if (value && values[index]) value.textContent = values[index]; });
    }
    if (page.endsWith('/portfolio.html') && content.portfolio?.length) {
      const grid = document.querySelector('.gallery-grid');
      if (grid) {
        const items = content.portfolio.flatMap((gallery) => gallery.items.map((item) => ({ ...item, category: String(item.category || gallery.project?.projectType || gallery.project?.type || 'portfolio').toLowerCase(), galleryTitle: gallery.title })));
        if (items.length) {
          grid.innerHTML = items.map((item) => {
            const caption = String(item.caption || item.description || item.title || item.galleryTitle || 'Selected work').trim();
            return `<figure data-category="${String(item.category).replace(/[^a-z0-9-]/g, '')}"><img loading="lazy" src="${item.thumbnailUrl || item.fileUrl}" alt="${item.altText || item.title || item.galleryTitle || 'Portfolio image'}"><figcaption>${caption}</figcaption></figure>`;
          }).join('');
          grid.querySelectorAll('img').forEach((image) => { image.onerror = () => image.closest('figure')?.remove(); });
        }
      }
    }
    if (page.endsWith('/portfolio.html') && !content.portfolio?.some((gallery) => gallery.items?.length)) document.querySelector('.gallery-grid')?.replaceChildren(Object.assign(document.createElement('p'), { className: 'empty-state', textContent: 'No portfolio content has been published yet.' }));
    if ((page.endsWith('/index.html') || page === '/' || page.endsWith('/')) && !content.portfolio?.some((gallery) => gallery.items?.length)) document.querySelector('.portfolio-grid')?.replaceChildren(Object.assign(document.createElement('p'), { className: 'empty-state', textContent: 'No portfolio content has been published yet.' }));
    document.querySelectorAll('meta[name="description"]').forEach((meta) => { if (settings.seoDescription) meta.content = settings.seoDescription; });
    if (settings.seoTitle) document.title = settings.seoTitle;
    const footer = document.querySelector('.site-footer');
    if (footer) {
      const footerCopy = footer.querySelector('.footer-brand p'); if (footerCopy && settings.footerText) footerCopy.textContent = settings.footerText;
      const contactText = footer.querySelector('.footer-grid > div:last-child'); if (contactText) { const lines = contactText.querySelectorAll('p'); if (lines[0] && settings.phone) lines[0].textContent = `Phone: ${settings.phone}`; if (lines[1] && settings.email) lines[1].textContent = `Email: ${settings.email}`; if (lines[2] && settings.WhatsApp) lines[2].textContent = `WhatsApp: ${settings.WhatsApp}`; if (lines[3]) lines[3].textContent = `Location: ${[settings.address, settings.city, settings.country].filter(Boolean).join(', ') || 'Limbe, Cameroon'}`; }
      const copyright = footer.querySelector('.footer-bottom span'); if (copyright && settings.footer?.copyright) copyright.textContent = settings.footer.copyright;
    }
  } catch (error) { console.error('Public CMS content unavailable:', error.message); }
}

function serviceCard(service) {
  const image = service.image || 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=800&q=80';
  return `<article class="service-card"><img src="${image}" alt="${service.name}"><div class="service-card-content"><h3>${service.name}</h3><p>${service.description || 'A considered studio service shaped around your story.'}</p><a class="text-link" href="booking.html?service=${service._id}">Book this service</a></div></article>`;
}

async function loadServicesPage() {
  if (!window.location.pathname.endsWith('/services.html')) return;
  const grid = document.querySelector('.service-grid');
  if (!grid) return;
  try {
    const services = await getJson('/api/services');
    if (services.length) grid.innerHTML = services.map(serviceCard).join('');
    services.forEach((service) => trackAnalytics('service_view', service._id));
    const packageSection = document.createElement('section');
    packageSection.className = 'section';
    packageSection.innerHTML = '<div class="container"><div class="section-heading"><div><p class="eyebrow">Packages</p><h2>Simple options, thoughtfully shaped.</h2></div></div><div class="service-grid" data-packages-grid></div></div>';
    grid.closest('.section').after(packageSection);
    const packages = await getJson('/api/packages');
    const packageGrid = packageSection.querySelector('[data-packages-grid]');
    packageGrid.innerHTML = packages.length ? packages.map((item) => `<article class="service-card"><div class="service-card-content"><h3>${item.name}</h3><p>${item.description || 'A flexible package for your next project.'}</p><p>${item.price ? `${item.price.toLocaleString()} XAF` : 'Price on enquiry'} · ${item.duration || 'Flexible duration'}</p><a class="text-link" href="booking.html?service=${item.service?._id || ''}&package=${item._id}">Choose package</a></div></article>`).join('') : '<p>No packages published yet. Check back soon.</p>';
  } catch (error) {
    console.error(error);
  }
}

async function loadBookingOptions() {
  const form = document.querySelector('[data-demo-form]');
  if (!form || !window.location.pathname.endsWith('/booking.html')) return;
  form.dataset.bookingForm = 'true';
  trackAnalytics('booking_started');
  const serviceSelect = form.querySelector('[name="service"]');
  if (!serviceSelect) return;
  let packageSelect = form.querySelector('[name="package"]');
  if (!packageSelect) {
    packageSelect = document.createElement('select');
    packageSelect.name = 'package';
    packageSelect.id = 'package';
    packageSelect.innerHTML = '<option value="">Loading packages...</option>';
    packageSelect.disabled = true;
    const packageField = document.createElement('div');
    packageField.className = 'form-field';
    packageField.innerHTML = '<label for="package">Package</label>';
    packageField.appendChild(packageSelect);
    serviceSelect.closest('.form-field').after(packageField);
  }
  try {
    const services = await getJson('/api/services');
    serviceSelect.innerHTML = '<option value="">Choose a service</option>' + services.map((item) => `<option value="${item._id}">${item.name}${item.price ? ` - ${item.price.toLocaleString()} XAF` : ''}${item.duration ? ` (${item.duration})` : ''}</option>`).join('');
    const packages = await getJson('/api/packages');
    const updatePackages = () => {
      const selected = packages.filter((item) => item.service && item.service._id === serviceSelect.value);
        packageSelect.innerHTML = '<option value="">No package selected</option>' + selected.map((item) => `<option value="${item._id}">${item.name}${item.price ? ` - ${item.price.toLocaleString()} XAF` : ''}${item.duration ? ` (${item.duration})` : ''}</option>`).join('');
        packageSelect.disabled = selected.length === 0;
    };
    serviceSelect.addEventListener('change', updatePackages);
    const query = new URLSearchParams(window.location.search);
    if (query.get('service') && services.some((item) => item._id === query.get('service'))) serviceSelect.value = query.get('service');
    updatePackages();
    if (query.get('package') && packages.some((item) => item._id === query.get('package'))) packageSelect.value = query.get('package');
  } catch (error) {
    console.error(error);
    packageSelect.innerHTML = '<option value="">Packages unavailable</option>';
    packageSelect.disabled = true;
  }
}

async function showBookingConfirmation(form, booking) {
  let contact = {};
  try { contact = await getJson('/api/public-contact'); } catch (error) { console.error(error); }
  const phone = String(contact.phone || '').trim();
  const whatsapp = String(contact.whatsapp || phone).replace(/[^\d]/g, '');
  const message = `Hello, this is Rap Eugene Studio. I submitted a booking request for ${booking.data?.service?.name || 'a session'}.`;
  const actions = `${whatsapp ? `<a class="btn" target="_blank" rel="noopener" href="https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}">Chat on WhatsApp</a>` : ''}${phone ? `<a class="btn btn--outline" href="tel:${phone.replace(/[^\d+]/g, '')}">Call the Studio</a>` : ''}`;
  form.innerHTML = `<div class="message-panel"><p class="eyebrow">Booking request received</p><h2>Thank you for choosing Rap Eugene Studio.</h2><p>Your booking request has been received successfully. Our team will contact you to confirm availability, discuss the details of your session, and arrange payment where applicable.</p>${actions ? `<div class="form-actions">${actions}</div>` : '<p>Our team will contact you using the details you provided.</p>'}</div>`;
}

async function loadPublicGallery() {
  const galleryRoot = document.querySelector('[data-public-gallery]');
  if (!galleryRoot) return;
  const token = new URLSearchParams(window.location.search).get('token');
  if (!token) return;
  try {
    const response = await fetch(`/api/gallery-access/${encodeURIComponent(token)}`);
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Gallery unavailable.');
    const gallery = result.data;
    const selectionLabel = gallery.selectionLimit === null ? `Selected: ${gallery.selectedCount}` : `Selected: ${gallery.selectedCount} / ${gallery.selectionLimit}`;
    galleryRoot.innerHTML = `<div class="gallery-client-head"><p class="eyebrow">Private client gallery</p><h2>${gallery.title}</h2><p>${gallery.project?.title || ''} · ${gallery.client?.fullName || ''}</p><p>${gallery.description || ''}</p><div class="gallery-selection-bar"><strong data-selection-count>${selectionLabel}</strong><span data-selection-status>${gallery.selectionStatus}</span><button class="btn" type="button" data-submit-selection>Submit Selection</button></div></div><div class="gallery-media-grid">${gallery.items.map((item) => { const source = item.editedFileUrl || item.fileUrl; const action = gallery.selectionStatus === 'submitted' ? '' : `<button class="gallery-action" data-select-item="${item._id}">${item.selected ? '★ Selected' : '☆ Select'}</button>`; const revision = `<button class="gallery-action" data-revision-item="${item._id}">Request Revision</button>`; const approve = item.editedFileUrl && !item.approved ? `<button class="gallery-action" data-approve-item="${item._id}">Approve Final</button>` : ''; const download = item.downloadable ? `<a class="gallery-action" href="/api/gallery-workflow/${encodeURIComponent(token)}/items/${item._id}/download">Download</a>` : ''; return item.type === 'video' ? `<figure><video controls preload="metadata" src="${source}"></video><figcaption>${item.title || 'Video'} ${action}${revision}${approve}${download}</figcaption></figure>` : `<figure><img loading="lazy" src="${source}" alt="${item.title || 'Gallery image'}"><figcaption>${item.title || 'Photo'} ${action}${revision}${approve}${download}</figcaption></figure>`; }).join('')}</div>`;
    const updateCount = (data) => { galleryRoot.querySelector('[data-selection-count]').textContent = data.selectionLimit === null ? `Selected: ${data.selectedCount}` : `Selected: ${data.selectedCount} / ${data.selectionLimit}`; };
    galleryRoot.querySelectorAll('[data-select-item]').forEach((button) => button.addEventListener('click', async () => {
      const selected = button.textContent.includes('Selected');
      const endpoint = `/api/gallery-workflow/${encodeURIComponent(token)}/items/${button.dataset.selectItem}/${selected ? 'unselect' : 'select'}`;
      const response = await fetch(endpoint, { method: 'POST' });
      const result = await response.json();
      if (!response.ok) { window.alert(result.message); return; }
      updateCount(result.data); button.textContent = selected ? '☆ Select' : '★ Selected';
    }));
    galleryRoot.querySelector('[data-submit-selection]')?.addEventListener('click', async () => {
      if (!window.confirm(`You have selected ${gallery.selectedCount} item(s). Submit these selections to the studio?`)) return;
      const response = await fetch(`/api/gallery-workflow/${encodeURIComponent(token)}/submit-selection`, { method: 'POST' });
      const result = await response.json();
      if (!response.ok) { window.alert(result.message); return; }
      galleryRoot.querySelector('[data-selection-status]').textContent = result.data.selectionStatus;
      galleryRoot.querySelector('[data-submit-selection]').disabled = true;
    });
    galleryRoot.querySelectorAll('[data-revision-item]').forEach((button) => button.addEventListener('click', async () => {
      const message = window.prompt('What should be revised?');
      if (!message) return;
      const response = await fetch(`/api/gallery-workflow/${encodeURIComponent(token)}/items/${button.dataset.revisionItem}/revisions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }) });
      const result = await response.json();
      window.alert(result.message);
    }));
    galleryRoot.querySelectorAll('[data-approve-item]').forEach((button) => button.addEventListener('click', async () => {
      const response = await fetch(`/api/gallery-workflow/${encodeURIComponent(token)}/items/${button.dataset.approveItem}/approve`, { method: 'POST' });
      const result = await response.json();
      if (!response.ok) { window.alert(result.message); return; }
      button.textContent = 'Approved'; button.disabled = true;
    }));
  } catch (error) {
    galleryRoot.innerHTML = `<div class="message-panel"><p class="eyebrow">Private gallery</p><h2>${error.message}</h2><p>This gallery may still be preparing or its access may have been revoked.</p></div>`;
  }
}

function bindBookingForm() {
  document.querySelectorAll('form[data-demo-form]').forEach((form) => {
    form.closest('.form-layout')?.querySelector('.form-intro p:last-of-type')?.replaceChildren('Share a few details and the studio will contact you to discuss availability and your session.');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const status = form.querySelector('.form-status');
      if (!form.dataset.bookingForm) {
        const formData = new FormData(form);
        try {
          const response = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(formData.entries())) });
          const result = await response.json();
          if (!response.ok) throw new Error(result.message || 'Message could not be sent.');
          status.textContent = result.message;
          form.reset();
        } catch (error) { status.textContent = error.message; }
        return;
      }
      const formData = new FormData(form);
      const payload = Object.fromEntries(formData.entries());
      payload.fullName = payload.fullName || payload.name;
      payload.preferredDate = payload.preferredDate || payload.date;
      payload.preferredTime = payload.preferredTime || payload.time;
      payload.eventType = payload.eventType || payload.event;
      delete payload.name;
      delete payload.date;
      delete payload.time;
      delete payload.event;
      try {
        const response = await fetch('/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Booking request failed');
        trackAnalytics('booking_submitted');
        await showBookingConfirmation(form, result);
      } catch (error) {
        status.textContent = error.message;
      }
    });
  });
}

document.querySelectorAll('[data-filter]').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-filter]').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    const selected = button.dataset.filter;
    document.querySelectorAll('[data-category]').forEach((item) => { item.hidden = selected !== 'all' && item.dataset.category !== selected; });
  });
});

loadServicesPage();
loadBookingOptions().then(bindBookingForm);
loadPublicGallery();
loadPublicContent();
