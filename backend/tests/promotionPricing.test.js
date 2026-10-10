const test = require('node:test');
const assert = require('node:assert/strict');
const { isPromotionCurrent, promotionAppliesToService, calculateDiscount } = require('../services/promotionPricing');

test('promotion date and publication state determine whether it is current', () => {
  const now = new Date('2026-10-10T12:00:00Z');
  assert.equal(isPromotionCurrent({ active: true, published: true, discountPercentage: 20, startDate: '2026-10-01', endDate: '2026-10-20' }, now), true);
  assert.equal(isPromotionCurrent({ active: true, published: false, discountPercentage: 20 }, now), false);
  assert.equal(isPromotionCurrent({ active: true, published: true, discountPercentage: 20, endDate: '2026-10-09' }, now), false);
  assert.equal(isPromotionCurrent({ active: true, published: true, discountPercentage: 0 }, now), false);
});

test('all-service and selected-service promotion eligibility is enforced', () => {
  assert.equal(promotionAppliesToService({ serviceScope: 'all' }, 'service-a'), true);
  assert.equal(promotionAppliesToService({ serviceScope: 'selected', services: ['service-a'] }, 'service-a'), true);
  assert.equal(promotionAppliesToService({ serviceScope: 'selected', services: ['service-a'] }, 'service-b'), false);
});

test('discount calculation returns original, rounded savings, and final price', () => {
  assert.deepEqual(calculateDiscount(100000, 20), { originalPrice: 100000, discountPercentage: 20, discountAmount: 20000, finalPrice: 80000 });
  assert.deepEqual(calculateDiscount(9999, 15), { originalPrice: 9999, discountPercentage: 15, discountAmount: 1500, finalPrice: 8499 });
  assert.deepEqual(calculateDiscount(5000, 100), { originalPrice: 5000, discountPercentage: 100, discountAmount: 5000, finalPrice: 0 });
});
