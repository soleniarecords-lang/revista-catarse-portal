// Aplica as fotos escolhidas em imagens-candidatas.md/.html: baixa da Wikimedia Commons, reduz para 1600 px,
// salva em public/imagens/<slug>/capa.jpg e grava imagem/credito/credito_url/licenca_url no cabeçalho da
// matéria (edições) ou em src/data/substack-curadoria.json (posts do Substack). Só aceita CC0, domínio público,
// CC BY e CC BY-SA, e só com autor identificado.
//   node scripts/aplicar-imagens-commons.mjs          (aplica)
//   node scripts/aplicar-imagens-commons.mjs --seco   (só confere metadados, não baixa nem grava)
import sharp from 'sharp';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EDICOES = path.resolve(RAIZ, '../edicoes');
const CURADORIA = path.join(RAIZ, 'src/data/substack-curadoria.json');
const seco = process.argv.includes('--seco');

// ordem = seções de imagens-candidatas.md; `foto` = número escolhido (null = não aplicar)
const ALVOS = [
	{ nome: 'Harry Styles', arquivo: 'edicao-03/textos/01-harry-styles-sao-paulo-retorno-estadio-lotado.md', slug: 'harry-styles-sao-paulo-retorno-estadio-lotado', foto: 2 },
	{ nome: 'Ariana Grande', arquivo: 'edicao-03/textos/02-ariana-grande-petal-reinvencao-estrategia.md', slug: 'ariana-grande-petal-reinvencao-estrategia', foto: 2 },
	{ nome: 'ENHYPEN', arquivo: 'edicao-03/textos/03-enhypen-sao-paulo-industria-cultural.md', slug: 'enhypen-sao-paulo-industria-cultural', foto: 2 },
	{ nome: 'Phoebe Bridgers', arquivo: 'edicao-04/textos/01-phoebe-bridgers-lost-weekend-seis-anos-de-silencio.md', slug: 'phoebe-bridgers-lost-weekend-seis-anos-de-silencio', foto: 2 },
	{ nome: 'Lucia & the Best Boys', arquivo: 'edicao-04/textos/02-lucia-and-the-best-boys-picking-petals-feature-heranca.md', slug: 'lucia-and-the-best-boys-picking-petals-feature-heranca', foto: 1 }, // só há 1 foto livre: o Luciano mandou usá-la
	{ nome: 'Milton Nascimento', substack: 'milton-nascimento-e-internado-para', foto: 2 },
	{ nome: 'Arctic Monkeys', substack: 'arctic-monkeys-a-banda-que-capturou', foto: 2 },
	{ nome: 'Bad Bunny', substack: 'bad-bunny-entra-para-a-lista-de-inimigos', foto: 2 },
	{ nome: 'alt-J', substack: 'breezeblocks-uma-musica-com-tudo', foto: 3 },
	{ nome: "Guns N' Roses", substack: 'chinese-democracy-faixa-por-faixa', foto: 3 },
	{ nome: 'Paralamas do Sucesso', substack: 'de-faixa-a-faixa-01-album-bora-bora', foto: 2 },
	{ nome: 'Oliver Tree', substack: 'oliver-tree-nunca-quis-parecer-verdadeiro', foto: 2 },
];

// lê os nomes de arquivo de cada seção do relatório
const linhas = (await readFile(path.join(RAIZ, 'imagens-candidatas.md'), 'utf8')).split('\n');
const secoes = [];
for (const l of linhas) {
	if (/^## /.test(l)) secoes.push([]);
	const m = l.match(/^(\d)\. \*\*(.+)\*\* — /);
	if (m && secoes.length) secoes[secoes.length - 1][Number(m[1]) - 1] = m[2];
}

const semHtml = (s = '') => s.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/\s+/g, ' ').trim();
const LIC_OK = /^(cc0|cc[- ]by(-sa)?[- ]\d|public domain|pd[- ])/i;

async function commons(arquivo) {
	const url = new URL('https://commons.wikimedia.org/w/api.php');
	url.search = new URLSearchParams({
		action: 'query', format: 'json', titles: `File:${arquivo}`,
		prop: 'imageinfo', iiprop: 'url|size|extmetadata', iiurlwidth: '1600',
	}).toString();
	const r = await fetch(url, { headers: { 'user-agent': 'RevistaCatarsePortal/0.1 (revistacatarse@gmail.com)' } });
	const j = await r.json();
	const p = Object.values(j.query.pages)[0];
	const i = p.imageinfo?.[0];
	if (!i) throw new Error('arquivo não encontrado na Commons');
	const m = i.extmetadata ?? {};
	return {
		pagina: `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title.replace(/ /g, '_'))}`,
		baixar: i.thumburl || i.url,
		largura: i.width,
		licenca: semHtml(m.LicenseShortName?.value),
		licencaUrl: m.LicenseUrl?.value,
		autor: semHtml(m.Artist?.value),
	};
}

/** Nome legível do autor; alguns vêm como endereço de canal. */
function nomeAutor(autor) {
	const yt = autor.match(/youtube\.com\/@([\w.-]+)/i);
	if (yt) return `${yt[1].replace(/^_/, '')} (youtube.com/@${yt[1]})`;
	return autor.replace(/\s*\(.*$/, (t) => (t.length > 60 ? '' : t)).trim();
}

/** Troca (ou põe) os campos de imagem no cabeçalho de um .md, logo depois de "subtitulo:". */
function gravarCabecalho(texto, campos) {
	let t = texto.replace(/\r\n/g, '\n');
	t = t.replace(/^(imagem|credito|credito_url|licenca_url):.*\n/gm, '');
	const bloco = Object.entries(campos).map(([k, v]) => `${k}: ${v}`).join('\n');
	return t.replace(/^(subtitulo:.*)$/m, `$1\n${bloco}`);
}

const curadoria = JSON.parse(await readFile(CURADORIA, 'utf8'));
const resumo = [];

for (const [n, alvo] of ALVOS.entries()) {
	if (!alvo.foto) {
		resumo.push([alvo.nome, '— sem foto aplicada (sem 2ª candidata)']);
		continue;
	}
	const arquivo = secoes[n]?.[alvo.foto - 1];
	if (!arquivo) throw new Error(`${alvo.nome}: não achei a foto ${alvo.foto} em imagens-candidatas.md`);
	const info = await commons(arquivo);
	if (!LIC_OK.test(info.licenca)) throw new Error(`${alvo.nome}: licença não aceita ("${info.licenca}")`);
	if (!info.autor || /unknown|desconhecid/i.test(info.autor)) throw new Error(`${alvo.nome}: autor não identificado`);

	const slug = alvo.slug ?? alvo.substack;
	const credito = `Foto: ${nomeAutor(info.autor)} / Wikimedia Commons / ${info.licenca}`;
	const rel = `/imagens/${slug}/capa.jpg`;
	resumo.push([alvo.nome, `${arquivo} · ${info.largura}px · ${credito}`]);
	if (seco) continue;

	const resp = await fetch(info.baixar, { headers: { 'user-agent': 'RevistaCatarsePortal/0.1 (revistacatarse@gmail.com)' } });
	if (!resp.ok) throw new Error(`${alvo.nome}: download falhou (${resp.status})`);
	const buf = Buffer.from(await resp.arrayBuffer());
	await mkdir(path.join(RAIZ, 'public/imagens', slug), { recursive: true });
	await sharp(buf).rotate().resize({ width: 1600, withoutEnlargement: true }).flatten({ background: '#ffffff' }).jpeg({ quality: 82, mozjpeg: true }).toFile(path.join(RAIZ, 'public', rel));

	const campos = { imagem: rel, credito, credito_url: info.pagina };
	if (info.licencaUrl) campos.licenca_url = info.licencaUrl;
	if (alvo.arquivo) {
		const f = path.join(EDICOES, alvo.arquivo);
		await writeFile(f, gravarCabecalho(await readFile(f, 'utf8'), campos));
	} else {
		curadoria[alvo.substack] = { ...curadoria[alvo.substack], imagem: rel, credito, credito_url: info.pagina, ...(info.licencaUrl ? { licenca_url: info.licencaUrl } : {}) };
	}
	await new Promise((r) => setTimeout(r, 300));
}

if (!seco) {
	const linhasJson = Object.entries(curadoria).map(([k, v]) => {
		const corpo = typeof v === 'string' ? JSON.stringify(v) : `{ ${Object.entries(v).map(([a, b]) => `${JSON.stringify(a)}: ${JSON.stringify(b)}`).join(', ')} }`;
		return `\t${JSON.stringify(k)}: ${corpo}`;
	});
	await writeFile(CURADORIA, `{\n${linhasJson.join(',\n')}\n}\n`);
}

console.log(seco ? '=== CONFERÊNCIA (nada gravado) ===' : '=== APLICADO ===');
for (const [nome, txt] of resumo) console.log(`${nome.padEnd(22)} ${txt}`);
