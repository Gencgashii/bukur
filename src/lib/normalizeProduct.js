// Normalises a product from the BUKUR Express API (server/lib/serializers.js)
// into the shape the storefront components expect. Shared by every page that
// fetches products directly, so there is exactly one mapping to keep in sync
// with the backend.
export function normalizeApiProduct(product) {
  const variant = product.variants?.[0];
  const priceCents =
    product.priceCents ??
    variant?.calculated_price?.calculated_amount ??
    variant?.prices?.[0]?.amount ??
    0;
  const option = product.options?.find((item) => item.title?.toLowerCase() === 'size');
  // Sizes come from the authoritative backend (`product.sizes`). They are NOT
  // fabricated. An empty list means the product has no configured sizes yet.
  const sizes =
    Array.isArray(product.sizes) && product.sizes.length
      ? product.sizes.map(String)
      : option?.values?.map((item) => item.value) || [];
  const images = (product.images?.map((image) => image.url) || []).filter(Boolean);
  const primary = product.thumbnail || images[0] || '';

  const tracks = Boolean(product.trackInventory);
  const stock = Number(product.stock ?? 0);
  const published = product.status ? product.status === 'published' : true;
  const inStock = published && (!tracks || stock > 0);

  return {
    id: product.id,
    name: product.title || product.name || 'Untitled',
    sku: product.sku || '',
    price: priceCents / 100,
    priceCents,
    image: primary,
    images: images.length ? images : [primary].filter(Boolean),
    description: product.description || '',
    category: product.category?.name || product.categories?.[0]?.name || 'Heels',
    categoryId: product.categoryId ?? product.category?.id ?? null,
    gender: 'Women',
    sizes,
    featured: Boolean(product.featured),
    newArrival: Boolean(product.newArrival),
    stock,
    trackInventory: tracks,
    inStock,
  };
}
