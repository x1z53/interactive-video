#!/usr/bin/env python3
"""
GTK4/Libadwaita интерактивный видеоплеер на основе YAML-сценария.
"""

import argparse
import os
import sys
from pathlib import Path
from typing import Any

# Отключаем проблемные аппаратные декодеры V4L2/VA-API, чтобы GStreamer
# использовал программные декодеры. Это предотвращает ошибки вида
# "Not enough memory to decode H264 stream" на некоторых системах.
os.environ.setdefault(
    "GST_PLUGIN_FEATURE_RANK",
    "v4l2slh264dec:NONE;v4l2slmpeg2dec:NONE;v4l2slvp8dec:NONE;"
    "v4l2slvp9dec:NONE;vaapih264dec:NONE;vaapih265dec:NONE;"
    "vaapimpeg2dec:NONE;vaapivp8dec:NONE;vaapivp9dec:NONE",
)
os.environ.setdefault("GST_VAAPI_DISABLE", "1")

import gi
import yaml

gi.require_version("Gtk", "4.0")
gi.require_version("Adw", "1")

from gi.repository import Adw, Gdk, Gio, GLib, GObject, Gtk


APP_ID = "space.x1z53.InteractiveVideoPlayer"
REQUIRED_FIELDS = {"id", "title", "file"}


class ValidationError(Exception):
    """Ошибка валидации YAML-файла или нод."""


class NodeStore:
    """Хранилище нод, загруженных из YAML."""

    def __init__(self) -> None:
        self.nodes: dict[Any, dict[str, Any]] = {}
        self.first_node_id: Any | None = None

    def load(self, path: Path) -> None:
        """Загрузить и проверить YAML-файл."""
        self.nodes.clear()
        self.first_node_id = None

        if not path.is_file():
            raise ValidationError(f"YAML-файл не найден: {path}")

        try:
            with path.open("r", encoding="utf-8") as f:
                data = yaml.safe_load(f)
        except yaml.YAMLError as exc:
            raise ValidationError(f"Ошибка разбора YAML: {exc}") from exc

        if not isinstance(data, dict):
            raise ValidationError("Корень YAML должен быть объектом.")

        raw_nodes = data.get("nodes")
        if not isinstance(raw_nodes, list):
            raise ValidationError("Отсутствует или неверный ключ 'nodes' (должен быть список).")

        if not raw_nodes:
            raise ValidationError("Список 'nodes' пуст.")

        for index, node in enumerate(raw_nodes):
            self._validate_node_shape(index, node)
            node_id = node["id"]
            if node_id in self.nodes:
                raise ValidationError(f"Дублирующийся id ноды: {node_id}")
            self.nodes[node_id] = node

        # Запоминаем первую ноду как стартовую.
        self.first_node_id = raw_nodes[0]["id"]

        # Проверяем, что все outputs ссылаются на существующие ноды.
        for node_id, node in self.nodes.items():
            outputs = node.get("outputs") or []
            for target_id in outputs:
                if target_id not in self.nodes:
                    raise ValidationError(
                        f"Нода '{node_id}' ссылается на несуществующую ноду '{target_id}'."
                    )

        # Проверяем существование видеофайлов.
        base_dir = path.parent
        for node_id, node in self.nodes.items():
            file_path = base_dir / node["file"]
            if not file_path.is_file():
                raise ValidationError(
                    f"Видеофайл ноды '{node_id}' не найден: {file_path}"
                )

    @staticmethod
    def _validate_node_shape(index: int, node: Any) -> None:
        if not isinstance(node, dict):
            raise ValidationError(f"Нода #{index} должна быть объектом.")

        missing = REQUIRED_FIELDS - set(node.keys())
        if missing:
            raise ValidationError(
                f"Нода #{index} не содержит обязательные поля: {', '.join(sorted(missing))}"
            )

        outputs = node.get("outputs")
        if outputs is not None and not isinstance(outputs, list):
            raise ValidationError(
                f"Нода '{node['id']}': 'outputs' должен быть списком."
            )


class PlayerWindow(Adw.ApplicationWindow):
    """Главное окно приложения."""

    def __init__(
        self,
        application: Adw.Application,
        store: NodeStore,
        base_dir: Path,
    ) -> None:
        super().__init__(application=application, title="YAML Video Player")
        self.set_default_size(960, 540)
        self.set_hide_on_close(False)

        self._store = store
        self._base_dir = base_dir
        self._current_node_id: Any | None = None
        self._media_stream: Gtk.MediaStream | None = None

        # --- Виджеты ---
        self._overlay = Gtk.Overlay(hexpand=True, vexpand=True)
        self._video = Gtk.Video(
            hexpand=True,
            vexpand=True,
            autoplay=True,
        )
        self._hide_video_controls()
        self._overlay.set_child(self._video)

        wrapper = Gtk.Box(
            orientation=Gtk.Orientation.VERTICAL,
            homogeneous=True,
        )

        self._end_label = Gtk.Label(
            label="Конец.",
            visible=False,
            valign=Gtk.Align.CENTER,
            halign=Gtk.Align.CENTER,
            css_classes=["end-title"],
        )
        top_box = Gtk.Box(
            orientation=Gtk.Orientation.VERTICAL,
            valign=Gtk.Align.CENTER,
            halign=Gtk.Align.CENTER,
        )
        top_box.append(self._end_label)
        wrapper.append(top_box)

        self._buttons_box = Gtk.Box(
            orientation=Gtk.Orientation.HORIZONTAL,
            spacing=12,
            homogeneous=True,
            valign=Gtk.Align.CENTER,
            halign=Gtk.Align.CENTER,
            visible=False,
            width_request=600,
            css_classes=["buttons-osd"],
        )

        wrapper.append(self._buttons_box)
        self._overlay.add_overlay(wrapper)

        self.set_content(self._overlay)

        # Полноэкранный режим по умолчанию.
        self.fullscreen()
        key_controller = Gtk.EventControllerKey()
        key_controller.connect("key-pressed", self._on_key_pressed)
        self.add_controller(key_controller)

        # Запускаем первую ноду.
        self._load_node(store.first_node_id)

    def _load_node(self, node_id: Any) -> None:
        """Загрузить и начать воспроизведение видео из ноды."""
        node = self._store.nodes.get(node_id)
        if node is None:
            self._show_error(f"Нода с id '{node_id}' не найдена.")
            return

        self._current_node_id = node_id
        self._buttons_box.set_visible(False)
        self._clear_buttons()
        self._end_label.set_visible(False)

        # Останавливаем и отключаем старый поток, если был.
        if self._media_stream is not None:
            for handler in (self._on_ended_notify, self._on_error_notify):
                try:
                    self._media_stream.disconnect_by_func(handler)
                except TypeError:
                    pass
            self._media_stream.set_playing(False)
            self._media_stream = None

        file_path = Path(node["file"])
        if not file_path.is_absolute():
            # Пути относительно YAML-файла.
            file_path = self._base_dir / file_path

        resolved = str(file_path.resolve())
        print(f"Загрузка видео: {resolved}", file=sys.stderr)
        file = Gio.File.new_for_path(resolved)
        media = Gtk.MediaFile.new_for_file(file)
        media.set_loop(False)

        self._media_stream = media
        self._video.set_media_stream(media)
        self._hide_video_controls()

        media.connect("notify::ended", self._on_ended_notify)
        media.connect("notify::error", self._on_error_notify)

        media.set_playing(True)

    def _on_ended_notify(self, media: Gtk.MediaStream, pspec: GObject.ParamSpec) -> None:
        """Вызывается при изменении свойства ended."""
        if media.props.ended:
            self._on_video_ended(media)

    def _on_error_notify(self, media: Gtk.MediaStream, pspec: GObject.ParamSpec) -> None:
        """Вызывается при ошибке воспроизведения."""
        error = media.props.error
        if error:
            print(f"Ошибка воспроизведения: {error.message} (код {error.code})", file=sys.stderr)
            self._show_error(f"Не удалось воспроизвести видео:\n{error.message}")

    def _clear_buttons(self) -> None:
        child = self._buttons_box.get_first_child()
        while child is not None:
            next_child = child.get_next_sibling()
            self._buttons_box.remove(child)
            child = next_child

    def _hide_video_controls(self, widget: Gtk.Widget | None = None) -> bool:
        """Скрыть встроенные элементы управления Gtk.Video."""
        if widget is None:
            widget = self._video
        child = widget.get_first_child()
        while child is not None:
            if isinstance(child, Gtk.MediaControls):
                child.set_visible(False)
                return True
            if self._hide_video_controls(child):
                return True
            child = child.get_next_sibling()
        return False

    def _on_video_ended(self, media: Gtk.MediaStream) -> None:
        """Показать кнопки выбора или экран окончания."""
        node = self._store.nodes.get(self._current_node_id)
        if not node:
            return

        outputs = node.get("outputs") or []
        self._clear_buttons()

        if not outputs:
            self._end_label.set_visible(True)
            restart_button = Gtk.Button(
                label="Заново?",
                hexpand=True,
                css_classes=["pill", "text-button", "flat"],
            )
            restart_button.connect("clicked", self._on_restart_clicked)
            self._buttons_box.append(restart_button)
            self._buttons_box.set_visible(True)
            return

        self._end_label.set_visible(False)

        for target_id in outputs:
            target_node = self._store.nodes.get(target_id)
            if target_node is None:
                continue
            button = Gtk.Button(
                label=target_node["title"],
                hexpand=True,
                css_classes=["pill", "text-button", "flat"],
            )
            button.connect("clicked", self._on_output_clicked, target_id)
            self._buttons_box.append(button)

        self._buttons_box.set_visible(True)

    def _on_output_clicked(self, button: Gtk.Button, target_id: Any) -> None:
        self._load_node(target_id)

    def _on_restart_clicked(self, button: Gtk.Button) -> None:
        if self._store.first_node_id is not None:
            self._load_node(self._store.first_node_id)

    def _on_key_pressed(
        self,
        controller: Gtk.EventControllerKey,
        keyval: int,
        keycode: int,
        state: Gdk.ModifierType,
    ) -> bool:
        """Выход из полноэкранного режима по Escape."""
        if keyval == Gdk.KEY_Escape and self.is_fullscreen():
            self.unfullscreen()
            return True
        return False

    def _show_error(self, message: str) -> None:
        dialog = Adw.AlertDialog(
            heading="Ошибка",
            body=message,
            close_response="close",
        )
        dialog.add_response("close", "Закрыть")
        dialog.connect("response", lambda *_a: self.get_application().quit())
        dialog.present(self)


class YamlVideoApp(Adw.Application):
    def __init__(
        self,
        yaml_path: Path,
        css_path: Path | None = None,
    ) -> None:
        super().__init__(
            application_id=APP_ID,
            flags=Gio.ApplicationFlags.DEFAULT_FLAGS,
        )
        self._yaml_path = yaml_path
        self._css_path = css_path
        self._store = NodeStore()

    def do_activate(self) -> None:
        if self._css_path is not None:
            self._load_custom_css(self._css_path)

        try:
            self._store.load(self._yaml_path)
        except ValidationError as exc:
            self._show_fatal_error(str(exc))
            return

        window = PlayerWindow(self, self._store, self._yaml_path.parent)
        window.present()

    def _load_custom_css(self, css_path: Path) -> None:
        """Загрузить пользовательский CSS из файла."""
        if not css_path.is_file():
            self._show_fatal_error(f"CSS-файл не найден: {css_path}")
            return

        try:
            css_provider = Gtk.CssProvider()
            css_provider.load_from_path(str(css_path.resolve()))
            display = Gdk.Display.get_default()
            if display is not None:
                Gtk.StyleContext.add_provider_for_display(
                    display,
                    css_provider,
                    Gtk.STYLE_PROVIDER_PRIORITY_USER,
                )
        except GLib.Error as exc:
            self._show_fatal_error(f"Не удалось загрузить CSS: {exc.message}")

    def _show_fatal_error(self, message: str) -> None:
        dialog = Adw.AlertDialog(
            heading="Ошибка загрузки сценария",
            body=message,
            close_response="close",
        )
        dialog.add_response("close", "Закрыть")
        dialog.connect("response", lambda *_a: self.quit())
        dialog.present(None)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="GTK4/Libadwaita интерактивный видеоплеер на основе YAML-сценария.",
    )
    parser.add_argument("yaml", help="Путь к YAML-файлу сценария.")
    parser.add_argument(
        "--css",
        dest="css",
        default=None,
        help="Путь к произвольному CSS-файлу для стилизации интерфейса.",
    )
    args = parser.parse_args()

    yaml_path = Path(args.yaml)

    # По умолчанию стили берутся из style.css в директории проекта.
    project_dir = Path(__file__).parent
    if args.css is not None:
        css_path = Path(args.css)
        if not css_path.is_file():
            print(f"CSS-файл не найден: {css_path}", file=sys.stderr)
            return 1
    else:
        css_path = project_dir / "style.css"
        if not css_path.is_file():
            css_path = None

    app = YamlVideoApp(yaml_path, css_path)
    # Передаём только имя программы, чтобы Gio.Application не пытался
    # обработать путь к YAML как входной файл.
    return app.run(sys.argv[:1])


if __name__ == "__main__":
    raise SystemExit(main())
