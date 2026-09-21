// Importação única: leva as matérias que hoje vivem em ../edicoes e ../noticias (arquivos .md + fotos em
// public/imagens) para o Supabase, onde o painel do Hub passa a ser a fonte da verdade.
//   node scripts/importar-para-supabase.mjs              só confere e mostra o que faria (não grava nada)
//   node scripts/importar-para-supabase.mjs --aplicar    grava no Supabase (upsert por slug, pode rodar de novo)
//   --saida=arquivo.json                                  também salva as linhas em JSON (teste local do sincronizar)
// Variáveis: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (a mesma do Solenia Hub; nunca vai para o repositório).
// aprovado: true no cabeçalho vira "publicada"; o resto entra como "rascunho".
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lerCabecalho } from '../src/loaders/edicoes.ts';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const aplicar = process.argv.includes('--aplicar');
const URL_BASE = (process.env.SUPABASE_URL ?? '').replace(/\/$/, '');
const CHAVE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const BUCKET = 'catarse-imagens';
if (aplicar && (!URL_BASE || !CHAVE)) {
	console.error('Para --aplicar faltam SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.');
	process.exit(2);
}

const MESES = { janeiro: 0, fevereiro: 1, marco: 2, abril: 3, maio: 4, junho: 5, julho: 6, agosto: 7, setembro: 8, outubro: 9, novembro: 10, dezembro: 11 };
const semAcento = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

async function dataDaEdicao(dir) {
	try {
		const { dados } = lerCabecalho(await readFile(path.join(dir, 'pauta.md'), 'utf8'));
		const [mes, ano] = semAcento(dados['mês'] ?? '').split('/');
		if (mes in MESES && ano) return new Date(Date.UTC(Number(ano), MESES[mes], 1, 12)).toISOString();
	} catch {}
	return null;
}

// legenda das redes (Instagram e TikTok): arquivo ao lado da matéria, NN-slug.legenda.txt (o portal ignora esse arquivo)
async function lerLegenda(dir, arq) {
	try {
		return (await readFile(path.join(dir, arq.replace(/[.]md$/, '.legenda.txt')), 'utf8')).replaceAll(String.fromCharCode(13), '').trim() || null;
	} catch {
		return null;
	}
}

const materias = [];

// edições
const dirEd = path.resolve(RAIZ, '../edicoes');
for (const pasta of (await readdir(dirEd, { withFileTypes: true })).filter((d) => d.isDirectory() && /^edicao-\d+$/.test(d.name))) {
	let arquivos = [];
	try {
		arquivos = (await readdir(path.join(dirEd, pasta.name, 'textos'))).filter((f) => f.endsWith('.md')).sort();
	} catch {
		continue;
	}
	const dataEd = await dataDaEdicao(path.join(dirEd, pasta.name));
	for (const arq of arquivos) {
		const { dados, corpo } = lerCabecalho(await readFile(path.join(dirEd, pasta.name, 'textos', arq), 'utf8'));
		const [, ordem, slug] = arq.match(/^(\d+)-(.+)\.md$/) ?? [];
		if (!dados.titulo || !slug) continue;
		materias.push({
			tipo: 'edicao', edicao: Number(pasta.name.replace('edicao-', '')), dia: null, ordem: Number(ordem), slug, dados, corpo,
			data: dados.data || dataEd, fontes: [], legenda: await lerLegenda(path.join(dirEd, pasta.name, 'textos'), arq),
		});
	}
}

// notícias
const dirNo = path.resolve(RAIZ, '../noticias');
try {
	for (const dia of (await readdir(dirNo, { withFileTypes: true })).filter((d) => d.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(d.name))) {
		for (const arq of (await readdir(path.join(dirNo, dia.name))).filter((f) => /^\d+-.+\.md$/.test(f)).sort()) {
			const { dados, listas, corpo } = lerCabecalho(await readFile(path.join(dirNo, dia.name, arq), 'utf8'));
			const [, ordem, slug] = arq.match(/^(\d+)-(.+)\.md$/) ?? [];
			if (!dados.titulo || !slug) continue;
			const fontes = (listas.fontes ?? []).map((l) => {
				const [nome, url] = l.split('|').map((s) => s.trim());
				return { nome, url };
			});
			materias.push({ tipo: 'noticia', edicao: null, dia: dia.name, ordem: Number(ordem), slug, dados, corpo, data: dados.data || null, fontes, legenda: await lerLegenda(path.join(dirNo, dia.name), arq) });
		}
	}
} catch {}

const linhas = [];
const imagens = [];
for (const m of materias) {
	const d = m.dados;
	const publicada = d.aprovado === 'true';
	let imagemPath = null;
	if (d.imagem) {
		imagemPath = `${m.slug}/capa${path.extname(d.imagem) || '.jpg'}`;
		imagens.push({ origem: path.join(RAIZ, 'public', d.imagem), destino: imagemPath, slug: m.slug });
	}
	linhas.push({
		tipo: m.tipo, edicao: m.edicao, dia: m.dia, ordem: m.ordem, slug: m.slug,
		quadro: d.quadro || 'Mainstream', titulo: d.titulo, subtitulo: d.subtitulo ?? '', corpo: m.corpo.trim(),
		autor: d.autor || 'Redação Revista Catarse',
		imagem_path: imagemPath, credito: d.credito || null, credito_url: d.credito_url || null, licenca_url: d.licenca_url || null,
		fontes: m.fontes, legenda: m.legenda, status: publicada ? 'publicada' : 'rascunho',
		data_publicacao: m.data ? new Date(m.data).toISOString() : null,
		publicada_em: publicada && m.data ? new Date(m.data).toISOString() : null,
	});
}

// --somente=slug1,slug2 limita a importação a essas matérias (não mexe nas demais, que podem ter sido editadas no Hub)
const somente = process.argv.find((a) => a.startsWith('--somente='))?.slice(10).split(',');
if (somente) {
	for (const lista of [linhas, imagens]) {
		for (let i = lista.length - 1; i >= 0; i--) if (!somente.includes(lista[i].slug)) lista.splice(i, 1);
	}
}

const pub = linhas.filter((l) => l.status === 'publicada').length;
console.log(`${linhas.length} matérias lidas (${pub} publicadas, ${linhas.length - pub} rascunhos), ${imagens.length} imagens.`);
for (const l of linhas) console.log(`  ${l.status === 'publicada' ? 'NO AR  ' : 'rascunho'} ${l.tipo === 'edicao' ? `ed${String(l.edicao).padStart(2, '0')}` : l.dia} #${l.ordem} ${l.slug}${l.imagem_path ? '' : '  (sem imagem)'}`);
const saida = process.argv.find((a) => a.startsWith('--saida='))?.slice(8);
if (saida) {
	const { writeFile } = await import('node:fs/promises');
	await writeFile(saida, JSON.stringify(linhas, null, 1));
	console.log(`linhas gravadas em ${saida} (para testes locais)`);
}
if (!aplicar) {
	console.log('\n(conferência: nada foi gravado. Use --aplicar para gravar.)');
	process.exit(0);
}

const cab = { apikey: CHAVE, Authorization: `Bearer ${CHAVE}` };
for (const im of imagens) {
	const corpo = await readFile(im.origem);
	const tipo = /\.png$/i.test(im.destino) ? 'image/png' : /\.webp$/i.test(im.destino) ? 'image/webp' : 'image/jpeg';
	// cria (POST); se o arquivo já existe, substitui (PUT). O upsert do POST deu erro 500 (42P10) neste projeto.
	const alvo = `${URL_BASE}/storage/v1/object/${BUCKET}/${im.destino}`;
	let r = await fetch(alvo, { method: 'POST', headers: { ...cab, 'Content-Type': tipo }, body: corpo });
	if (r.status === 400 || r.status === 409) r = await fetch(alvo, { method: 'PUT', headers: { ...cab, 'Content-Type': tipo }, body: corpo });
	if (!r.ok) throw new Error(`${im.slug}: upload falhou (${r.status}) ${(await r.text()).slice(0, 160)}`);
}
console.log(`${imagens.length} imagens enviadas.`);

const r = await fetch(`${URL_BASE}/rest/v1/catarse_materias?on_conflict=slug`, {
	method: 'POST',
	headers: { ...cab, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
	body: JSON.stringify(linhas),
});
if (!r.ok) throw new Error(`Gravação falhou (${r.status}) ${(await r.text()).slice(0, 300)}`);
console.log(`${linhas.length} matérias gravadas no Supabase.`);
