// Aplica as imagens escolhidas em candidatas.json / candidatas2.json (geradas por candidatas-imagens.mjs):
// baixa da Wikimedia Commons, reduz para 1600 px, salva em public/imagens/<slug>/capa.jpg e grava
// imagem/credito/credito_url/licenca_url no cabeçalho da matéria (edições e notícias) ou em
// src/data/substack-curadoria.json (posts do Substack).
//   node scripts/aplicar-escolhas.mjs --seco   só confere os créditos
//   node scripts/aplicar-escolhas.mjs          aplica
import sharp from 'sharp';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ED = path.resolve(RAIZ, '../edicoes');
const NO = path.resolve(RAIZ, '../noticias/2026-09-19');
const CURADORIA = path.join(RAIZ, 'src/data/substack-curadoria.json');
const seco = process.argv.includes('--seco');
// --so=e4-06,n1 aplica só esses itens
const so = process.argv.find((a) => a.startsWith('--so='))?.slice(5).split(',');

// id do alvo → onde gravar; `casa` acha a imagem escolhida pelo nome do arquivo; `prefixo` troca "Foto" quando não é foto
const ESCOLHAS = [
	{ id: 'n1', casa: /ElectricLadyStudioA/, arq: NO + '/01-spotify-fresh-finds-forward-10-mil-artistas.md', slug: 'spotify-fresh-finds-forward-10-mil-artistas' },
	{ id: 'n2', casa: /Sylvan Esso \(32767795263\)/, arq: NO + '/02-sylvan-esso-volta-ao-spotify-apos-boicote.md', slug: 'sylvan-esso-volta-ao-spotify-apos-boicote' },
	{ id: 'n3', casa: /Universal Music Group UK HQ/, arq: NO + '/03-universal-processa-distrokid-ia-direitos-autorais.md', slug: 'universal-processa-distrokid-ia-direitos-autorais' },
	{ id: 'e4-03', casa: /Concert in Goiania7/, arq: ED + '/edicao-04/textos/03-5-bandas-feat-bananada-cena-coletivo.md', slug: '5-bandas-feat-bananada-cena-coletivo' },
	{ id: 'e4-06', casa: /Spotify, King's Cross Railway Station/, arq: ED + '/edicao-04/textos/06-regra-1000-streams-spotify-royalties.md', slug: 'regra-1000-streams-spotify-royalties' },
	{ id: 'e4-07', casa: /Woman listening to music with wireless/, arq: ED + '/edicao-04/textos/07-tempo-minimo-audicao-spotify-2026.md', slug: 'tempo-minimo-audicao-spotify-2026' },
	{ id: 'e4-09', casa: /Tyler the Creator \(52163761341\)/, arq: ED + '/edicao-04/textos/09-tyler-the-creator-flower-boy-capa-pintura.md', slug: 'tyler-the-creator-flower-boy-capa-pintura' },
	{ id: 'x-almeida', casa: /Paisagem Fluvial, 1899/, arq: ED + '/edicao-04/textos/10-francisca-julia-paisagem-poema-silencio.md', slug: 'francisca-julia-paisagem-poema-silencio', autor: 'José Ferraz de Almeida Júnior', prefixo: 'Pintura' },
	{ id: 'e4-11', casa: /Krakatoa eruption lithograph/, arq: ED + '/edicao-04/textos/11-instrumento-musical-krakatoa-decibeis.md', slug: 'instrumento-musical-krakatoa-decibeis', autor: 'Parker & Coward (litografia)', prefixo: 'Imagem' },
	{ id: 'e4-12', casa: /Part of Record Collection/, arq: ED + '/edicao-04/textos/12-checklist-1000-streams-catalogo.md', slug: 'checklist-1000-streams-catalogo' },
	{ id: 'e3-06', casa: /Whispers of Vinyl/, arq: ED + '/edicao-03/textos/06-bolo-mercado-cresceu-fatia-indie.md', slug: 'bolo-mercado-cresceu-fatia-indie' },
	{ id: 'x-servidores', casa: /Racks Amravati/, arq: ED + '/edicao-03/textos/07-fraude-streaming-ia-catalogo.md', slug: 'fraude-streaming-ia-catalogo' },
	{ id: 'e3-09', casa: /Arctic Monkeys White/, arq: ED + '/edicao-03/textos/09-capa-am-arctic-monkeys.md', slug: 'capa-am-arctic-monkeys', prefixo: 'Imagem' },
	{ id: 'e3-10', casa: /Olavo Bilac \(Iconogr/, arq: ED + '/edicao-03/textos/10-duas-vozes-poesia-musica.md', slug: 'duas-vozes-poesia-musica', autor: 'M. J. Garnier', prefixo: 'Imagem' },
	{ id: 'e3-11', casa: /Saharan Silver Ants Erg Chebbi/, arq: ED + '/edicao-03/textos/11-formiga-porsche-corrida.md', slug: 'formiga-porsche-corrida' },
	{ id: 'e3-12', casa: /Stacks of KDV/, arq: ED + '/edicao-03/textos/12-checklist-protecao-catalogo.md', slug: 'checklist-protecao-catalogo' },
	{ id: 's-30cm', casa: /Aids to the Pronunciation of Irish/, substack: 'um-homem-de-30-cm-teria-voz-normal', autor: 'The Christian Brothers (1905)', prefixo: 'Imagem' },
	{ id: 's-notredame', casa: /Cath.drale Notre Dame, Paris 30/, substack: 'notre-dame-pt-i-and-ii-e-a-subjetividade' },
	{ id: 's-terraplana', casa: /Large pedal board/, substack: 'terraplana-quando-o-ruido-vira-lugar' },
];

const c1 = JSON.parse(await readFile(path.join(RAIZ, 'candidatas.json'), 'utf8'));
let c2 = {};
try {
	const bruto = JSON.parse(await readFile(path.join(RAIZ, 'candidatas2.json'), 'utf8'));
	c2 = { 'x-almeida': { cands: bruto[Object.keys(bruto)[0]].map((c) => ({ arquivo: c.a })) }, 'x-servidores': { cands: bruto[Object.keys(bruto)[1]].map((c) => ({ arquivo: c.a })) } };
} catch {}
const todas = { ...c1, ...c2 };

const semHtml = (s = '') => s.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/\s+/g, ' ').trim();
const LIC_OK = /^(cc0|cc[- ]by(-sa)?[- ]\d|public domain|pd[- ])/i;
const UA = { 'user-agent': 'RevistaCatarsePortal/0.1 (revistacatarse@gmail.com)' };

async function commons(arquivo) {
	const url = new URL('https://commons.wikimedia.org/w/api.php');
	url.search = new URLSearchParams({ action: 'query', format: 'json', titles: `File:${arquivo}`, prop: 'imageinfo', iiprop: 'url|size|extmetadata', iiurlwidth: '1600' }).toString();
	const p = Object.values((await (await fetch(url, { headers: UA })).json()).query.pages)[0];
	const i = p.imageinfo?.[0];
	if (!i) throw new Error('arquivo não encontrado');
	const m = i.extmetadata ?? {};
	return {
		pagina: `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title.replace(/ /g, '_'))}`,
		baixar: i.thumburl || i.url, largura: i.width, licenca: semHtml(m.LicenseShortName?.value), licencaUrl: m.LicenseUrl?.value, autor: semHtml(m.Artist?.value),
	};
}

const nomeAutor = (a) => {
	const yt = a.match(/youtube\.com\/@([\w.-]+)/i);
	if (yt) return `${yt[1].replace(/^_/, '')} (youtube.com/@${yt[1]})`;
	return a.replace(/\s*\(.*$/, (t) => (t.length > 60 ? '' : t)).replace(/[;:,]\s.*$/, '').trim().slice(0, 70);
};

function gravarCabecalho(texto, campos) {
	let t = texto.replace(/\r\n/g, '\n').replace(/^(imagem|credito|credito_url|licenca_url):.*\n/gm, '');
	return t.replace(/^(subtitulo:.*)$/m, `$1\n${Object.entries(campos).map(([k, v]) => `${k}: ${v}`).join('\n')}`);
}

const curadoria = JSON.parse(await readFile(CURADORIA, 'utf8'));
for (const e of ESCOLHAS.filter((x) => !so || so.includes(x.id))) {
	const cand = (todas[e.id]?.cands ?? []).find((c) => e.casa.test(c.arquivo));
	if (!cand) throw new Error(`${e.id}: não achei a imagem escolhida (${e.casa})`);
	const info = await commons(cand.arquivo);
	if (!LIC_OK.test(info.licenca)) throw new Error(`${e.id}: licença não aceita "${info.licenca}"`);
	const pd = /public domain|^pd/i.test(info.licenca);
	const prefixo = e.prefixo ?? 'Foto';
	const autor = e.autor ?? nomeAutor(info.autor);
	const credito = `${prefixo}: ${autor} / Wikimedia Commons / ${pd ? 'domínio público' : info.licenca}`;
	const slug = e.slug ?? e.substack;
	console.log(`${e.id.padEnd(13)} ${cand.arquivo.slice(0, 48).padEnd(48)} ${credito}`);
	if (seco) continue;

	const resp = await fetch(info.baixar, { headers: UA });
	if (!resp.ok) throw new Error(`${e.id}: download falhou (${resp.status})`);
	await mkdir(path.join(RAIZ, 'public/imagens', slug), { recursive: true });
	await sharp(Buffer.from(await resp.arrayBuffer())).rotate().resize({ width: 1400, withoutEnlargement: true }).flatten({ background: '#ffffff' }).jpeg({ quality: 76, mozjpeg: true, progressive: true }).toFile(path.join(RAIZ, 'public/imagens', slug, 'capa.jpg'));
	const campos = { imagem: `/imagens/${slug}/capa.jpg`, credito, credito_url: info.pagina };
	if (info.licencaUrl) campos.licenca_url = info.licencaUrl;
	if (e.arq) await writeFile(e.arq, gravarCabecalho(await readFile(e.arq, 'utf8'), campos));
	else curadoria[e.substack] = { ...curadoria[e.substack], ...campos };
	await new Promise((r) => setTimeout(r, 300));
}
if (!seco) {
	const linhas = Object.entries(curadoria).map(([k, v]) => `\t${JSON.stringify(k)}: ${typeof v === 'string' ? JSON.stringify(v) : `{ ${Object.entries(v).map(([a, b]) => `${JSON.stringify(a)}: ${JSON.stringify(b)}`).join(', ')} }`}`);
	await writeFile(CURADORIA, `{\n${linhas.join(',\n')}\n}\n`);
}
console.log(seco ? '\n(conferência: nada gravado)' : '\nAPLICADO.');
