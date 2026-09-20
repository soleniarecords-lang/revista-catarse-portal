import type { APIRoute } from 'astro';
import { getMaterias, hrefMateria, rotuloMeta } from '../lib/materias';

// Índice da busca do site (carregado só quando a pessoa abre a busca). Gerado no build a partir de getMaterias(),
// então respeita a trava de aprovação: rascunho nunca entra. Campos curtos para o arquivo ficar pequeno:
//   t título, s subtítulo, q quadro, c cor do quadro, d rótulo de data, u endereço, p 1 se for podcast, x começo do texto
const limpar = (s: string) =>
	s
		.replace(/<[^>]+>/g, ' ')
		.replace(/[#*_`>\[\]()|]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();

export const GET: APIRoute = async () => {
	const materias = await getMaterias();
	const indice = materias.map((m) => ({
		t: m.titulo,
		s: m.subtitulo,
		q: m.quadro.nome,
		c: m.quadro.cor,
		d: rotuloMeta(m),
		u: hrefMateria(m),
		p: m.audio ? 1 : 0,
		x: limpar(m.entry?.body ?? m.html ?? '').slice(0, 2400),
	}));
	return new Response(JSON.stringify(indice), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};
