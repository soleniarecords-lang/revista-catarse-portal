// Coleta diária de manchetes das fontes de noticias/fontes.json (RSS/Atom). Sem IA, só HTTP.
//   node scripts/coletar-noticias.mjs                 fontes 'aprovada', últimas 48h
//   node scripts/coletar-noticias.mjs --todas         inclui as 'proposta' (para testar)
//   node scripts/coletar-noticias.mjs --horas=24 --max=6 --dia=2026-09-19
//
// Escreve noticias/AAAA-MM-DD/coleta.md: o material bruto que a skill /catarse-noticias lê para
// escolher as pautas. NÃO é conteúdo publicável: são links, datas e um trecho de cada manchete.
import * as cheerio from 'cheerio';
import { XMLParser } from 'fast-xml-parser';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NOTICIAS = process.env.NOTICIAS_DIR ?? path.resolve(RAIZ, '../noticias');

const arg = (nome, padrao) => process.argv.find((a) => a.startsWith(`--${nome}=`))?.split('=')[1] ?? padrao;
const todas = process.argv.includes('--todas');
const HORAS = Number(arg('horas', 48));
const MAX = Number(arg('max', 8));
const agora = Date.now();
const dia =
	arg('dia') ??
	new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date()); // AAAA-MM-DD em Brasília

// link limpo: entidades HTML decodificadas e sem parâmetros de rastreio (utm_*)
const limparLink = (s) => {
	const decodificado = cheerio.load(`<p>${s}</p>`, null, false).text().trim();
	try {
		const u = new URL(decodificado);
		for (const k of [...u.searchParams.keys()]) if (/^utm_/i.test(k)) u.searchParams.delete(k);
		return u.href;
	} catch {
		return decodificado;
	}
};
// tira o rodapé automático do WordPress ("O post X apareceu primeiro em Y")
const semRodapeWP = (s) => s.replace(/\s*O post .* apareceu primeiro .*$/i, '').replace(/\s*The post .* appeared first .*$/i, '');

const t = (v) => (v && typeof v === 'object' ? (v.__c ?? v['#text'] ?? '') : (v ?? '')).toString();
const semHtml = (s) => cheerio.load(`<p>${s}</p>`, null, false).text().replace(/\s+/g, ' ').trim();
const semAcento = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const PARADAS = new Set('para como mais sobre apos entre desde quando depois contra ainda novo nova with from that this have will their after about into over your what been they them than then were when just also'.split(' '));
const tokens = (s) => new Set(semAcento(s).replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((w) => w.length > 3 && !PARADAS.has(w)));

async function buscarFeed(fonte) {
	const ctl = new AbortController();
	const timer = setTimeout(() => ctl.abort(), 20000);
	try {
		const r = await fetch(fonte.rss, { signal: ctl.signal, headers: { 'user-agent': 'Mozilla/5.0 (RevistaCatarse coleta)', accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*' } });
		if (!r.ok) throw new Error(`HTTP ${r.status}`);
		// maxNestedTags alto: feeds com HTML embutido no <content:encoded> passam do limite padrão (100)
		// alguns feeds (Folha) vêm em ISO-8859-1: decodifica pelo `encoding=` do próprio XML
		const buf = Buffer.from(await r.arrayBuffer());
		const enc = /encoding=["']([^"']+)["']/i.exec(buf.subarray(0, 200).toString('latin1'))?.[1] ?? 'utf-8';
		const xml = new TextDecoder(enc).decode(buf);
		const x = new XMLParser({ ignoreAttributes: false, cdataPropName: '__c', maxNestedTags: 1000 }).parse(xml);
		const rssItens = x.rss?.channel?.item;
		const atomItens = x.feed?.entry;
		const bruto = [].concat(rssItens ?? atomItens ?? []);
		if (!bruto.length) throw new Error('feed sem itens');
		return bruto.map((i) => {
			const link = rssItens ? t(i.link) : ([].concat(i.link ?? []).find((l) => l['@_rel'] !== 'self')?.['@_href'] ?? t(i.link));
			const quando = new Date(t(i.pubDate) || t(i.published) || t(i.updated) || t(i['dc:date']));
			return {
				fonte: fonte.nome,
				tipo: fonte.tipo,
				titulo: semHtml(t(i.title)),
				link: limparLink(link),
				quando,
				resumo: semRodapeWP(semHtml(t(i.description) || t(i.summary) || t(i['content:encoded']) || t(i.content))).slice(0, 260),
			};
		});
	} finally {
		clearTimeout(timer);
	}
}

// o que já foi coberto (para não repetir pauta): fontes e títulos das notícias existentes
async function jaCobertas() {
	const urls = new Set();
	const titulos = [];
	try {
		for (const d of (await readdir(NOTICIAS, { withFileTypes: true })).filter((e) => e.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(e.name))) {
			for (const f of (await readdir(path.join(NOTICIAS, d.name))).filter((n) => /^\d+-.+\.md$/.test(n))) {
				const txt = await readFile(path.join(NOTICIAS, d.name, f), 'utf8');
				for (const m of txt.matchAll(/^-\s+.*\|\s*(https?:\/\/\S+)\s*$/gm)) urls.add(m[1]);
				const tit = txt.match(/^titulo:\s*(.*)$/m)?.[1];
				if (tit) titulos.push({ dia: d.name, titulo: tit.replace(/^["']|["']$/g, '') });
			}
		}
	} catch {}
	return { urls, titulos: titulos.sort((a, b) => b.dia.localeCompare(a.dia)).slice(0, 25) };
}

const { fontes } = JSON.parse(await readFile(path.join(NOTICIAS, 'fontes.json'), 'utf8'));
const usar = fontes.filter((f) => f.rss && (todas || f.status === 'aprovada'));
if (!usar.length) {
	console.error("Nenhuma fonte com status 'aprovada' (use --todas para testar com as propostas).");
	process.exit(1);
}

const cobertas = await jaCobertas();
const limite = agora - HORAS * 3600_000;
const resultados = await Promise.allSettled(usar.map(buscarFeed));

const itens = [];
const falhas = [];
resultados.forEach((r, n) => {
	if (r.status === 'rejected') return falhas.push(`${usar[n].nome}: ${r.reason?.message ?? r.reason}`);
	const bons = r.value
		.filter((i) => i.titulo && i.link && !Number.isNaN(i.quando.getTime()) && i.quando.getTime() >= limite && i.quando.getTime() <= agora + 3600_000)
		.filter((i) => !cobertas.urls.has(i.link))
		.sort((a, b) => b.quando - a.quando)
		.slice(0, MAX);
	itens.push(...bons);
});

// histórias que aparecem em mais de uma fonte (≥3 palavras-chave em comum) sobem para o topo
const tk = itens.map((i) => tokens(i.titulo));
const pai = itens.map((_, n) => n);
const raiz = (n) => (pai[n] === n ? n : (pai[n] = raiz(pai[n])));
for (let a = 0; a < itens.length; a++)
	for (let b = a + 1; b < itens.length; b++) {
		if (itens[a].fonte === itens[b].fonte) continue;
		let comum = 0;
		for (const w of tk[a]) if (tk[b].has(w)) comum++;
		if (comum >= 3) pai[raiz(a)] = raiz(b);
	}
const grupos = new Map();
itens.forEach((_, n) => grupos.set(raiz(n), [...(grupos.get(raiz(n)) ?? []), n]));
const multi = [...grupos.values()].filter((g) => new Set(g.map((n) => itens[n].fonte)).size >= 2);

const hora = (d) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(d);
const linha = (i) => `- **${i.titulo}** — ${i.fonte}, ${hora(i.quando)}\n  ${i.link}${i.resumo ? `\n  > ${i.resumo}` : ''}`;

let md = `# Coleta de ${dia}\n\n`;
md += `Gerada por scripts/coletar-noticias.mjs em ${hora(new Date())} (Brasília) · janela: ${HORAS}h · ${itens.length} manchetes de ${usar.length - falhas.length}/${usar.length} fontes${todas ? ' (inclui fontes ainda em "proposta")' : ''}.\n`;
md += `Material bruto para a curadoria — **não é texto publicável**. Confirme cada fato na fonte antes de escrever.\n\n`;

if (cobertas.titulos.length) {
	md += `## Já cobertas pela Catarse (não repetir)\n\n${cobertas.titulos.map((c) => `- ${c.dia} — ${c.titulo}`).join('\n')}\n\n`;
}
if (multi.length) {
	md += `## Em mais de uma fonte (${multi.length})\n\n`;
	for (const g of multi.sort((a, b) => b.length - a.length)) {
		md += `### ${itens[g[0]].titulo}\n${g.map((n) => `- ${itens[n].fonte} — ${itens[n].link}`).join('\n')}\n\n`;
	}
}
md += `## Por fonte\n\n`;
for (const f of usar) {
	const daFonte = itens.filter((i) => i.fonte === f.nome);
	if (!daFonte.length) continue;
	md += `### ${f.nome} (${f.tipo})\n\n${daFonte.map(linha).join('\n')}\n\n`;
}
if (falhas.length) md += `## Fontes que falharam\n\n${falhas.map((x) => `- ${x}`).join('\n')}\n`;

await mkdir(path.join(NOTICIAS, dia), { recursive: true });
const saida = path.join(NOTICIAS, dia, 'coleta.md');
await writeFile(saida, md);
console.log(`${itens.length} manchetes, ${multi.length} histórias em 2+ fontes → ${saida}`);
if (falhas.length) console.log(`Falharam (${falhas.length}):\n  ${falhas.join('\n  ')}`);
