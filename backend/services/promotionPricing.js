function isPromotionCurrent(promotion, now = new Date()) {
  if (!promotion || promotion.active === false || promotion.published === false) return false;
  if (promotion.startDate && new Date(promotion.startDate) > now) return false;
  if (promotion.endDate && new Date(promotion.endDate) < now) return false;
  return true;
}

function getPromotionDiscountPercentage(promotion) {
  const storedPercentage = Number(promotion?.discountPercentage) || 0;
  if (storedPercentage > 0) return Math.min(100, storedPercentage);
  const description = String(promotion?.description || '');
  const percentage = description.match(/\b(\d{1,3}(?:\.\d+)?)\s*%\s*(?:off|discount|reduction)\b/i)
    || description.match(/\b(?:discount|reduction|off)\s+(?:of\s+)?(\d{1,3}(?:\.\d+)?)\s*%/i);
  const parsed = Number(percentage?.[1]) || 0;
  return parsed > 0 && parsed <= 100 ? parsed : 0;
}

function normalizePromotion(promotion) {
  return { ...promotion, discountPercentage: getPromotionDiscountPercentage(promotion), serviceScope: promotion?.serviceScope || 'all', services: promotion?.services || [] };
}

function promotionAppliesToService(promotion, serviceId) {
  if (!promotion || promotion.serviceScope !== 'selected') return true;
  return (promotion.services || []).some((id) => String(id?._id || id) === String(serviceId));
}

function calculateDiscount(price, percentage) {
  const originalPrice = Math.max(0, Number(price) || 0);
  const discountPercentage = Math.min(100, Math.max(0, Number(percentage) || 0));
  const discountAmount = Math.round(originalPrice * discountPercentage / 100);
  return { originalPrice, discountPercentage, discountAmount, finalPrice: originalPrice - discountAmount };
}

module.exports = { isPromotionCurrent, getPromotionDiscountPercentage, normalizePromotion, promotionAppliesToService, calculateDiscount };