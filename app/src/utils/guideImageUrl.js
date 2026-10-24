export function guideImageUrl(file) {
  const baseUrl = import.meta.env.BASE_URL || "/";
  const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const relativePath = `${normalizedBaseUrl}guide/${file}`;

  if (typeof window === "undefined") {
    return relativePath;
  }

  return new URL(relativePath, window.location.origin).toString();
}
