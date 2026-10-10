function isPromotionCurrent(promotion, now = new Date()) {
  if (!promotion || promotion.active === false || promotion.published === false) return false;
  if (promotion.startDate && new Date(promotion.startDate) > now) return false;
  if (promotion.endDate && new Date(promotion.endDate) < now) return false;
  return Number(promotion.discountPercentage) > 0;
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

module.exports = { isPromotionCurrent, promotionAppliesToService, calculateDiscount };