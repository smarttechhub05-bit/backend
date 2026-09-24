const mongoose = require('mongoose');
const { WebsiteSettings, Testimonial, Promotion, MediaAsset, Service, Package, Gallery, GalleryItem } = require('../models');
const { uploadFile, deleteFile, getSignedUrl: generateSignedUrl } = require('../services/storageService');

const portfolioCategories = ['photography', 'videography', 'weddings', 'portraits', 'events', 'fashion', 'commercial', 'portfolio'];

const textFields = new Set([
  'businessName', 'tagline', 'description', 'logo', 'favicon', 'phone', 'WhatsApp', 'email', 'address', 'city', 'country',
  'businessHours', 'mapUrl', 'seoTitle', 'seoDescription', 'seoKeywords', 'socialSharingImage', 'homepageHero', 'aboutText', 'footerText'
]);
const nestedFields = {
  homepage: ['heroHeadline', 'heroSubheadline', 'heroImage', 'heroVideo', 'primaryButtonText', 'primaryButtonLink', 'secondaryButtonText', 'secondaryButtonLink', 'aboutHeading', 'aboutDescription', 'aboutImage', 'whyHeading', 'bookingCtaHeading', 'bookingCtaDescription'],
  about: ['heading', 'description', 'story', 'mission', 'vision', 'whyChooseUs', 'image'],
  footer: ['description', 'copyright', 'privacyLink', 'termsLink']
};

function clean(value, max = 1000) {
  return String(value ?? '').replace(/[<>]/g, '').trim().slice(0, max);
}

function cleanSettings(payload) {
  const output = {};
  for (const field of textFields) if (payload[field] !== undefined) output[field] = clean(payload[field]);
  for (const [group, fields] of Object.entries(nestedFields)) {
    if (!payload[group] || typeof payload[group] !== 'object') continue;
    output[group] = {};
    for (const field of fields) if (payload[group][field] !== undefined) output[group][field] = clean(payload[group][field]);
  }
  if (payload.socialLinks && typeof payload.socialLinks === 'object' && !Array.isArray(payload.socialLinks)) {
    output.socialLinks = Object.fromEntries(Object.entries(payload.socialLinks).slice(0, 12).map(([key, value]) => [clean(key, 40), clean(value, 500)]));
  }
  if (payload.published !== undefined) output.published = Boolean(payload.published);
  return output;
}

function cleanTestimonial(payload) {
  return {
    clientName: clean(payload.clientName, 120), content: clean(payload.content, 1000), clientImage: clean(payload.clientImage, 500),
    rating: Math.min(5, Math.max(1, Number(payload.rating) || 5)), active: payload.active !== false, featured: payload.featured === true,
    published: payload.published !== false, displayOrder: Math.max(0, Number(payload.displayOrder) || 0)
  };
}

function cleanPromotion(payload) {
  const startDate = payload.startDate ? new Date(payload.startDate) : null;
  const endDate = payload.endDate ? new Date(payload.endDate) : null;
  return {
    title: clean(payload.title, 120), description: clean(payload.description, 500), image: clean(payload.image, 500),
    startDate: startDate && !Number.isNaN(startDate.getTime()) ? startDate : null,
    endDate: endDate && !Number.isNaN(endDate.getTime()) ? endDate : null,
    active: payload.active === true, published: payload.published === true,
    buttonText: clean(payload.buttonText, 80), buttonLink: clean(payload.buttonLink, 500)
  };
}

function safeUrl(value) {
  const url = clean(value, 500);
  return /^\/(?!\/)|^https?:\/\//i.test(url) ? url : '';
}

async function getSettings() {
  return await WebsiteSettings.findOne().lean() || {
    businessName: 'Rap Eugene Studio', tagline: 'Capturing Moments. Creating Stories.', city: 'Limbe', country: 'Cameroon', socialLinks: {}
  };
}

async function getPublicContent(req, res, next) {
  try {
    const storedSettings = await getSettings();
    const settings = storedSettings.published === false ? {
      businessName: 'Rap Eugene Studio', tagline: 'Capturing Moments. Creating Stories.', city: 'Limbe', country: 'Cameroon', socialLinks: {}
    } : storedSettings;
    const now = new Date();
    const [testimonials, promotions, services, packages, publicGalleries, portfolioMedia] = await Promise.all([
      Testimonial.find({ active: true, published: true }).sort({ displayOrder: 1, createdAt: -1 }).select('clientName content rating clientImage featured displayOrder').lean(),
      Promotion.find({ active: true, published: true, $and: [{ $or: [{ startDate: null }, { startDate: { $lte: now } }] }, { $or: [{ endDate: null }, { endDate: { $gte: now } }] }] }).sort({ createdAt: -1 }).select('title description image buttonText buttonLink startDate endDate').lean(),
      Service.find({ active: true }).sort({ createdAt: -1 }).lean(),
      Package.find({ active: true }).populate('service', 'name category').sort({ createdAt: -1 }).lean(),
      Gallery.find({ accessStatus: 'public', galleryStatus: { $in: ['active', 'completed', 'ready'] }, accessRevokedAt: null }).select('title description coverImage project createdAt').populate('project', 'title projectType type').sort({ createdAt: -1 }).limit(30).lean(),
      MediaAsset.find({ usage: 'portfolio' }).select('title description altText url objectKey storageKey storageProvider mimeType category createdAt').sort({ createdAt: -1 }).limit(30).lean()
    ]);
    const resolveMediaUrl = async (url, provider, key) => provider === 'cloudflare-r2' && key ? generateSignedUrl(key) : safeUrl(url);
    const galleryPortfolio = await Promise.all(publicGalleries.map(async (gallery) => ({ ...gallery, coverImage: safeUrl(gallery.coverImage), items: await Promise.all((await GalleryItem.find({ gallery: gallery._id }).select('type fileUrl thumbnailUrl title description altText category mimeType storageProvider objectKey storageKey').sort({ createdAt: 1 }).limit(12).lean()).map(async (item) => ({ ...item, fileUrl: await resolveMediaUrl(item.fileUrl, item.storageProvider, item.objectKey || item.storageKey), thumbnailUrl: await resolveMediaUrl(item.thumbnailUrl, item.storageProvider, item.objectKey || item.storageKey) }))) })));
    const portfolio = [...galleryPortfolio, ...(portfolioMedia.length ? [{ title: 'Portfolio', description: '', project: null, items: await Promise.all(portfolioMedia.map(async (item) => ({ title: item.title, description: item.description, altText: item.altText, category: item.category, type: item.mimeType.startsWith('video/') ? 'video' : 'photo', fileUrl: await resolveMediaUrl(item.url, item.storageProvider, item.objectKey || item.storageKey), thumbnailUrl: await resolveMediaUrl(item.url, item.storageProvider, item.objectKey || item.storageKey), createdAt: item.createdAt }))) }] : [])];
    res.json({ success: true, data: { settings: { ...settings, updatedBy: undefined }, testimonials, promotions, services, packages, portfolio } });
  } catch (error) { next(error); }
}

async function getAdminSettings(req, res, next) {
  try { res.json({ success: true, data: await getSettings() }); } catch (error) { next(error); }
}

async function updateSettings(req, res, next) {
  try {
    const updates = cleanSettings(req.body);
    updates.updatedBy = req.user._id;
    const settings = await WebsiteSettings.findOneAndUpdate({}, { $set: updates }, { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }).lean();
    res.json({ success: true, message: 'Website content saved successfully.', data: settings });
  } catch (error) { next(error); }
}

async function listTestimonials(req, res, next) {
  try { res.json({ success: true, data: await Testimonial.find().sort({ displayOrder: 1, createdAt: -1 }).lean() }); } catch (error) { next(error); }
}
async function createTestimonial(req, res, next) {
  try { const data = cleanTestimonial(req.body); if (!data.clientName || !data.content) return res.status(400).json({ success: false, message: 'Client name and testimonial text are required.' }); data.updatedBy = req.user._id; res.status(201).json({ success: true, message: 'Testimonial created.', data: await Testimonial.create(data) }); } catch (error) { next(error); }
}
async function updateTestimonial(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid testimonial ID.' });
  try { const data = { ...cleanTestimonial(req.body), updatedBy: req.user._id }; const testimonial = await Testimonial.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true }); if (!testimonial) return res.status(404).json({ success: false, message: 'Testimonial not found.' }); res.json({ success: true, message: 'Testimonial updated.', data: testimonial }); } catch (error) { next(error); }
}
async function deleteTestimonial(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid testimonial ID.' });
  try { const testimonial = await Testimonial.findByIdAndUpdate(req.params.id, { active: false, published: false, updatedBy: req.user._id }, { new: true }); if (!testimonial) return res.status(404).json({ success: false, message: 'Testimonial not found.' }); res.json({ success: true, message: 'Testimonial unpublished.', data: testimonial }); } catch (error) { next(error); }
}

async function listPromotions(req, res, next) { try { res.json({ success: true, data: await Promotion.find().sort({ createdAt: -1 }).lean() }); } catch (error) { next(error); } }
async function createPromotion(req, res, next) { try { const data = cleanPromotion(req.body); if (!data.title) return res.status(400).json({ success: false, message: 'Promotion title is required.' }); data.updatedBy = req.user._id; res.status(201).json({ success: true, message: 'Promotion created.', data: await Promotion.create(data) }); } catch (error) { next(error); } }
async function updatePromotion(req, res, next) { if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid promotion ID.' }); try { const data = { ...cleanPromotion(req.body), updatedBy: req.user._id }; const promotion = await Promotion.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true }); if (!promotion) return res.status(404).json({ success: false, message: 'Promotion not found.' }); res.json({ success: true, message: 'Promotion updated.', data: promotion }); } catch (error) { next(error); } }
async function deletePromotion(req, res, next) { if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid promotion ID.' }); try { const promotion = await Promotion.findByIdAndUpdate(req.params.id, { active: false, published: false, updatedBy: req.user._id }, { new: true }); if (!promotion) return res.status(404).json({ success: false, message: 'Promotion not found.' }); res.json({ success: true, message: 'Promotion unpublished.', data: promotion }); } catch (error) { next(error); } }

async function listMedia(req, res, next) { try { res.json({ success: true, data: await MediaAsset.find().sort({ createdAt: -1 }).lean() }); } catch (error) { next(error); } }
async function uploadMedia(req, res, next) {
  if (!req.file) return res.status(400).json({ success: false, message: 'A supported media file is required.' });
  try {
    const requestedCategory = String(req.body.category || '').toLowerCase();
    const category = portfolioCategories.includes(requestedCategory) ? requestedCategory : 'portfolio';
    const stored = await uploadFile(req.file, { prefix: 'website', contentType: req.file.mimetype });
    const caption = req.body.caption || req.body.description || '';
    const asset = await MediaAsset.create({
      title: clean(req.body.title || req.file.originalname, 160),
      description: clean(caption || req.body.description || '', 1000),
      altText: clean(req.body.altText || caption || '', 250),
      url: stored.signedUrl || stored.url,
      objectKey: stored.objectKey || stored.key,
      storageKey: stored.objectKey || stored.key,
      storageProvider: stored.provider,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
      usage: ['general', 'hero', 'about', 'portfolio', 'promotion', 'testimonial'].includes(req.body.usage) ? req.body.usage : 'general',
      category,
      updatedBy: req.user._id
    });
    res.status(201).json({ success: true, message: 'Media uploaded.', data: asset });
  } catch (error) { next(error); }
}
async function deleteMedia(req, res, next) { if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid media ID.' }); try { const asset = await MediaAsset.findByIdAndDelete(req.params.id); if (!asset) return res.status(404).json({ success: false, message: 'Media asset not found.' }); await deleteFile(asset.objectKey || asset.storageKey); res.json({ success: true, message: 'Media asset deleted.' }); } catch (error) { next(error); } }

module.exports = { getPublicContent, getAdminSettings, updateSettings, listTestimonials, createTestimonial, updateTestimonial, deleteTestimonial, listPromotions, createPromotion, updatePromotion, deletePromotion, listMedia, uploadMedia, deleteMedia };
