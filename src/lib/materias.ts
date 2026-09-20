import { getCollection, type CollectionEntry } from 'astro:content';
import { quadroPorNome, type Quadro } from '../data/quadros';
import postsSubstack from '../data/substack.json';
import curadoriaSubstack from '../data/substack-curadoria.json';

export interface Materia {
	id: string;
	slug: string;
	titulo: string;
	subtitulo: string;
	quadro: Quadro;
	origem: 'edicao' | 'substack' | 'noticia';
	edicao?: number; // só matérias das edições
	fontes?: { nome: string; url: string }[]; // só notícias diárias
	ordem: number;
	data: Date;
	imagem?: string;
	credito?: string;
	creditoUrl?: string; // página da imagem na fonte
	licencaUrl?: string; // licença da imagem
	autor: string;
	aprovado: boolean;
	pendencias: number;
	entry?: CollectionEntry<'materias'> | CollectionEntry<'noticias'>; // texto vindo de edicoes/ ou noticias/
	html?: string; // texto vindo do Substack (já limpo pelo importador)
	audio?: string; // episódio de podcast
	substackUrl?: string; // versão original no Substack, quando existe
}

interface PostSubstack {
	slug: string;
	titulo: string;
	subtitulo: string;
	data: string;
	link: string;
	autor: string;
	html: string;
	audio: string | null;
	duplicadoDe: string | null;
}
interface Curadoria {
	quadro?: string | null;
	aprovado?: boolean;
	imagem?: string;
	credito?: string;
	credito_url?: string;
	licenca_url?: string;
}

/**
 * Regra de publicação: no `npm run build` só entra matéria aprovada (`aprovado: true` no
 * cabeçalho do .md, ou em substack-curadoria.json para posts importados). Matéria aprovada
 * que ainda tenha [CONFIRMAR] no texto derruba o build. No `npm run dev` tudo aparece como rascunho.
 */
export async function getMaterias(): Promise<Materia[]> {
	const lista: Materia[] = [];
	const posts = postsSubstack as PostSubstack[];
	const curadoria = curadoriaSubstack as Record<string, Curadoria | string>;

	// post do Substack que já existe em edicoes/: a matéria da edição guarda o link do original
	const originalSubstack = new Map(posts.filter((p) => p.duplicadoDe).map((p) => [p.duplicadoDe as string, p.link]));

	for (const entry of await getCollection('materias')) {
		const d = entry.data;
		const quadro = quadroPorNome(d.quadro);
		if (!quadro) throw new Error(`${entry.id}: quadro desconhecido "${d.quadro}"`);
		lista.push({
			...d,
			id: entry.id,
			origem: 'edicao',
			quadro,
			entry,
			substackUrl: originalSubstack.get(entry.id),
		});
	}

	for (const entry of await getCollection('noticias')) {
		const d = entry.data;
		const quadro = quadroPorNome(d.quadro);
		if (!quadro) throw new Error(`noticias/${entry.id}: quadro desconhecido "${d.quadro}"`);
		if (import.meta.env.PROD && d.aprovado) {
			// regra editorial: nunca fonte única: pelo menos 2 veículos (domínios) diferentes
			const dominios = new Set(d.fontes.map((f) => new URL(f.url).hostname.replace(/^www\./, '')));
			if (dominios.size < 2) {
				throw new Error(
					`noticias/${entry.id}: notícia aprovada com ${dominios.size} fonte(s) de veículos diferentes: o mínimo é 2`,
				);
			}
		}
		lista.push({
			id: `noticias/${entry.id}`,
			slug: d.slug,
			titulo: d.titulo,
			subtitulo: d.subtitulo,
			quadro,
			origem: 'noticia',
			ordem: d.ordem,
			data: d.data,
			imagem: d.imagem,
			credito: d.credito,
			creditoUrl: d.creditoUrl,
			licencaUrl: d.licencaUrl,
			autor: d.autor,
			aprovado: d.aprovado,
			pendencias: d.pendencias,
			fontes: d.fontes,
			entry,
		});
	}

	for (const p of posts) {
		if (p.duplicadoDe) continue;
		const c = curadoria[p.slug];
		if (!c || typeof c === 'string' || !c.quadro) {
			console.warn(`[substack] "${p.slug}" sem quadro em substack-curadoria.json: fora do portal`);
			continue;
		}
		const quadro = quadroPorNome(c.quadro);
		if (!quadro) throw new Error(`substack/${p.slug}: quadro desconhecido "${c.quadro}"`);
		lista.push({
			id: `substack/${p.slug}`,
			slug: p.slug,
			titulo: p.titulo,
			subtitulo: p.subtitulo,
			quadro,
			origem: 'substack',
			ordem: 0,
			data: new Date(p.data),
			imagem: c.imagem,
			credito: c.credito,
			creditoUrl: c.credito_url,
			licencaUrl: c.licenca_url,
			autor: p.autor,
			aprovado: c.aprovado === true,
			pendencias: 0,
			html: p.html,
			audio: p.audio ?? undefined,
			substackUrl: p.link,
		});
	}

	const vistos = new Set<string>();
	const saida: Materia[] = [];
	for (const m of lista) {
		if (m.imagem && !m.credito) {
			throw new Error(`${m.id}: tem imagem mas não tem "credito": toda imagem exige crédito`);
		}
		if (vistos.has(m.slug)) throw new Error(`${m.id}: slug "${m.slug}" repetido`);
		vistos.add(m.slug);
		if (import.meta.env.PROD) {
			if (!m.aprovado) continue;
			if (m.pendencias > 0) {
				throw new Error(`${m.id}: aprovada, mas ainda tem ${m.pendencias} [CONFIRMAR] no texto`);
			}
		}
		saida.push(m);
	}

	// mais recente primeiro; dentro da edição, na ordem da revista
	return saida.sort((a, b) => b.data.getTime() - a.data.getTime() || a.ordem - b.ordem);
}

export const getPodcasts = async () => (await getMaterias()).filter((m) => m.audio);

const MES_ABREV = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
const MES_LONGO = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export const mesAbrev = (d: Date) => `${MES_ABREV[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
export const mesLongo = (d: Date) => `${MES_LONGO[d.getUTCMonth()]}/${d.getUTCFullYear()}`;
export const numEdicao = (n: number) => String(n).padStart(2, '0');
export const hrefMateria = (m: Pick<Materia, 'slug'>) => `/materia/${m.slug}/`;

/** Ano, mês (1-12) e dia no fuso de Brasília: as notícias são datadas com hora, e UTC erraria o dia à noite. */
function partesBRT(d: Date) {
	const p = Object.fromEntries(
		new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: 'numeric', day: 'numeric' })
			.formatToParts(d)
			.map((x) => [x.type, Number(x.value)]),
	);
	return { ano: p.year, mes: p.month, dia: p.day };
}

/** "2026-09-19" no fuso de Brasília. */
export function diaBRT(d: Date): string {
	const { ano, mes, dia } = partesBRT(d);
	return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/** "Edição 04 · AGO 2026" para matéria de edição; "19 SET 2026" para notícia e post do Substack. */
export function rotuloMeta(m: Pick<Materia, 'edicao' | 'data'>): string {
	if (m.edicao !== undefined) return `Edição ${numEdicao(m.edicao)} · ${mesAbrev(m.data)}`;
	const { ano, mes, dia } = partesBRT(m.data);
	return `${dia} ${MES_ABREV[mes - 1]} ${ano}`;
}

/** "sexta-feira, 19 de setembro": cabeçalho de cada dia na página de notícias. */
export function rotuloDia(d: Date): string {
	return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: 'numeric', month: 'long' }).format(d);
}
