const mongoose = require('mongoose');

const websiteSettingsSchema = new mongoose.Schema({
  businessName: { type: String, default: 'Rap Eugene Studio' },
  tagline: { type: String, default: 'Capturing Moments. Creating Stories.' },
  description: { type: String, default: '' },
  logo: { type: String, default: '' },
  favicon: { type: String, default: '' },
  phone: { type: String, default: '' },
  WhatsApp: { type: String, default: '' },
  email: { type: String, default: '' },
  address: { type: String, default: '' },
  city: { type: String, default: 'Limbe' },
  country: { type: String, default: 'Cameroon' },
  socialLinks: { type: Map, of: String, default: {} },
  homepageHero: { type: String, default: '' },
  aboutText: { type: String, default: '' },
  footerText: { type: String, default: '' },
  businessHours: { type: String, default: '' },
  mapUrl: { type: String, default: '' },
  seoTitle: { type: String, default: '' },
  seoDescription: { type: String, default: '' },
  seoKeywords: { type: String, default: '' },
  socialSharingImage: { type: String, default: '' },
  homepage: {
    heroHeadline: { type: String, default: '' },
    heroSubheadline: { type: String, default: '' },
    heroImage: { type: String, default: '' },
    heroVideo: { type: String, default: '' },
    primaryButtonText: { type: String, default: '' },
    primaryButtonLink: { type: String, default: '' },
    secondaryButtonText: { type: String, default: '' },
    secondaryButtonLink: { type: String, default: '' },
    aboutHeading: { type: String, default: '' },
    aboutDescription: { type: String, default: '' },
    aboutImage: { type: String, default: '' },
    whyHeading: { type: String, default: '' },
    bookingCtaHeading: { type: String, default: '' },
    bookingCtaDescription: { type: String, default: '' }
  },
  about: {
    heading: { type: String, default: '' },
    description: { type: String, default: '' },
    story: { type: String, default: '' },
    mission: { type: String, default: '' },
    vision: { type: String, default: '' },
    whyChooseUs: { type: String, default: '' },
    image: { type: String, default: '' }
  },
  footer: {
    description: { type: String, default: '' },
    copyright: { type: String, default: '' },
    privacyLink: { type: String, default: '' },
    termsLink: { type: String, default: '' }
  },
  published: { type: Boolean, default: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

module.exports = mongoose.model('WebsiteSettings', websiteSettingsSchema);
