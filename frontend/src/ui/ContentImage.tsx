import React, { useState } from 'react';
import { Image, type ImageProps, type ImageURISource } from 'react-native';
import { resolveMediaUrl } from '../config/api.config';
import { imageSource } from '../utils/imageSizing';

type ContentImageProps = Omit<ImageProps, 'source'> & { uri?: string | null; width?: number; onSourceLoad?: (source: ImageURISource) => void };

/** Cacheable, display-sized content with the original as a one-time fallback. */
export function ContentImage({ uri, width = 800, onError, onLoad, onSourceLoad, ...props }: ContentImageProps) {
  const original = resolveMediaUrl(typeof uri === 'string' ? uri : '');
  const optimized = imageSource(original, width);
  const [failedVariant, setFailedVariant] = useState('');
  const source = failedVariant === optimized.uri ? { uri: original } : optimized;
  return <Image {...props} source={source} onLoad={event => { onSourceLoad?.(source); onLoad?.(event); }} onError={event => {
    if (source.uri !== original) setFailedVariant(source.uri);
    else onError?.(event);
  }} />;
}
