import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
	const base = new URL('/', site).href;
	const corpo = [
		'User-agent: *',
		'Allow: /',
		'',
		`Sitemap: ${base}sitemap-index.xml`,
		`Sitemap: ${base}sitemap-noticias.xml`,
		'',
	].join('\n');
	return new Response(corpo, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
