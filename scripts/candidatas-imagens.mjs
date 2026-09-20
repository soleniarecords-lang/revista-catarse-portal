// Busca imagens com licença livre (Wikimedia Commons) para matérias que ainda não têm foto, e monta folhas de
// contato (HTML) para conferir se a imagem combina com o assunto do texto. Não baixa nem aplica nada.
//   node scripts/candidatas-imagens.mjs          → gera candidatas-imagens/pagina-N.html e candidatas.json
// Aceita só CC0, domínio público, CC BY e CC BY-SA, com autor identificado.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SAIDA = path.join(RAIZ, 'candidatas-imagens');

// id, o que o texto trata, consultas (em ordem de preferência) e, se houver, nome que precisa aparecer no arquivo
const ALVOS = [
	['n1', 'Notícia: Spotify lança o Fresh Finds Forward (estúdio grátis, ferramentas)', ['Electric Lady Studios', 'Spotify headquarters Stockholm', 'Spotify logo building'], null],
	['n2', 'Notícia: Sylvan Esso volta ao Spotify após boicote', ['Sylvan Esso'], /sylvan/i],
	['n3', 'Notícia: Universal Music processa a DistroKid (IA e direitos autorais)', ['Universal Music Group headquarters', 'Universal Music Group building Santa Monica', 'Universal Music Group'], null],
	['e4-03', 'Ed. 04 · Quando a cena decide crescer junta (5 Bandas feat. Bananada, Goiânia)', ['Festival Bananada', 'Bananada Goiânia', 'Goiânia show banda indie'], null],
	['e4-06', 'Ed. 04 · Sua música pode estar tocando e não te pagando (regra dos 1.000 streams do Spotify)', ['Spotify app smartphone', 'Spotify', 'streaming music smartphone headphones'], null],
	['e4-07', 'Ed. 04 · Segurar o ouvinte até o stream valer (tempo mínimo de audição)', ['listening to music headphones', 'person listening music smartphone', 'headphones'], null],
	['e4-09', 'Ed. 04 · Tyler, the Creator, capa de Flower Boy como pintura', ['Tyler, the Creator', 'Tyler the Creator Flower Boy'], /tyler/i],
	['e4-10', 'Ed. 04 · O silêncio que dorme sob a paisagem (Francisca Júlia, poema "Paisagem")', ['Francisca Júlia', 'Francisca Júlia da Silva poeta'], /francisca/i],
	['e4-11', 'Ed. 04 · O show mais alto da história (Krakatoa, decibéis)', ['Krakatoa eruption 1883', 'Krakatoa'], /krakat/i],
	['e4-12', 'Ed. 04 · Checklist para manter as faixas acima de 1.000 streams', ['music producer laptop home studio', 'streaming music analytics smartphone', 'record collection'], null],
	['e3-04', 'Ed. 03 · Duo Hotel Brasil, a costura entre dois sons', ['Duo Hotel Brasil'], /hotel/i],
	['e3-05', 'Ed. 03 · Lado Beco, o álbum que esperou o tempo certo (banda de Maringá)', ['Lado Beco', 'Maringá banda rock'], /beco/i],
	['e3-06', 'Ed. 03 · O bolo do mercado cresceu, a fatia indie não (economia da música)', ['record store vinyl records', 'independent record shop', 'concert crowd'], null],
	['e3-07', 'Ed. 03 · Fraude no streaming e IA (quem paga o preço)', ['streaming music smartphone', 'headphones smartphone music', 'artificial intelligence music'], null],
	['e3-08', 'Ed. 03 · JAOVAMP, o que não cabia na banda (Lado Beco)', ['JAOVAMP', 'Lado Beco'], /jaovamp|beco/i],
	['e3-09', 'Ed. 03 · A capa de AM, dos Arctic Monkeys', ['Arctic Monkeys'], /arctic monkeys/i],
	['e3-10', 'Ed. 03 · Duas vozes que já escreveram a música antes de nós (Bilac, poesia e música)', ['Olavo Bilac', 'Cruz e Sousa'], /bilac|cruz/i],
	['e3-11', 'Ed. 03 · Formiga-prateada-do-saara vs Porsche (Cataglyphis bombycina)', ['Cataglyphis bombycina', 'Saharan silver ant', 'Porsche 911'], /cataglyphis|silver ant|porsche/i],
	['e3-12', 'Ed. 03 · Checklist para proteger o catálogo', ['record collection vinyl', 'music catalog vinyl records shelf'], null],
	['s-jonabug', 'Substack · Jonabug (banda), entrevista em podcast', ['jonabug'], /jonabug/i],
	['s-simioni', 'Substack · Luciano Simioni e o olhar da Geração Z', ['Luciano Simioni'], /simioni/i],
	['s-30cm', 'Substack · Um homem de 30 cm teria voz normal ou aguda? (voz e acústica)', ['larynx vocal folds', 'vocal cords anatomy', 'human larynx'], null],
	['s-notredame', 'Substack · Notre Dame Pt. I e II (Duo Hotel Brasil, memória)', ['Notre-Dame de Paris', 'Notre-Dame cathedral Paris'], /notre/i],
	['s-terraplana', 'Substack · Terraplana, ruído e pertencimento (shoegaze)', ['Terraplana banda', 'guitar effects pedals', 'shoegaze band live'], null],
	['s-viperine', 'Substack · VIPERINE e a filosofia do estrangeiro (faixa "Lost")', ['VIPERINE banda', 'traveller airport luggage'], null],
	['s-jaovamp', 'Substack · JAOVAMP, condenado a ser livre (Lado Beco)', ['JAOVAMP', 'Lado Beco Maringá'], /jaovamp|beco/i],
];

const LIC_OK = /^(cc0|cc[- ]by(-sa)?[- ]\d|public domain|pd[- ])/i;
const semHtml = (s = '') => s.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/\s+/g, ' ').trim();
const UA = { 'user-agent': 'RevistaCatarsePortal/0.1 (revistacatarse@gmail.com)' };

async function buscar(consulta, exigir) {
	const url = new URL('https://commons.wikimedia.org/w/api.php');
	url.search = new URLSearchParams({
		action: 'query', format: 'json', generator: 'search', gsrsearch: `${consulta} filetype:bitmap`, gsrnamespace: '6', gsrlimit: '25',
		prop: 'imageinfo', iiprop: 'url|size|extmetadata', iiurlwidth: '640',
	}).toString();
	const j = await (await fetch(url, { headers: UA })).json();
	return Object.values(j.query?.pages ?? {})
		.map((p) => {
			const i = p.imageinfo?.[0];
			const m = i?.extmetadata ?? {};
			return {
				arquivo: p.title.replace(/^File:/, ''), pagina: `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title.replace(/ /g, '_'))}`,
				miniatura: i?.thumburl, largura: i?.width, altura: i?.height, licenca: semHtml(m.LicenseShortName?.value),
				autor: semHtml(m.Artist?.value), descricao: semHtml(m.ImageDescription?.value).slice(0, 110), indice: p.index,
			};
		})
		.filter((c) => c.miniatura && c.largura >= 900 && LIC_OK.test(c.licenca))
		.filter((c) => c.autor && !/unknown|desconhecid/i.test(c.autor))
		.filter((c) => !exigir || exigir.test(c.arquivo) || exigir.test(c.descricao))
		.sort((a, b) => a.indice - b.indice);
}

const resultado = {};
for (const [id, nome, consultas, exigir] of ALVOS) {
	const vistos = new Set();
	const cands = [];
	for (const q of consultas) {
		if (cands.length >= 5) break;
		try {
			for (const c of await buscar(q, exigir)) {
				if (!vistos.has(c.arquivo) && cands.length < 5) {
					vistos.add(c.arquivo);
					cands.push({ ...c, consulta: q });
				}
			}
		} catch (e) {
			console.log(`  falha em "${q}": ${e.message}`);
		}
		await new Promise((r) => setTimeout(r, 350));
	}
	resultado[id] = { nome, cands };
	console.log(`${id.padEnd(12)} ${String(cands.length).padStart(1)} candidatas  ${nome.slice(0, 70)}`);
}

// folhas de contato: 7 matérias por página
await mkdir(SAIDA, { recursive: true });
const ids = Object.keys(resultado);
const PAG = 7;
const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
for (let p = 0; p * PAG < ids.length; p++) {
	let h = `<!doctype html><meta charset="utf-8"><style>body{font:13px/1.4 system-ui,sans-serif;margin:0;padding:18px;background:#f6faf7;color:#0e1512}h2{font:700 13px system-ui;margin:18px 0 8px;padding-top:10px;border-top:2px solid #0d9488}
.g{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}.c{background:#fff;border:1px solid #cfdcd4;border-radius:8px;overflow:hidden}.c img{width:100%;height:170px;object-fit:cover;display:block;background:#dfe9e3}.c div{padding:6px 8px;font-size:11px}
.n{background:#0d9488;color:#fff;border-radius:99px;padding:0 7px;font-weight:700;margin-right:5px}small{color:#55625b;display:block;word-break:break-word}.v{color:#a00;font-style:italic}</style>`;
	for (const id of ids.slice(p * PAG, p * PAG + PAG)) {
		const { nome, cands } = resultado[id];
		h += `<h2>${esc(id)} · ${esc(nome)}</h2>`;
		if (!cands.length) {
			h += `<p class="v">Nenhuma foto livre relevante encontrada.</p>`;
			continue;
		}
		h += '<div class="g">' + cands.map((c, n) => `<div class="c"><img src="${esc(c.miniatura)}" alt=""><div><span class="n">${n + 1}</span><b>${esc(c.arquivo.slice(0, 44))}</b><small>${c.largura}×${c.altura} · ${esc(c.licenca)}<br>${esc(c.autor.slice(0, 40))}</small></div></div>`).join('') + '</div>';
	}
	await writeFile(path.join(SAIDA, `pagina-${p + 1}.html`), h + '</html>');
}
await writeFile(path.join(RAIZ, 'candidatas.json'), JSON.stringify(resultado, null, 1));
console.log(`\n${Math.ceil(ids.length / PAG)} folhas em ${path.relative(RAIZ, SAIDA)}/ e candidatas.json`);
