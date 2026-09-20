import type { Loader } from 'astro/loaders';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const MESES: Record<string, number> = {
	janeiro: 0, fevereiro: 1, marco: 2, abril: 3, maio: 4, junho: 5,
	julho: 6, agosto: 7, setembro: 8, outubro: 9, novembro: 10, dezembro: 11,
};

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Cabeçalho `chave: valor` linha a linha. Não usa YAML de propósito: as skills escrevem
 * títulos como `A capa de AM: quando…` (dois-pontos sem aspas), que um parser YAML rejeita.
 */
export function lerCabecalho(texto: string): {
	dados: Record<string, string>;
	listas: Record<string, string[]>;
	corpo: string;
} {
	const limpo = texto.replace(/^﻿/, '').replace(/\r\n/g, '\n');
	const m = limpo.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
	if (!m) return { dados: {}, listas: {}, corpo: limpo };
	const dados: Record<string, string> = {};
	const listas: Record<string, string[]> = {};
	let chaveLista: string | null = null;
	for (const linha of m[1].split('\n')) {
		// item de lista ("- valor") pertence à última chave que ficou sem valor
		const item = linha.match(/^\s*-\s+(.*)$/);
		if (item && chaveLista) {
			listas[chaveLista].push(item[1].trim());
			continue;
		}
		const i = linha.indexOf(':');
		if (i < 1) continue;
		let v = linha.slice(i + 1).trim();
		if (/^(".*"|'.*')$/.test(v)) v = v.slice(1, -1);
		const chave = linha.slice(0, i).trim();
		dados[chave] = v;
		chaveLista = v === '' ? chave : null;
		if (chaveLista) listas[chaveLista] = [];
	}
	return { dados, listas, corpo: m[2] };
}

/** Data da edição = dia 1 do `mês:` da pauta (os textos não têm data própria). */
async function dataDaEdicao(dir: string): Promise<Date> {
	try {
		const { dados } = lerCabecalho(await readFile(path.join(dir, 'pauta.md'), 'utf8'));
		const [mes, ano] = semAcento(dados['mês'] ?? '').split('/');
		if (mes in MESES && ano) return new Date(Date.UTC(Number(ano), MESES[mes], 1, 12));
	} catch {}
	return new Date(Date.UTC(2026, 0, 1, 12));
}

export function edicoesLoader(baseDir: string): Loader {
	return {
		name: 'edicoes-catarse',
		load: async ({ store, parseData, renderMarkdown, generateDigest, logger }) => {
			store.clear();
			const pastas = (await readdir(baseDir, { withFileTypes: true }))
				.filter((d) => d.isDirectory() && /^edicao-\d+$/.test(d.name))
				.map((d) => d.name)
				.sort();

			for (const pasta of pastas) {
				const dirEdicao = path.join(baseDir, pasta);
				const dirTextos = path.join(dirEdicao, 'textos');
				const data = await dataDaEdicao(dirEdicao);
				let arquivos: string[] = [];
				try {
					arquivos = (await readdir(dirTextos)).filter((f) => f.endsWith('.md')).sort();
				} catch {
					continue; // edição só com pauta (ex.: 05)
				}
				for (const arquivo of arquivos) {
					const bruto = await readFile(path.join(dirTextos, arquivo), 'utf8');
					const { dados, corpo } = lerCabecalho(bruto);
					const [, ordem, resto] = arquivo.match(/^(\d+)-(.+)\.md$/) ?? [];
					if (!dados.titulo || !dados.quadro || !resto) {
						logger.warn(`${pasta}/${arquivo}: sem titulo/quadro/nome válido: ignorado`);
						continue;
					}
					const id = `${pasta}/${arquivo.replace(/\.md$/, '')}`;
					const parsed = await parseData({
						id,
						data: {
							quadro: dados.quadro,
							titulo: dados.titulo,
							subtitulo: dados.subtitulo ?? '',
							edicao: Number(pasta.replace('edicao-', '')),
							ordem: Number(ordem),
							slug: resto,
							data: dados.data ?? data,
							imagem: dados.imagem || undefined,
							credito: dados.credito || undefined,
							creditoUrl: dados.credito_url || undefined,
							licencaUrl: dados.licenca_url || undefined,
							autor: dados.autor || undefined,
							aprovado: dados.aprovado === 'true',
							pendencias: (corpo.match(/\[CONFIRMAR/g) ?? []).length,
						},
					});
					store.set({
						id,
						data: parsed,
						body: corpo,
						rendered: await renderMarkdown(corpo),
						digest: generateDigest(bruto),
					});
				}
			}
		},
	};
}
