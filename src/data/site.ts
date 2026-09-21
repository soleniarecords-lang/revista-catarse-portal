export const NOME_SITE = 'Revista Catarse';
export const LEMA = 'A voz do indie';
// Google Tag Manager do site. Só carrega no site publicado (build de produção), nunca no `astro dev`.
export const GTM_ID = 'GTM-N3HKSMZL';
// Google Analytics 4 (gtag.js) instalado direto no site. Só carrega no site publicado.
// Se um dia a mesma propriedade for criada como tag dentro do GTM, remova um dos dois para não contar visita em dobro.
export const GA_ID = 'G-BX5SBKSGFW';
export const SUBSTACK_URL: string = import.meta.env.SUBSTACK_URL ?? 'https://revistacatarse.substack.com';

// Janela do sitemap de notícias. O Google News só aceita matérias das últimas 48 horas.
export const JANELA_NOTICIAS_HORAS = Number(import.meta.env.NOTICIAS_JANELA_HORAS ?? 48);
