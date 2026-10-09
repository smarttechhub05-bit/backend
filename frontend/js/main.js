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

function siteImage(value, fallback) {
  return value && !/^(?:https?:)?\/\//i.test(value) ? value : fallback;
}

function setHeroImage(hero, value) {
  const fallback = 'assets/images/couple-portrait.jpeg';
  const imageUrl = value && !/^(?:https?:)?\/\//i.test(value) ? value : fallback;
  const preload = new Image();
  preload.onload = () => {
    hero.style.backgroundImage = `linear-gradient(90deg, rgba(12,20,19,.78), rgba(12,20,19,.13)), url("${imageUrl.replace(/"/g, '')}")`;
    hero.classList.remove('hero--image-pending');
  };
  preload.onerror = () => {
    if (imageUrl !== fallback) setHeroImage(hero, fallback);
    else hero.classList.remove('hero--image-pending');
  };
  preload.src = imageUrl;
}

function isPromotionMinimized(promotion) {
  try {
    return Boolean(localStorage.getItem(`rap-eugene-promotion-minimized:${promotion._id || promotion.title}`));
  } catch (error) {}
  return false;
}

function showPromotionNotification(promotion) {
  const notificationKey = `rap-eugene-promotion-minimized:${promotion._id || promotion.title}`;
  const notification = document.createElement('aside');
  notification.className = 'promotion-notification';
  notification.setAttribute('role', 'status');
  notification.setAttribute('aria-label', 'Studio promotion');
  const closeButton = document.createElement('button');
  closeButton.className = 'promotion-notification-close';
  closeButton.type = 'button';
  closeButton.setAttribute('aria-label', 'Minimize promotion');
  closeButton.textContent = '×';
  closeButton.addEventListener('click', () => {
    try { localStorage.setItem(notificationKey, 'minimized'); } catch (error) {}
    notification.hidden = true;
    launcher.hidden = false;
  });

  const launcher = document.createElement('button');
  launcher.className = 'promotion-launcher';
  launcher.type = 'button';
  launcher.setAttribute('aria-label', `View promotion: ${promotion.title}`);
  launcher.title = `View promotion: ${promotion.title}`;
  launcher.innerHTML = '<span class="promotion-launcher-icon" aria-hidden="true">%</span><span class="promotion-launcher-label">Offer</span>';
  launcher.addEventListener('click', () => {
    try { localStorage.removeItem(notificationKey); } catch (error) {}
    launcher.hidden = true;
    notification.hidden = false;
    closeButton.focus();
  });

  if (promotion.image) {
    const image = document.createElement('img');
    image.className = 'promotion-notification-image';
    image.src = siteImage(promotion.image, 'assets/images/studio.jpeg');
    image.alt = '';
    image.loading = 'lazy';
    notification.appendChild(image);
  }

  const copy = document.createElement('div');
  copy.className = 'promotion-notification-copy';
  const eyebrow = document.createElement('p');
  eyebrow.className = 'eyebrow';
  eyebrow.textContent = 'Studio promotion';
  const title = document.createElement('h2');
  title.textContent = promotion.title;
  copy.append(eyebrow, title);
  if (promotion.description) {
    const description = document.createElement('p');
    description.className = 'promotion-notification-description';
    description.textContent = promotion.description;
    copy.appendChild(description);
  }
  if (promotion.buttonText && promotion.buttonLink) {
    const link = document.createElement('a');
    link.className = 'promotion-notification-action';
    link.textContent = promotion.buttonText;
    link.href = promotion.buttonLink;
    copy.appendChild(link);
  }

  notification.append(copy, closeButton);
  notification.hidden = isPromotionMinimized(promotion);
  launcher.hidden = !notification.hidden;
  document.body.append(notification, launcher);
}

function catalogFallback(category) {
  const images = {
    Photography: 'studio-portrait.jpeg',
    Portraits: 'studio-portrait.jpeg',
    Weddings: 'couple-portrait.jpeg',
    Events: 'fashion-portrait.jpeg',
    Commercial: 'ceo.jpeg',
    Videography: 'studio.jpeg'
  };
  return `assets/images/${images[category] || 'studio.jpeg'}`;
}

function normalizeCameroonPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.startsWith('237') ? digits : `237${digits}`;
}

function setCurrentCopyright() {
  const year = '2020';
  document.querySelectorAll('.copyright-year').forEach((element) => { element.textContent = `© ${year} Rap Eugene Studio. All rights reserved.`; });
  document.querySelectorAll('.footer-bottom span:first-child:not(.copyright-year)').forEach((element) => { element.textContent = `© ${year} Rap Eugene Studio. All rights reserved.`; });
}

function renderPublicPortfolio(grid, portfolio) {
  if (!grid) return;
  const items = portfolio.flatMap((gallery) => gallery.items.map((item) => ({ ...item, category: String(item.category || gallery.project?.projectType || gallery.project?.type || 'portfolio').toLowerCase(), galleryTitle: gallery.title })));
  if (!items.length) { grid.replaceChildren(Object.assign(document.createElement('p'), { className: 'empty-state', textContent: 'No portfolio content has been published yet.' })); return; }
  const homepage = grid.classList.contains('portfolio-grid');
  const visibleItems = homepage ? items.slice(0, 8) : items;
  grid.replaceChildren(...visibleItems.map((item) => {
    const title = String(item.title || item.galleryTitle || item.category || 'Selected work').trim();
    const caption = String(item.caption || item.description || title).trim();
    const card = document.createElement(homepage ? 'a' : 'figure');
    card.dataset.category = String(item.category).replace(/[^a-z0-9-]/g, '');
    if (homepage) card.href = 'portfolio.html';
    const media = item.type === 'video' ? document.createElement('video') : document.createElement('img');
    media.src = item.type === 'video' ? item.fileUrl : item.thumbnailUrl || item.fileUrl;
    if (item.type === 'video') { media.controls = true; media.preload = 'metadata'; }
    else { media.alt = item.altText || title; media.loading = 'lazy'; }
    card.appendChild(media);
    if (homepage) {
      const label = document.createElement('span');
      label.className = 'portfolio-label';
      label.textContent = title;
      card.appendChild(label);
    } else {
      const captionElement = document.createElement('figcaption');
      captionElement.textContent = caption;
      card.appendChild(captionElement);
    }
    return card;
  }));
  grid.querySelectorAll('img').forEach((image) => { image.onerror = () => image.closest('figure')?.remove(); });
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
      if (hero) setHeroImage(hero, homepage.heroImage);
      const heroButtons = document.querySelectorAll('.hero-actions a');
      if (homepage.primaryButtonText && heroButtons[0]) { heroButtons[0].textContent = homepage.primaryButtonText; heroButtons[0].href = homepage.primaryButtonLink || 'booking.html'; }
      if (homepage.secondaryButtonText && heroButtons[1]) { heroButtons[1].textContent = homepage.secondaryButtonText; heroButtons[1].href = homepage.secondaryButtonLink || 'portfolio.html'; }
      setText('.about-copy h2', homepage.aboutHeading);
      setText('.about-copy p:last-of-type', homepage.aboutDescription);
      const aboutImage = document.querySelector('.about-image');
      if (aboutImage) aboutImage.src = siteImage(homepage.aboutImage, 'assets/images/ceo.jpeg');
      const serviceImages = [homepage.photographyImage, homepage.videographyImage, homepage.eventsImage, homepage.contentCreationImage];
      document.querySelectorAll('.service-grid .service-card img').forEach((image, index) => {
        const cardName = image.closest('.service-card')?.querySelector('h3')?.textContent.trim().toLowerCase();
        const catalogImage = content.services?.find((service) => service.name?.trim().toLowerCase() === cardName)?.image;
        const imageSource = serviceImages[index] || catalogImage;
        if (imageSource) image.src = siteImage(imageSource, image.src);
      });
      const testimonialGrid = document.querySelector('.testimonial-grid');
      if (testimonialGrid) {
        testimonialGrid.innerHTML = content.testimonials?.length ? content.testimonials.map((item) => `<figure class="testimonial"><blockquote></blockquote><cite></cite></figure>`).join('') : '<p class="empty-state">No testimonials have been added yet.</p>';
        testimonialGrid.querySelectorAll('.testimonial').forEach((item, index) => {
          const testimonial = content.testimonials[index];
          item.querySelector('blockquote').textContent = `“${testimonial.content}”`;
          const attribution = item.querySelector('cite');
          attribution.replaceChildren();
          if (testimonial.clientImage) {
            const image = document.createElement('img');
            image.className = 'testimonial-avatar';
            image.src = siteImage(testimonial.clientImage, 'assets/images/ceo.jpeg');
            image.alt = '';
            image.loading = 'lazy';
            attribution.appendChild(image);
          }
          const name = document.createElement('span');
          name.textContent = testimonial.clientName;
          attribution.appendChild(name);
        });
      }
    }
    const promotion = content.promotions?.[0];
    if (promotion) showPromotionNotification(promotion);
    if (page.endsWith('/about.html')) {
      setText('.page-hero h1', about.heading);
      setText('.about-copy h2', about.heading);
      const story = document.querySelector('.about-copy');
      if (story && about.description) story.querySelectorAll('p')[1].textContent = about.description;
      if (story && about.story) story.querySelectorAll('p')[2].textContent = about.story;
      const image = document.querySelector('.about-image'); if (image) image.src = siteImage(about.image, 'assets/images/ceo.jpeg');
    }
    if (page.endsWith('/contact.html')) {
      const phone = settings.phone || '+237 675 681 696';
      const email = settings.email || 'rapeugenstudio@gmail.com';
      const whatsapp = settings.WhatsApp || '237675681696';
      const phoneLink = document.querySelector('.contact-detail:nth-child(1) a');
      const emailLink = document.querySelector('.contact-detail:nth-child(2) a');
      const whatsappLink = document.querySelector('.contact-detail:nth-child(3) a');
      if (phoneLink) { phoneLink.textContent = phone; phoneLink.href = `tel:+${normalizeCameroonPhone(phone)}`; }
      if (emailLink) { emailLink.textContent = email; emailLink.href = `mailto:${email}`; }
      if (whatsappLink) { whatsappLink.textContent = settings.WhatsApp || phone; whatsappLink.href = `https://wa.me/${normalizeCameroonPhone(whatsapp)}`; }
      const values = [phone, email, whatsapp, [settings.address, settings.city, settings.country].filter(Boolean).join(', ') || 'Limbe, Cameroon', settings.businessHours || 'By appointment'];
      document.querySelectorAll('.contact-detail').forEach((detail, index) => { if (index > 2) { const value = detail.childNodes[1]; if (value && values[index]) value.textContent = values[index]; } });
    }
    if (page.endsWith('/portfolio.html')) renderPublicPortfolio(document.querySelector('.gallery-grid'), content.portfolio || []);
    if (page.endsWith('/index.html') || page === '/' || page.endsWith('/')) renderPublicPortfolio(document.querySelector('.portfolio-grid'), content.portfolio || []);
    document.querySelectorAll('meta[name="description"]').forEach((meta) => { if (settings.seoDescription) meta.content = settings.seoDescription; });
    if (settings.seoTitle) document.title = settings.seoTitle;
    const footer = document.querySelector('.site-footer');
    if (footer) {
      const footerCopy = footer.querySelector('.footer-brand p'); if (footerCopy && settings.footerText) footerCopy.textContent = settings.footerText;
      const contactText = footer.querySelector('.footer-grid > div:last-child'); if (contactText) { const lines = contactText.querySelectorAll('p'); if (lines[0] && settings.phone) lines[0].textContent = `Phone: ${settings.phone}`; if (lines[1] && settings.email) lines[1].textContent = `Email: ${settings.email}`; if (lines[2] && settings.WhatsApp) lines[2].textContent = `WhatsApp: ${settings.WhatsApp}`; if (lines[3]) lines[3].textContent = `Location: ${[settings.address, settings.city, settings.country].filter(Boolean).join(', ') || 'Limbe, Cameroon'}`; }
      const copyright = footer.querySelector('.footer-bottom span'); if (copyright && settings.footer?.copyright) copyright.textContent = settings.footer.copyright;
    }
  } catch (error) {
    document.querySelector('.hero--image-pending')?.classList.remove('hero--image-pending');
    console.error('Public CMS content unavailable:', error.message);
  }
}

function escapeMarkup(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));
}

function serviceCard(service, packages = []) {
  const image = siteImage(service.image, catalogFallback(service.category));
  const servicePackages = packages.filter((item) => String(item.service?._id || item.service || '') === String(service._id));
  const packageList = servicePackages.length ? servicePackages.map((item) => `<li class="service-package"><div><strong>${escapeMarkup(item.name)}</strong><p>${escapeMarkup(item.description || '')}</p><small>${item.price ? `${Number(item.price).toLocaleString()} XAF` : 'Price on enquiry'} · ${escapeMarkup(item.duration || 'Flexible duration')}</small></div><a class="text-link" href="booking.html?service=${encodeURIComponent(service._id)}&amp;package=${encodeURIComponent(item._id)}">Choose</a></li>`).join('') : '<li class="service-package-empty">Packages coming soon.</li>';
  return `<article class="service-card"><img src="${escapeMarkup(image)}" alt="${escapeMarkup(service.name)}"><div class="service-card-content"><h3>${escapeMarkup(service.name)}</h3><p>${escapeMarkup(service.description || 'A considered studio service shaped around your story.')}</p><a class="text-link" href="booking.html?service=${encodeURIComponent(service._id)}">Book this service</a><details class="service-packages"><summary><span>Packages</span><span class="service-package-count">${servicePackages.length}</span></summary><ul class="service-package-list">${packageList}</ul></details></div></article>`;
}

async function loadServicesPage() {
  if (!window.location.pathname.endsWith('/services.html')) return;
  const grid = document.querySelector('.service-grid');
  if (!grid) return;
  grid.classList.add('services-page-grid');
  const staticEventCard = [...grid.querySelectorAll('.service-card')].find((card) => card.querySelector('h3')?.textContent.trim() === 'Events');
  const staticEventImage = staticEventCard?.querySelector('img');
  if (staticEventImage) { staticEventImage.src = 'assets/images/studio.jpeg'; staticEventImage.alt = 'Rap Eugene Studio'; }
  try {
    const services = await getJson('/api/services');
    const packages = await getJson('/api/packages');
    if (services.length) grid.innerHTML = services.map((service) => serviceCard(service, packages)).join('');
    services.forEach((service) => trackAnalytics('service_view', service._id));
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
