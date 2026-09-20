import type { APIRoute } from 'astro';
import { getMaterias, hrefMateria } from '../lib/materias';
import { JANELA_NOTICIAS_HORAS, NOME_SITE } from '../data/site';

// Sitemap de notícias (Google News). Pela especificação, só entram matérias publicadas nas
// últimas 48 horas: numa revista mensal ele fica vazio na maior parte do tempo, e isso é normal.
// O Google News também exige o cadastro da publicação no Google Publisher Center.
// A janela é medida no momento do build: rode o build de novo ao publicar uma notícia nova.
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const GET: APIRoute = async ({ site }) => {
	const limite = Date.now() - JANELA_NOTICIAS_HORAS * 3600_000;
	const recentes = (await getMaterias()).filter((m) => m.data.getTime() >= limite && m.data.getTime() <= Date.now());

	const itens = recentes
		.map(
			(m) => `  <url>
    <loc>${esc(new URL(hrefMateria(m), site).href)}</loc>
    <news:news>
      <news:publication>
        <news:name>${esc(NOME_SITE)}</news:name>
        <news:language>pt</news:language>
      </news:publication>
      <news:publication_date>${m.data.toISOString()}</news:publication_date>
      <news:title>${esc(m.titulo)}</news:title>
    </news:news>
  </url>`,
		)
		.join('\n');

	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${itens}
</urlset>
`;
	return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
