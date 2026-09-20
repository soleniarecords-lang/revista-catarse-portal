export interface Autor {
	slug: string;
	nome: string;
	descricao: string;
}

// Decisão editorial: toda matéria é assinada pela redação, sem nomes de pessoas.
export const autores: Autor[] = [
	{
		slug: 'redacao-revista-catarse',
		nome: 'Redação Revista Catarse',
		descricao:
			'A redação da Revista Catarse, revista da Solenia Records dedicada ao indie: mercado, bastidores, perfis, estética e ensaios sobre música.',
	},
];

export const REDACAO = autores[0];

/** Nome desconhecido (ex.: "Revista Catarse", vindo do Substack) cai na redação. */
export function autorPorNome(nome?: string): Autor {
	return autores.find((a) => a.nome === nome) ?? REDACAO;
}

export const hrefAutor = (a: Autor) => `/autor/${a.slug}/`;
