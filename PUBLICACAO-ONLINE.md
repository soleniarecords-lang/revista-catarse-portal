# Publicação online pelo Solenia Hub

O painel **Revista Catarse** do Hub é a fonte da verdade das matérias. O caminho de uma publicação:

1. Você escreve ou aprova a matéria no Hub (`/revista-catarse`).
2. O Hub grava no Supabase (tabela `catarse_materias`, imagens no bucket `catarse-imagens`) e chama a API do GitHub.
3. O GitHub Actions roda `.github/workflows/publicar.yml`: baixa as matérias publicadas (`scripts/sincronizar-supabase.mjs`), gera o site e sobe na Cloudflare (`wrangler deploy`).
4. O site atualiza em 1 a 2 minutos.

O que já está pronto no código (nada disso foi ligado em produção ainda):

- Hub: migração `supabase/migrations/0005_catarse.sql`, módulo `app/(app)/revista-catarse`, regras em `lib/catarse-types.ts`, disparo em `lib/catarse-publicar.ts`.
- Portal: `scripts/sincronizar-supabase.mjs`, `scripts/importar-para-supabase.mjs`, `.github/workflows/publicar.yml`.
- Testado: o build feito a partir do que o sincronizador gera é idêntico, arquivo por arquivo, ao build atual do site.

## Ordem para ligar

1. **Migração**: aplicar `0005_catarse.sql` no projeto Supabase `yaimkqkzqxjyvswvtnju` (cria as tabelas, as regras de acesso e o bucket de imagens).
2. **Importar o que já existe**: `node scripts/importar-para-supabase.mjs` (só confere) e depois `--aplicar`. Precisa de `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` no ambiente (a mesma chave do Hub, que nunca vai para o repositório).
3. **Repositório do portal**: criar um repositório privado no GitHub com o conteúdo desta pasta (`portal/`).
4. **Segredos no repositório do portal** (Settings, Secrets and variables, Actions):
   - Secret `CLOUDFLARE_API_TOKEN`: token da Cloudflare com o modelo "Edit Cloudflare Workers".
   - Secret `CLOUDFLARE_ACCOUNT_ID`: id da conta Cloudflare.
   - Secret `SUPABASE_ANON_KEY`: a chave anon (pública) do projeto.
   - Variable `SUPABASE_URL`: `https://yaimkqkzqxjyvswvtnju.supabase.co`.
5. **Token do Hub para disparar o workflow**: criar um token fine-grained no GitHub, restrito só ao repositório do portal, com a permissão "Actions: Read and write".
6. **Variáveis do Hub no Render**:
   - `CATARSE_GITHUB_TOKEN`: o token do passo 5.
   - `CATARSE_GITHUB_REPO`: `dono/repositorio` do portal.
   - `CATARSE_SITE_URL`: endereço público do site (para os links "ver no site").
   - Opcionais: `CATARSE_GITHUB_WORKFLOW` (padrão `publicar.yml`) e `CATARSE_GITHUB_REF` (padrão `main`).
7. **Subir o Hub** (push na branch `master`, o Render publica sozinho).

Sem as variáveis do passo 6 o Hub continua funcionando: salva no banco e avisa que a publicação automática não está configurada.

## Regras que o Hub aplica ao aprovar

Título até 110 caracteres e subtítulo preenchido; um dos 8 quadros; nada de travessão (`—`, `–` ou hífen entre espaços); nenhum `[CONFIRMAR]`; toda matéria com imagem e crédito; notícia com ao menos 120 palavras e 2 fontes de domínios diferentes. O botão "Aprovar e publicar" só habilita quando tudo passa, e o servidor confere de novo antes de gravar.

## Segurança

- Credencial de plataforma nunca fica no app: o token do GitHub vive só no servidor do Hub e o token da Cloudflare só no GitHub.
- A chave anon do Supabase só enxerga matérias com status `publicada` (policy `catarse_materias_select_publicadas_anon`).
- Quem entra no Hub pode publicar. Se mais pessoas ganharem login, vale restringir por papel.
