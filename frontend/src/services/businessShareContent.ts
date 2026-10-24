type CompanyShareRecord = {
  _id?: string;
  businessName?: string;
  isActive?: boolean;
  isOwner?: boolean;
  status?: string;
  publication?: { published?: boolean };
};

type ProductShareRecord = {
  _id?: string;
  name?: string;
  isActive?: boolean;
  companyId?: string | { _id?: string };
};

export type BusinessShareSource = 'owned' | 'public';

/** Public lists are filtered by the server; owner records need publication evidence. */
export function companyShareContent(company: CompanyShareRecord | null | undefined, source: BusinessShareSource = 'owned') {
  const id = typeof company?._id === 'string' ? company._id.trim() : '';
  if (!/^[a-f\d]{24}$/i.test(id) || company?.isActive === false || company?.publication?.published === false) return null;
  if (source === 'owned') {
    const published = company?.publication?.published === true
      || (company?.isActive === true && company?.status === 'active');
    if (!published) return null;
  } else if (company?.isOwner === true && company.status !== 'active') {
    // The public endpoint also permits an owner to preview a hidden company.
    return null;
  }
  return { path: `/network/company/${encodeURIComponent(id)}`, title: company?.businessName?.trim() || 'Company' };
}

/** Products open their public company catalogue; there is no public product-detail route. */
export function productShareContent(product: ProductShareRecord | null | undefined, company: CompanyShareRecord | null | undefined, source: BusinessShareSource = 'owned') {
  const companyContent = companyShareContent(company, source);
  if (!companyContent || !product?._id || product.isActive === false) return null;
  if (source === 'owned' && product.isActive !== true) return null;
  const owner = typeof product.companyId === 'object' ? product.companyId?._id : product.companyId;
  if (owner && owner !== company?._id) return null;
  return { path: companyContent.path, title: `${product.name?.trim() || 'Product'} at ${companyContent.title}` };
}
