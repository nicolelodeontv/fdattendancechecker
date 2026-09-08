export default function sitemap() {
  const baseUrl = 'https://fdattendancechecker.vercel.app';
  return [
    { url: `${baseUrl}/`, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${baseUrl}/privacy`, lastModified: new Date('2026-09-09T00:00:00.000Z'), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/terms`, lastModified: new Date('2026-09-09T00:00:00.000Z'), changeFrequency: 'yearly', priority: 0.3 },
  ];
}
