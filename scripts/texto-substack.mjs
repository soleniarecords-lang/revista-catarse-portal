// Gera o texto pronto para o Luciano COLAR na Substack (sem automação de navegador).
//   node scripts/texto-substack.mjs ../noticias/2026-09-19/01-slug.md [...]
// Saída: noticias/<dia do primeiro arquivo>/para-substack.md. Reproduz o texto aprovado sem alterá-lo.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lerCabecalho } from '../src/loaders/edicoes.ts';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arquivos = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!arquivos.length) {
	console.error('Uso: node scripts/texto-substack.mjs <noticia.md> [...]');
	process.exit(2);
}

let config = {};
try {
	config = JSON.parse(await readFile(path.join(RAIZ, 'publicar.config.json'), 'utf8'));
} catch {}
const siteUrl = (config.siteUrl || (config.projeto ? `https://${config.projeto}.pages.dev` : '')).replace(/\/$/, '');

let md = `# Texto para colar na Substack\n\nCada bloco abaixo é uma notícia. Cole título, subtítulo e corpo no editor da Substack.\n`;
for (const a of arquivos) {
	const caminho = path.resolve(a);
	const { dados, listas, corpo } = lerCabecalho(await readFile(caminho, 'utf8'));
	if (dados.aprovado !== 'true') {
		console.error(`✗ ${a} não está aprovada — não gero texto de rascunho.`);
		process.exit(1);
	}
	const slug = path.basename(caminho).replace(/^\d+-/, '').replace(/\.md$/, '');
	md += `\n---\n\n## ${dados.titulo}\n\n*${dados.subtitulo}*\n\n${corpo.trim()}\n\n`;
	md += `**Fontes:**\n${(listas.fontes ?? []).map((f) => { const [n, u] = f.split('|').map((s) => s.trim()); return `- [${n}](${u})`; }).join('\n')}\n`;
	if (siteUrl) md += `\nPublicado originalmente no portal: ${siteUrl}/materia/${slug}/\n`;
}

// grava na pasta do dia da primeira notícia (ao lado dos arquivos de entrada)
const saida = path.join(path.dirname(path.resolve(arquivos[0])), 'para-substack.md');
await writeFile(saida, md);
console.log(`→ ${saida}`);
