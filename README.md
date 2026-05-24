# tempo_sp

Site estático/PWA mínimo que mostra o meteograma mais recente do INMET para São Paulo (`3550308`).

Regra de seleção de endpoint (horário de São Paulo):
- 13:00 ou mais: `YYYY-MM-DD/12`
- 01:00 até 12:59: `YYYY-MM-DD/00`
- 00:00 até 00:59: dia anterior em `12`
