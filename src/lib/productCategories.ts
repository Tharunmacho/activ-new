/**
 * The categories a product may be filed under.
 *
 * Mirrors `backend/src/modules/members/productCategories.js`, which carries the
 * full account of why this exists. Kept as a local constant rather than fetched,
 * because a dropdown cannot wait on a request to render — but it is a mirror,
 * not an independent list: anything added here must be added there first.
 *
 * This site used to carry two lists of its own, and they did not even agree with
 * each other: "Add Product" offered nine values (Fashion, Home & Garden, Food &
 * Beverage, Books & Media, Toys & Games…) and "Edit Product" six (Clothing,
 * Home & Garden, Beauty & Personal Care…). A product created under a value the
 * edit form did not offer came back with an empty category select, so saving an
 * unrelated change to it wrote the category away.
 */
export const PRODUCT_CATEGORIES = [
    'Software',
    'Services',
    'Education',
    'Product',
    'Hardware',
    'Electronics',
    'Clothing',
    'Food',
    'Books',
    'Toys',
    'Furniture',
    'Sports',
    'Beauty',
    'Other',
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

/**
 * Match a stored value to one of the fourteen, or return '' when it is not one.
 *
 * Rows written before the lists were reconciled hold values no longer offered
 * ("Fashion", "Toys & Games"). Returning '' leaves the select empty and makes
 * the user choose, which is honest — silently mapping "Fashion" to "Clothing"
 * would save something they did not pick.
 */
export const normalizeProductCategory = (value?: string | null): string => {
    const raw = String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
    if (!raw) return '';
    return PRODUCT_CATEGORIES.find((category) => category.toLowerCase() === raw) || '';
};
