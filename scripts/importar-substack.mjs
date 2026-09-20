// Importa o feed RSS da Substack da revista para src/data/substack.json.
//   node scripts/importar-substack.mjs                 (busca o feed na internet)
//   node scripts/importar-substack.mjs --arquivo=x.xml (usa um feed salvo)
//
// O que faz:
//  - traz só o TEXTO dos posts: tira fotos (autoria/crédito desconhecidos), botões, widgets de
//    assinatura e classes do Substack; rebaixa h1→h2 etc. porque a página já tem seu <h1>;
//  - marca `duplicadoDe` quando o post já existe em edicoes/ (mesmo título ou texto quase igual),
//    para o portal não mostrar a mesma matéria duas vezes;
//  - NÃO decide quadro nem aprovação: isso mora em src/data/substack-curadoria.json,
//    que este script nunca sobrescreve (só avisa dos posts novos sem curadoria).
import * as cheerio from 'cheerio';
import { XMLParser } from 'fast-xml-parser';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lerCabecalho } from '../src/loaders/edicoes.ts';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EDICOES = process.env.EDICOES_DIR ?? path.resolve(RAIZ, '../edicoes');
const FEED = `${process.env.SUBSTACK_URL ?? 'https://revistacatarse.substack.com'}/feed`;
const SAIDA = path.join(RAIZ, 'src/data/substack.json');
const CURADORIA = path.join(RAIZ, 'src/data/substack-curadoria.json');

const arg = process.argv.find((a) => a.startsWith('--arquivo='))?.slice(10);

const texto = (v) => (v && typeof v === 'object' ? (v.__c ?? v['#text'] ?? '') : (v ?? '')).toString();
const decodificar = (s) => cheerio.load(`<p>${s}</p>`, null, false).text().trim();
const semAcento = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const palavras = (s) => semAcento(s).replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean);
const shingles = (w) => {
	const s = new Set();
	for (let i = 0; i + 4 <= w.length; i++) s.add(w.slice(i, i + 4).join(' '));
	return s;
};

function limpar(html) {
	const $ = cheerio.load(html, null, false);
	$(
		'figure, picture, img, svg, button, form, input, iframe, script, style, a.button,' +
			'.subscription-widget-wrap-editor, .subscription-widget, .captioned-image-container,' +
			'.image-link-expand, .preamble, .pencraft',
	).remove();
	// desce os títulos um nível (h3→h4, h2→h3, h1→h2); em ordem decrescente para não encadear
	for (const n of [3, 2, 1]) {
		$(`h${n}`).each((_, el) => {
			el.tagName = `h${n + 1}`;
		});
	}
	// desembrulha divs/spans que sobraram
	$('div, span').each((_, el) => {
		$(el).replaceWith($(el).contents());
	});
	// só href nos links; nenhum outro atributo
	$('*').each((_, el) => {
		const href = el.tagName === 'a' ? $(el).attr('href') : undefined;
		for (const a of Object.keys(el.attribs ?? {})) $(el).removeAttr(a);
		if (href) $(el).attr({ href, rel: 'noopener' });
	});
	$('p').each((_, el) => {
		if (!$(el).text().trim() && !$(el).find('a').length) $(el).remove();
	});
	// hr repetido ou nas pontas
	let html2 = $.html().trim();
	html2 = html2.replace(/(<hr\s*\/?>\s*){2,}/g, '<hr>').replace(/^(<hr\s*\/?>\s*)+|(\s*<hr\s*\/?>)+$/g, '');
	return { html: html2, texto: cheerio.load(html2, null, false).text() };
}

async function textosDasEdicoes() {
	const lista = [];
	for (const pasta of (await readdir(EDICOES)).filter((d) => /^edicao-\d+$/.test(d))) {
		let arquivos = [];
		try {
			arquivos = (await readdir(path.join(EDICOES, pasta, 'textos'))).filter((f) => f.endsWith('.md'));
		} catch {
			continue;
		}
		for (const f of arquivos) {
			const { dados, corpo } = lerCabecalho(await readFile(path.join(EDICOES, pasta, 'textos', f), 'utf8'));
			lista.push({
				id: `${pasta}/${f.replace(/\.md$/, '')}`,
				titulo: palavras(dados.titulo ?? '').join(' '),
				sh: shingles(palavras(corpo)),
			});
		}
	}
	return lista;
}

const xml = arg ? await readFile(arg, 'utf8') : await (await fetch(FEED, { headers: { 'user-agent': 'Mozilla/5.0' } })).text();
const rss = new XMLParser({ ignoreAttributes: false, cdataPropName: '__c' }).parse(xml);
const itens = [].concat(rss.rss.channel.item);
const edicoes = await textosDasEdicoes();

const posts = itens.map((i) => {
	const link = texto(i.link);
	const { html, texto: corpo } = limpar(texto(i['content:encoded']));
	const enc = i.enclosure?.['@_url'];
	const tipo = i.enclosure?.['@_type'] ?? '';
	const titulo = decodificar(texto(i.title));
	const sh = shingles(palavras(corpo));

	let duplicadoDe = null;
	const tn = palavras(titulo).join(' ');
	for (const e of edicoes) {
		let em = 0;
		for (const s of sh) if (e.sh.has(s)) em++;
		const sobreposicao = em / Math.max(1, Math.min(sh.size, e.sh.size));
		if (e.titulo === tn || sobreposicao >= 0.25) {
			duplicadoDe = e.id;
			break;
		}
	}

	return {
		slug: new URL(link).pathname.replace(/^\/p\//, ''),
		titulo,
		subtitulo: decodificar(texto(i.description)),
		data: new Date(texto(i.pubDate)).toISOString(),
		link,
		autor: texto(i['dc:creator']) || 'Revista Catarse',
		html,
		palavras: corpo.split(/\s+/).filter(Boolean).length,
		audio: tipo.startsWith('audio') ? enc : null,
		imagemOriginal: tipo.startsWith('image') ? enc : null, // só registro: NÃO é usada no portal
		duplicadoDe,
	};
});

posts.sort((a, b) => b.data.localeCompare(a.data));
await writeFile(SAIDA, JSON.stringify(posts, null, '\t') + '\n');

let curadoria = {};
try {
	curadoria = JSON.parse(await readFile(CURADORIA, 'utf8'));
} catch {}

console.log(`${posts.length} posts → ${path.relative(RAIZ, SAIDA)}`);
for (const p of posts) {
	const marca = p.duplicadoDe ? `duplicado de ${p.duplicadoDe}` : p.audio ? 'podcast' : `${p.palavras} palavras`;
	console.log(`  ${p.data.slice(0, 10)}  ${p.titulo.slice(0, 58).padEnd(58)}  ${marca}`);
}
const semCuradoria = posts.filter((p) => !p.duplicadoDe && !curadoria[p.slug]);
if (semCuradoria.length) {
	console.log(`\nSem curadoria (não aparecem no portal até ganharem quadro em substack-curadoria.json):`);
	for (const p of semCuradoria) console.log(`  ${p.slug}`);
}
