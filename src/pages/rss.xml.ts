import type { APIRoute } from 'astro';
import { getMaterias, hrefMateria } from '../lib/materias';
import { autorPorNome } from '../data/autores';
import { LEMA, NOME_SITE } from '../data/site';

// Feed RSS 2.0 com as matérias mais recentes (só as aprovadas: getMaterias já aplica a trava do build).
// Serve o Google Publisher Center (seções por feed), leitores de RSS e o Google Notícias.
const LIMITE = 50;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const GET: APIRoute = async ({ site }) => {
	const base = new URL('/', site).href;
	const materias = (await getMaterias()).slice(0, LIMITE);

	const itens = materias
		.map((m) => {
			const url = new URL(hrefMateria(m), site).href;
			const descricao = m.subtitulo || `${m.quadro.nome} na ${NOME_SITE}`;
			return `    <item>
      <title>${esc(m.titulo)}</title>
      <link>${esc(url)}</link>
      <guid isPermaLink="true">${esc(url)}</guid>
      <pubDate>${m.data.toUTCString()}</pubDate>
      <dc:creator>${esc(autorPorNome(m.autor).nome)}</dc:creator>
      <category>${esc(m.quadro.nome)}</category>
      <description>${esc(descricao)}</description>${
				m.imagem ? `\n      <media:content url="${esc(new URL(m.imagem, site).href)}" medium="image" />` : ''
			}
    </item>`;
		})
		.join('\n');

	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>${esc(NOME_SITE)}</title>
    <link>${esc(base)}</link>
    <description>${esc(`${LEMA}. Mercado, bastidores, perfis e ensaios sobre música.`)}</description>
    <language>pt-BR</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${esc(base)}rss.xml" rel="self" type="application/rss+xml" />
    <image>
      <url>${esc(new URL('/logo-catarse.png', site).href)}</url>
      <title>${esc(NOME_SITE)}</title>
      <link>${esc(base)}</link>
    </image>
${itens}
  </channel>
</rss>
`;
	return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
};
