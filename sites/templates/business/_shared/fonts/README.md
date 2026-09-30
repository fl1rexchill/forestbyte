# Шрифты

Шрифты лежат локально, чтобы сайт не обращался к Google Fonts до согласия посетителя и работал без внешних ресурсов.
Файлы скачаны с Google Fonts (подмножества `cyrillic` и `latin`, формат woff2). Лицензия каждого семейства — SIL Open Font License 1.1, текст — в `<семейство>/OFL.txt`.

| Файл CSS | Семейство | Где используется |
|---|---|---|
| `unbounded.css` | Unbounded | event — заголовки |
| `onest.css` | Onest | event — текст, cosmetology — текст |
| `manrope.css` | Manrope | detailing, оглавление |
| `jetbrainsmono.css` | JetBrains Mono | detailing — технические подписи |
| `robotocondensed.css` | Roboto Condensed | auto — заголовки |
| `golostext.css` | Golos Text | auto — текст |
| `lora.css` | Lora | cosmetology — заголовки |
| `playfairdisplay.css` | Playfair Display | beauty — заголовки |
| `montserrat.css` | Montserrat | beauty — текст |

Как заменить шрифт: подключите свой CSS с `@font-face` в `index.html`, затем укажите семейство в `config.js → brand.fonts` (`heading`, `body`).
