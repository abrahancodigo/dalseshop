import { useState } from "react";
import manifest from "@/data/image-manifest.json";
import { readResponsiveImage, imageURLWithoutMetadata } from "@/lib/responsiveImage.mjs";

export function getImageMetadata(src) { return readResponsiveImage(src) || manifest[src]; }

export default function StoreImage({ src, sizes = "100vw", loading = "lazy", onError, ...props }) {
  const [failedSource, setFailedSource] = useState(null);
  const asset = failedSource === src ? null : getImageMetadata(src);
  return (
    <img
      {...props}
      src={asset?.src || imageURLWithoutMetadata(src)}
      srcSet={asset?.variants.map((variant) => `${variant.src} ${variant.width}w`).join(", ")}
      sizes={asset ? sizes : undefined}
      width={props.width || asset?.width}
      height={props.height || asset?.height}
      loading={loading}
      decoding="async"
      onError={(event) => {
        if (asset) { setFailedSource(src); return; }
        onError?.(event);
      }}
    />
  );
}
