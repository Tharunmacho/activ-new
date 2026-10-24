import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { PublicShareButton } from './PublicShareButton';
import { BusinessShareSource, companyShareContent, productShareContent } from '../services/businessShareContent';

type Company = Parameters<typeof companyShareContent>[0];
type Product = Parameters<typeof productShareContent>[0];
type Options = { company: Company; source?: BusinessShareSource; compact?: boolean; appearance?: 'surface' | 'glass'; style?: StyleProp<ViewStyle> };

export function CompanyShareButton({ company, source = 'owned', compact, appearance, style }: Options) {
  const content = companyShareContent(company, source);
  return content ? <PublicShareButton {...content} compact={compact} appearance={appearance} style={style} /> : null;
}

export function ProductShareButton({ product, company, source = 'owned', compact, appearance, style }: Options & { product: Product }) {
  const content = productShareContent(product, company, source);
  return content ? <PublicShareButton {...content} compact={compact} appearance={appearance} style={style} /> : null;
}
