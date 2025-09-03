export default async function sitemap() {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://medius.example.com'
  const routes = ['', '/marketplace', '/cart', '/messages'].map((p) => ({ url: `${base}${p}`, lastModified: new Date().toISOString() }))
  return routes
}
