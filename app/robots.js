export default function robots() {
  return {
    rules: [{ userAgent: '*', allow: '/' }],
    sitemap: 'https://fdattendancechecker.vercel.app/sitemap.xml',
  };
}
