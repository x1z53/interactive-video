# Interactive Film Editor

Редактор интерактивных видео на базе Tauri + React + TypeScript + Vite.

## Возможности

- Добавление видео-нод и связей между ними.
- Выбор стартовой ноды.
- Сохранение/загрузка проектов в формате JSON.
- Экспорт в HTML-плеер (`project.json` + `index.html` + `player.js`).
- Экспорт в standalone-приложение (Tauri executable + `project.json`).
- **Экспорт в YAML для [interactive-video-player](../interactive-video-player/)** (`project.yaml` + папка `videos/`).
- **Встроенный запуск `interactive-video-player`** прямо из редактора кнопкой **▶ Play YAML**.
- **Экспорт Windows-плеера** (`project.json` + `videos/` + `run.bat` + `*.exe`).

## Экспорт в YAML

1. Нажмите **Export YAML** в панели инструментов.
2. Выберите директорию для экспорта.
3. В выбранной директории появятся:
   - `project.yaml` — сценарий в формате `interactive-video-player`;
   - `videos/` — скопированные видеофайлы.

Пример сгенерированного `project.yaml`:

```yaml
nodes:
  - id: 1
    title: "Start"
    file: "videos/start.mp4"
    outputs:
      - 2
      - 3
  - id: 2
    title: "Choice A"
    file: "videos/choice_a.mp4"
  - id: 3
    title: "Choice B"
    file: "videos/choice_b.mp4"
```

Стартовая нода всегда размещается первой в списке (GTK-плеер начинает воспроизведение с первой ноды).

## Запуск встроенного YAML-плеера

Кнопка **▶ Play YAML** экспортирует текущий проект во временную директорию и запускает встроенный `interactive-video-player`.

Требования:

- Python 3.
- Зависимости из `src-tauri/player/requirements.txt`:
  ```bash
  python3 -m pip install -r src-tauri/player/requirements.txt
  ```
- В системе должны быть установлены GTK4, Libadwaita и их typelibs (см. README `interactive-video-player`).

## Экспорт Windows-плеера

Кнопка **Export Windows** создаёт директорию с автономным Windows-плеером на базе WebView2/Tauri.

Структура выходной директории:

- `<exe-name>.exe` — исполняемый файл плеера (WebView2-based Tauri app).
- `project.json` — сценарий в формате встроенного HTML-плеера.
- `videos/` — скопированные видеофайлы.
- `run.bat` — скрипт запуска.
- `README.txt` — инструкция.

Если на момент экспорта `.exe` отсутствует, редактор создаст `run.bat` с инструкцией, где его скачать.

### Получение Windows-исполняемого файла

1. Соберите проект на Windows вручную (`npm run tauri build`).
2. Либо используйте GitHub Actions workflow `.github/workflows/build-windows-player.yml` — он собирает `.msi`, `.exe` (NSIS) и портативный `.exe` на `windows-latest` runner и выкладывает их в артефакты/релиз.
3. Скачайте готовый `.exe` из артефактов или GitHub Releases и укажите его при экспорте.

## Разработка

Рекомендуемая среда: VS Code + Tauri + rust-analyzer.

### Команды

```bash
npm install
npm run dev      # запуск в режиме разработки
npm run build    # production-сборка
npm run tauri    # команды Tauri CLI
```
