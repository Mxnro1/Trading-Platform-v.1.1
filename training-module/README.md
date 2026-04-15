# Training Module Export

Этот каталог содержит автономный экспорт блока обучения из исходного проекта.

Содержимое:
- `index.html` — список глав.
- `stages/stage_0.html ... stages/stage_8.html` — главы обучения.
- `assets/images/training/` — изображения из обучения.
- `assets/images/stages/` — превью этапов.
- `assets/svg/logo.svg` — логотип.
- `assets/css/training.css` — стили модуля.
- `assets/js/training.js` — инициализация анимаций AOS.

Как встроить в другой проект:
1. Скопировать папку `training-module` в целевой проект.
2. Добавить ссылку на `training-module/index.html` или встроить содержимое страниц в нужный роут.
3. Если в проекте CSP, разрешить CDN для `bootstrap`, `fontawesome`, `mdi`, `boxicons`, `aos`.
