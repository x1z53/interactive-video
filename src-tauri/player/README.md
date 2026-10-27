# YAML Video Player

GTK4/Libadwaita приложение на Python 3, которое воспроизводит интерактивное видео по YAML-сценарию.

## Возможности

- Разбор YAML-файла на ноды.
- Проверка обязательных полей (`id`, `title`, `file`) и опциональных `outputs`.
- Проверка существования видеофайлов.
- Автовоспроизведение видео в полноэкранном режиме со звуком, без зацикливания.
- По окончании видео показываются кнопки перехода к нодам из `outputs`.

## Установка зависимостей

Убедитесь, что в системе установлены GTK4, Libadwaita и их typelibs. Пример для Fedora:

```bash
sudo dnf install gtk4 libadwaita gobject-introspection python3-gobject
```

Для Debian/Ubuntu:

```bash
sudo apt install libadwaita-1-0 libadwaita-1-dev gir1.2-adw-1 python3-gi python3-gi-cairo gir1.2-gtk-4.0
```

Затем установите Python-зависимости:

```bash
python3 -m pip install -r requirements.txt
```

## Запуск

```bash
python3 main.py sample.yaml
```

### Пользовательский CSS

По умолчанию приложение автоматически загружает файл `style.css` из директории проекта. Его можно отредактировать или переопределить через флаг `--css`:

```bash
python3 main.py sample.yaml --css sample.css
```

Пример CSS-файла — `style.css`. В нём показано, как скрыть элементы управления видео и стилизовать кнопки выбора, появляющиеся по окончании ролика.

Пути к видео в YAML могут быть относительными (относительно расположения YAML-файла) или абсолютными.
