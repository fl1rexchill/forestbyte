#!/usr/bin/env bash
# Собирает ZIP-архивы плагина и темы, готовые к загрузке через админку WordPress.
# Запуск:  bash sites/wordpress/build-zips.sh
set -e

HERE="$(cd "$(dirname "$0")" && pwd)"
DIST="$HERE/dist"
mkdir -p "$DIST"
rm -f "$DIST/forestbyte.zip" "$DIST/forestbyte-starter.zip"

# Плагин (архивируем так, чтобы внутри была папка forestbyte/)
( cd "$HERE/plugin" && zip -r -q "$DIST/forestbyte.zip" forestbyte )
# Тема
( cd "$HERE/theme" && zip -r -q "$DIST/forestbyte-starter.zip" forestbyte-starter )

echo "Готово:"
echo "  $DIST/forestbyte.zip"
echo "  $DIST/forestbyte-starter.zip"
echo "Загрузите их в админке WordPress (Плагины/Темы → Загрузить)."
