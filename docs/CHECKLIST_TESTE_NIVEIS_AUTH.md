# Checklist de Teste por Nível (Supabase Auth)

## Pré-requisitos

- Cada usuário ativo deve ter:
  - `login` preenchido (apenas dígitos).
  - `auth_email` preenchido em `public.usuarios`.
  - usuário existente em `Authentication > Users` com o mesmo email.
- Usuário com `ativo = false` deve falhar no login.

## Rotas esperadas após login

- `app login = /admin` -> `/admin`
- `app login = /vendedor` -> `/vendedor`
- `app login = /gestorcomercial` -> `/vendedor`
- `app login = /supervisor` -> `/vendedor`
- `app login = /producao` -> `/vendedor`
- `app login = /transferencias` -> `/catalog`
- `app login = /cliente_B2B` -> `/catalog`
- `app login = /cliente_B2C` -> `/catalog`

Obs.: se `app login` estiver vazio, o fallback usa `Nivel`:
- `Nivel >= 6` -> `/vendedor`
- `Nivel 1..5` -> `/catalog`

## Matriz funcional mínima

1. `Nivel 10` (Admin): entra, acessa `/admin` e `/vendedor`.
2. `Nivel 8/7/6` (Gestor/Supervisor): entra em `/vendedor`, consegue confirmar/avançar/cancelar com motivo.
3. `Gestor Comercial`: nao deve acessar `/admin` (separado de perfil admin).
4. `Nivel 5` (Vendedor): entra em `/vendedor`, só cancela pedido `PEDIDO ENVIADO`.
5. `Nivel 3` (Transferência): entra em `/catalog`, validar preço de `TAB2` após login.
6. `Nivel 2/1` (Cliente): entra em `/catalog`, sem acesso a dashboards.
7. `ativo=false`: login deve falhar com mensagem de usuário inativo.

## SQL de auditoria rápida

```sql
-- ativos sem login/auth_email
select usuario, login, "Nivel", tipo_de_Usuario, auth_email
from public.usuarios
where ativo is true
  and (coalesce(trim(login),'') = '' or coalesce(trim(auth_email),'') = '');

-- auth_email sem usuário no auth.users
select u.usuario, u.login, u."Nivel", u.auth_email
from public.usuarios u
left join auth.users a on lower(a.email) = lower(u.auth_email)
where u.ativo is true
  and coalesce(u.auth_email,'') <> ''
  and a.id is null;
```
