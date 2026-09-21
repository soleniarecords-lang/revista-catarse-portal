// Aprova notícias: valida e, só se TUDO passar, grava `aprovado: true` e `data:` (agora, Brasília).
//   node scripts/aprovar.mjs ../noticias/2026-09-19/01-slug.md [outro.md ...]
//   node scripts/aprovar.mjs --desfazer ../noticias/2026-09-19/01-slug.md   (volta para rascunho)
//
// Roda por ordem explícita do Luciano (via /catarse-publicar): nenhuma skill aprova por conta própria.
// Tudo ou nada: se um arquivo falhar na validação, nenhum é alterado.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { lerCabecalho } from '../src/loaders/edicoes.ts';

const desfazer = process.argv.includes('--desfazer');
const arquivos = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!arquivos.length) {
	console.error('Uso: node scripts/aprovar.mjs [--desfazer] <arquivo.md> [...]');
	process.exit(2);
}

/** "2026-09-19T14:05:00-03:00" no fuso de Brasília, com o deslocamento lido do próprio sistema de fusos. */
function agoraBRT() {
	const d = new Date();
	const p = Object.fromEntries(
		new Intl.DateTimeFormat('en-CA', {
			timeZone: 'America/Sao_Paulo', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
			hour: '2-digit', minute: '2-digit', second: '2-digit',
		}).formatToParts(d).map((x) => [x.type, x.value]),
	);
	const off = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', timeZoneName: 'longOffset' })
		.formatToParts(d).find((x) => x.type === 'timeZoneName').value.replace('GMT', '') || '+00:00';
	return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${off.length === 3 ? `${off}:00` : off}`;
}

function validar(caminho, texto) {
	const erros = [];
	const { dados, listas, corpo } = lerCabecalho(texto);
	if (!dados.titulo) erros.push('sem "titulo"');
	if (!dados.subtitulo) erros.push('sem "subtitulo"');
	if (dados.titulo && dados.titulo.length > 110) erros.push(`título com ${dados.titulo.length} caracteres (máximo 110)`);
	const pend = (texto.match(/\[CONFIRMAR/g) ?? []).length;
	if (pend) erros.push(`${pend} marcador(es) [CONFIRMAR] ainda no texto`);
	const dominios = new Set();
	for (const f of listas.fontes ?? []) {
		const url = f.split('|')[1]?.trim();
		try {
			dominios.add(new URL(url).hostname.replace(/^www\./, ''));
		} catch {
			erros.push(`fonte com URL inválida: "${f}"`);
		}
	}
	// Caderno Solenia é texto literário autoral da Catarse: não exige fontes nem tamanho mínimo
	const literario = dados.quadro === 'Caderno Solenia';
	if (!literario && dominios.size < 2) erros.push(`só ${dominios.size} veículo(s) diferente(s) em "fontes" — o mínimo é 2 (nunca fonte única)`);
	if (!literario && corpo.trim().split(/\s+/).length < 120) erros.push('texto com menos de 120 palavras');
	// regra de escrita do Luciano: nunca travessão (— –) nem hífen com espaços no papel de travessão
	for (const [campo, valor] of [['título', dados.titulo], ['subtítulo', dados.subtitulo], ['texto', corpo]]) {
		if (/[—–]|\S - \S/.test(valor ?? '')) erros.push(`${campo} com travessão (use vírgula, ponto, dois-pontos ou parênteses)`);
	}
	return erros;
}

/** Troca (ou insere) uma chave do cabeçalho, sem mexer no resto do arquivo. */
function definir(texto, chave, valor, depoisDe) {
	const re = new RegExp(`^${chave}:.*$`, 'm');
	if (re.test(texto.split(/\n---\n/)[0] + '\n')) return texto.replace(re, `${chave}: ${valor}`);
	return texto.replace(new RegExp(`^(${depoisDe}:.*)$`, 'm'), `$1\n${chave}: ${valor}`);
}

const lidos = [];
let falhou = false;
for (const a of arquivos) {
	const caminho = path.resolve(a);
	const texto = (await readFile(caminho, 'utf8')).replace(/\r\n/g, '\n');
	if (!desfazer) {
		const erros = validar(caminho, texto);
		if (erros.length) {
			falhou = true;
			console.error(`✗ ${a}\n${erros.map((e) => `    - ${e}`).join('\n')}`);
			continue;
		}
	}
	lidos.push({ a, caminho, texto });
}
if (falhou) {
	console.error('\nNada foi alterado.');
	process.exit(1);
}

const agora = agoraBRT();
for (const { a, caminho, texto } of lidos) {
	let novo = texto;
	if (desfazer) {
		novo = definir(novo, 'aprovado', 'false', 'subtitulo');
	} else {
		novo = definir(novo, 'data', agora, 'subtitulo');
		novo = definir(novo, 'aprovado', 'true', 'data');
	}
	await writeFile(caminho, novo);
	console.log(`${desfazer ? '↩ rascunho' : '✓ aprovada'}  ${a}${desfazer ? '' : `  (data ${agora})`}`);
}
