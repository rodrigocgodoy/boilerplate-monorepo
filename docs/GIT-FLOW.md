# Fluxo de Git (opcional)

O boilerplate funciona trabalhando direto na `main` — é o suficiente para um
projeto de uma pessoa ou em fase de validação. Este documento descreve o fluxo
com branch de integração, para quando a equipe crescer ou a produção deixar de
poder receber cada merge.

**Nada aqui é obrigatório.** A Action `sync-main-to-dev` já está no repositório,
mas só age se a branch `dev` existir; enquanto não existir, é no-op.

---

## O fluxo

```
feat/*  ──PR──►  dev  ──release──►  main  ──►  produção
                  ▲                   │
                  └───── sync ────────┘   (automático)
fix/*   ──────────PR───────────────► main
```

- **`main` = produção.** Todo merge aqui vai para o ar.
- **`dev` = integração.** Features acumulam aqui até a release.
- **Feature ou bug não urgente:** branch `feat/*` a partir da `dev`, PR para `dev`.
- **Hotfix:** branch `fix/*` a partir da **`main`** (não da `dev`), PR para `main`.

## Por que hotfix sai da `main`

A `dev` tem features que ainda não foram lançadas. Um hotfix que saísse dela
carregaria essas features junto para produção — você subiria código não
validado no meio de um incidente, que é o pior momento possível para isso.
Saindo da `main`, o fix leva só ele mesmo.

## Por que o sync é automático

Depois de um hotfix, a `main` tem um commit que a `dev` não tem. Se ninguém
fizer o back-merge, a próxima release (`dev → main`) **reverte o hotfix** — e o
bug volta a produção sem que ninguém tenha tocado nele. É um erro silencioso,
que só aparece quando o cliente reclama de novo.

Confiar na memória de quem acabou de apagar um incêndio às 3 da manhã não é um
plano. A Action `.github/workflows/sync-main-to-dev.yml` roda em **todo** push na
`main`:

- **Merge limpo** → empurra para a `dev` e acabou.
- **Conflito** → abre uma PR para alguém resolver. Bot não resolve conflito às
  cegas, e falhar em silêncio seria pior.
- **Release (`dev → main`)** → vira no-op, porque a `dev` já tem tudo.

## Adotando

1. `git checkout -b dev main && git push -u origin dev`
2. Aponte as PRs de feature para `dev` (`gh pr create --base dev`).
3. Se você usar branch protection, exija o check `CHECK` também na `dev`.
4. Release = PR de `dev` para `main`, em janela decidida por você.

Para voltar atrás, basta apagar a `dev`: a Action volta a ser no-op sozinha.

## Convenções que valem nos dois fluxos

- Nunca commitar direto na branch de integração — sempre PR.
- `git fetch` e merge antes de push; nunca `--force` em branch compartilhada.
- Um bug corrigido vem com o teste que o reproduz, no mesmo commit.
