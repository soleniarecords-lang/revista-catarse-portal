export const NOME_SITE = 'Revista Catarse';
export const LEMA = 'A voz do indie';
export const SUBSTACK_URL: string = import.meta.env.SUBSTACK_URL ?? 'https://revistacatarse.substack.com';

// Janela do sitemap de notícias. O Google News só aceita matérias das últimas 48 horas.
export const JANELA_NOTICIAS_HORAS = Number(import.meta.env.NOTICIAS_JANELA_HORAS ?? 48);
