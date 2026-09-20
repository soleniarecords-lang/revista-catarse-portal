// Materializa as matérias PUBLICADAS no Supabase (painel "Revista Catarse" do Solenia Hub) nos mesmos
// arquivos .md que os loaders do portal já leem, e baixa as imagens para public/imagens.
//   node scripts/sincronizar-supabase.mjs
// Variáveis: SUPABASE_URL e SUPABASE_ANON_KEY (a chave anon é pública e só enxerga matérias publicadas,
// por causa da policy catarse_materias_select_publicadas_anon).
// Saída: .sync/edicoes/edicao-NN/textos/NN-slug.md e .sync/noticias/AAAA-MM-DD/NN-slug.md.
// O build usa EDICOES_DIR=.sync/edicoes e NOTICIAS_DIR=.sync/noticias.
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const URL_BASE = (process.env.SUPABASE_URL ?? '').replace(/\/$/, '');
const CHAVE = process.env.SUPABASE_ANON_KEY ?? '';
const BUCKET = 'catarse-imagens';
if (!URL_BASE || !CHAVE) {
	console.error('Faltam SUPABASE_URL e SUPABASE_ANON_KEY.');
	process.exit(2);
}

const umaLinha = (s) => String(s ?? '').replace(/\s*\n\s*/g, ' ').trim();
const dois = (n) => String(n).padStart(2, '0');

async function buscar() {
	const url = `${URL_BASE}/rest/v1/catarse_materias?status=eq.publicada&select=*&order=tipo.asc,edicao.asc,dia.asc,ordem.asc`;
	const r = await fetch(url, { headers: { apikey: CHAVE, Authorization: `Bearer ${CHAVE}` } });
	if (!r.ok) throw new Error(`Supabase respondeu ${r.status}: ${(await r.text()).slice(0, 200)}`);
	return r.json();
}

async function baixarImagem(m) {
	const ext = (path.extname(m.imagem_path) || '.jpg').toLowerCase();
	const rel = `/imagens/${m.slug}/capa${ext}`;
	const r = await fetch(`${URL_BASE}/storage/v1/object/public/${BUCKET}/${m.imagem_path}`);
	if (!r.ok) throw new Error(`${m.slug}: imagem ${m.imagem_path} não baixou (${r.status})`);
	const destino = path.join(RAIZ, 'public', rel);
	await mkdir(path.dirname(destino), { recursive: true });
	await writeFile(destino, Buffer.from(await r.arrayBuffer()));
	return rel;
}

function cabecalho(m, imagem) {
	const linhas = [
		`quadro: ${umaLinha(m.quadro)}`,
		`titulo: ${umaLinha(m.titulo)}`,
		`subtitulo: ${umaLinha(m.subtitulo)}`,
	];
	if (imagem) linhas.push(`imagem: ${imagem}`);
	if (m.credito) linhas.push(`credito: ${umaLinha(m.credito)}`);
	if (m.credito_url) linhas.push(`credito_url: ${umaLinha(m.credito_url)}`);
	if (m.licenca_url) linhas.push(`licenca_url: ${umaLinha(m.licenca_url)}`);
	if (m.autor) linhas.push(`autor: ${umaLinha(m.autor)}`);
	if (m.data_publicacao) linhas.push(`data: ${new Date(m.data_publicacao).toISOString()}`);
	linhas.push('aprovado: true');
	if (m.tipo === 'noticia') {
		linhas.push('fontes:');
		for (const f of m.fontes ?? []) linhas.push(`- ${umaLinha(f.nome).replace(/\|/g, '/')} | ${umaLinha(f.url)}`);
	}
	return `---\n${linhas.join('\n')}\n---\n\n${String(m.corpo ?? '').replace(/\r\n/g, '\n').trim()}\n`;
}

const materias = await buscar();
// trava de segurança: banco vazio ou consulta errada não pode virar um site vazio no ar
if (materias.length === 0 && !process.argv.includes('--permitir-vazio')) {
	console.error('Nenhuma matéria publicada veio do Supabase. Abortei para não publicar um site vazio (use --permitir-vazio se for de propósito).');
	process.exit(1);
}
await rm(path.join(RAIZ, '.sync'), { recursive: true, force: true });
await mkdir(path.join(RAIZ, '.sync/edicoes'), { recursive: true });
await mkdir(path.join(RAIZ, '.sync/noticias'), { recursive: true });

let edicoes = 0;
let noticias = 0;
for (const m of materias) {
	const imagem = m.imagem_path ? await baixarImagem(m) : null;
	const arquivo = `${dois(m.ordem)}-${m.slug}.md`;
	const pasta =
		m.tipo === 'edicao'
			? path.join(RAIZ, '.sync/edicoes', `edicao-${dois(m.edicao)}`, 'textos')
			: path.join(RAIZ, '.sync/noticias', m.dia);
	await mkdir(pasta, { recursive: true });
	await writeFile(path.join(pasta, arquivo), cabecalho(m, imagem));
	if (m.tipo === 'edicao') edicoes++;
	else noticias++;
}
console.log(`Sincronizado: ${edicoes} matérias de edição e ${noticias} notícias publicadas.`);
