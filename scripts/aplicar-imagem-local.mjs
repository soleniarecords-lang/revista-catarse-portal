// Aplica uma foto que o Luciano enviou (divulgação oficial do artista, foto própria) a uma matéria.
//   node scripts/aplicar-imagem-local.mjs <slug-da-materia> <caminho-da-foto> "<crédito completo>"
// Exemplo:
//   node scripts/aplicar-imagem-local.mjs ir-pro-pop-sem-trair-a-raiz ~/Downloads/tize.jpg "Foto: divulgação / Solenia Records"
// O slug é o nome do arquivo da matéria sem o número (edições), o slug do post (Substack) ou da notícia.
// Reduz para 1400 px, salva em public/imagens/<slug>/capa.jpg e grava imagem/credito no cabeçalho.
import sharp from 'sharp';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [, , slug, foto, credito] = process.argv;
if (!slug || !foto || !credito) {
	console.error('Uso: node scripts/aplicar-imagem-local.mjs <slug> <foto> "<crédito completo>"');
	process.exit(2);
}
if (/[—–]/.test(credito)) {
	console.error('O crédito não pode ter travessão (regra de escrita). Use vírgula ou barra.');
	process.exit(2);
}

// procura a matéria: edições, notícias ou curadoria do Substack
async function achar() {
	for (const raiz of [path.resolve(RAIZ, '../edicoes'), path.resolve(RAIZ, '../noticias')]) {
		for (const pasta of await readdir(raiz, { withFileTypes: true })) {
			if (!pasta.isDirectory()) continue;
			const dirs = [path.join(raiz, pasta.name), path.join(raiz, pasta.name, 'textos')];
			for (const d of dirs) {
				try {
					for (const f of await readdir(d)) if (f.endsWith('.md') && f.replace(/^\d+-/, '').replace(/\.md$/, '') === slug) return { md: path.join(d, f) };
				} catch {}
			}
		}
	}
	const cur = JSON.parse(await readFile(path.join(RAIZ, 'src/data/substack-curadoria.json'), 'utf8'));
	if (cur[slug] && typeof cur[slug] === 'object') return { substack: true };
	return null;
}

const alvo = await achar();
if (!alvo) {
	console.error(`Matéria "${slug}" não encontrada.`);
	process.exit(1);
}
const rel = `/imagens/${slug}/capa.jpg`;
await mkdir(path.join(RAIZ, 'public/imagens', slug), { recursive: true });
await sharp(path.resolve(foto)).rotate().resize({ width: 1400, withoutEnlargement: true }).flatten({ background: '#ffffff' }).jpeg({ quality: 76, mozjpeg: true, progressive: true }).toFile(path.join(RAIZ, 'public', rel));

if (alvo.md) {
	let t = (await readFile(alvo.md, 'utf8')).replace(/\r\n/g, '\n').replace(/^(imagem|credito|credito_url|licenca_url):.*\n/gm, '');
	t = t.replace(/^(subtitulo:.*)$/m, `$1\nimagem: ${rel}\ncredito: ${credito}`);
	await writeFile(alvo.md, t);
	console.log('gravado em', path.relative(path.resolve(RAIZ, '..'), alvo.md));
} else {
	const arq = path.join(RAIZ, 'src/data/substack-curadoria.json');
	const cur = JSON.parse(await readFile(arq, 'utf8'));
	cur[slug] = { ...cur[slug], imagem: rel, credito };
	delete cur[slug].credito_url;
	delete cur[slug].licenca_url;
	const linhas = Object.entries(cur).map(([k, v]) => `\t${JSON.stringify(k)}: ${typeof v === 'string' ? JSON.stringify(v) : `{ ${Object.entries(v).map(([a, b]) => `${JSON.stringify(a)}: ${JSON.stringify(b)}`).join(', ')} }`}`);
	await writeFile(arq, `{\n${linhas.join(',\n')}\n}\n`);
	console.log('gravado em substack-curadoria.json');
}
console.log('imagem:', rel);
