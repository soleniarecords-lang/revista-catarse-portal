// Os 8 quadros oficiais (referencia/linha-editorial.md).
// Cores: família de verdes (teal da Substack como base). Sem vermelho, dourado ou roxo: decisão do Luciano
// em 19/09/2026. Cada quadro tem um tom diferente de verde, que tinge o gradiente granulado das capas
// tipográficas e o marcador ao lado do nome.
export interface Quadro {
	slug: string;
	nome: string;
	chamada: string;
	descricao: string;
	cor: string; // tom do quadro (marcador e gradiente da capa tipográfica)
}

export const quadros: Quadro[] = [
	{
		slug: 'mainstream',
		nome: 'Mainstream',
		chamada: 'Atualidades',
		descricao:
			'Artistas, lançamentos, turnês e movimentos da indústria, sempre com contexto e a pergunta a mais por trás do fato.',
		cor: '#0d9488', // o verde-azulado da Substack
	},
	{
		slug: 'backstage',
		nome: 'Solenia Backstage',
		chamada: 'Bastidores do selo',
		descricao:
			'Bastidores reais dos projetos da Solenia: processo, decisões criativas, obstáculos e o que se aprendeu.',
		cor: '#2f7d5b', // floresta
	},
	{
		slug: 'mercado-real',
		nome: 'Mercado Real',
		chamada: 'Dinheiro e viabilidade',
		descricao:
			'Custos, receitas, direitos e economia da música: realidade financeira, com números e sem promessa de fama.',
		cor: '#1b6b5f', // pinho
	},
	{
		slug: 'perfil-criativo',
		nome: 'Perfil Criativo',
		chamada: 'Pessoas e trajetórias',
		descricao:
			'Perfis aprofundados de artistas, produtores e profissionais: trajetória, virada, método e futuro.',
		cor: '#8fb27c', // sálvia
	},
	{
		slug: 'lab-estetico',
		nome: 'Lab Estético',
		chamada: 'Estética como estratégia',
		descricao:
			'Capas, clipes e direção de arte lidos como decisão estratégica, sempre a partir de uma peça visual real.',
		cor: '#5fcf9e', // menta
	},
	{
		slug: 'caderno-solenia',
		nome: 'Caderno Solenia',
		chamada: 'Literatura e poesia',
		descricao: 'Poemas, cartas, crônicas e manifestos autorais, com curadoria.',
		cor: '#b9d3ad', // sálvia clara
	},
	{
		slug: 'debates-improvaveis',
		nome: 'Debates Improváveis',
		chamada: 'Discussões inúteis com seriedade',
		descricao:
			'Perguntas absurdas tratadas com lógica, humor inteligente e uma conclusão irônica.',
		cor: '#7fdca5', // verde-limão pastel
	},
	{
		slug: 'guia-pratico',
		nome: 'Guia Prático',
		chamada: 'Conteúdo acionável',
		descricao: 'Passo a passo, checklists e ferramentas para aplicar hoje.',
		cor: '#6c8579', // verde-cinza
	},
];

const norm = (s: string) =>
	s
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.trim();

const porNome = new Map(quadros.map((q) => [norm(q.nome), q]));

export function quadroPorNome(nome: string): Quadro | undefined {
	return porNome.get(norm(nome));
}

export function quadroPorSlug(slug: string): Quadro | undefined {
	return quadros.find((q) => q.slug === slug);
}
