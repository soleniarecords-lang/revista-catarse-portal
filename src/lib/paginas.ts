import { getCollection } from 'astro:content';

const ORDEM = ['quem-somos', 'politica-editorial', 'contato'];

/**
 * Mesma trava das matérias: no build só entra página com `aprovado: true`, e página aprovada
 * com [CONFIRMAR] no texto derruba o build. No `npm run dev` aparecem todas.
 */
export async function getPaginas() {
	const lista = [];
	for (const p of await getCollection('paginas')) {
		const pendencias = (p.body ?? '').match(/\[CONFIRMAR/g)?.length ?? 0;
		if (import.meta.env.PROD) {
			if (!p.data.aprovado) continue;
			if (pendencias > 0) throw new Error(`página ${p.id}: aprovada, mas ainda tem ${pendencias} [CONFIRMAR]`);
		}
		lista.push({ ...p, pendencias });
	}
	return lista.sort((a, b) => ORDEM.indexOf(a.id) - ORDEM.indexOf(b.id));
}
