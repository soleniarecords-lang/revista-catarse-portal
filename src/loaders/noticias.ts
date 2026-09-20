import type { Loader } from 'astro/loaders';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { lerCabecalho } from './edicoes';

/**
 * Notícias diárias: noticias/AAAA-MM-DD/NN-slug.md
 *
 *   ---
 *   quadro: Mainstream
 *   titulo: ...
 *   subtitulo: ...
 *   data: 2026-09-19T10:30:00-03:00     ← preenchida na hora da aprovação (/catarse-publicar)
 *   aprovado: false
 *   fontes:
 *   - Billboard Brasil | https://...
 *   - Pitchfork | https://...
 *   ---
 *
 * Sem `data`, o rascunho usa o meio-dia (Brasília) da pasta do dia.
 */
export function noticiasLoader(baseDir: string): Loader {
	return {
		name: 'noticias-catarse',
		load: async ({ store, parseData, renderMarkdown, generateDigest, logger }) => {
			store.clear();
			let dias: string[] = [];
			try {
				dias = (await readdir(baseDir, { withFileTypes: true }))
					.filter((d) => d.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(d.name))
					.map((d) => d.name)
					.sort();
			} catch {
				return; // ainda não existe a pasta noticias/
			}

			for (const dia of dias) {
				const arquivos = (await readdir(path.join(baseDir, dia))).filter((f) => /^\d+-.+\.md$/.test(f)).sort();
				for (const arquivo of arquivos) {
					const bruto = await readFile(path.join(baseDir, dia, arquivo), 'utf8');
					const { dados, listas, corpo } = lerCabecalho(bruto);
					const [, ordem, slug] = arquivo.match(/^(\d+)-(.+)\.md$/) ?? [];
					if (!dados.titulo || !slug) {
						logger.warn(`noticias/${dia}/${arquivo}: sem titulo: ignorada`);
						continue;
					}
					const fontes = (listas.fontes ?? []).map((linha) => {
						const [nome, url] = linha.split('|').map((s) => s.trim());
						return { nome, url };
					});
					const id = `${dia}/${arquivo.replace(/\.md$/, '')}`;
					const parsed = await parseData({
						id,
						data: {
							quadro: dados.quadro || 'Mainstream',
							titulo: dados.titulo,
							subtitulo: dados.subtitulo ?? '',
							dia,
							ordem: Number(ordem),
							slug,
							data: dados.data || `${dia}T12:00:00-03:00`,
							fontes,
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
