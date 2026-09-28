#!/bin/sh
# Скачивает фото комплектов со старого сайта waverus.ru (WordPress) в _src/photos/.
# Запускать ДО переноса домена на новый сайт, затем: node _src/build.mjs
# Лучше потом пережать в webp шириной до 1400 px (например, squoosh.app) — сборка возьмёт .webp первым.
set -e
cd "$(dirname "$0")/photos"
BASE="https://waverus.ru/wp-content/uploads/2026/07"
# карточка-1.png, карточка-товаров-2.jpg, карточка-3.jpg, карточка-4.jpg
curl -fL -o black-matte.png   "$BASE/%D0%BA%D0%B0%D1%80%D1%82%D0%BE%D1%87%D0%BA%D0%B0-1.png"
curl -fL -o black-groove.jpg  "$BASE/%D0%BA%D0%B0%D1%80%D1%82%D0%BE%D1%87%D0%BA%D0%B0-%D1%82%D0%BE%D0%B2%D0%B0%D1%80%D0%BE%D0%B2-2.jpg"
curl -fL -o grey-blue.jpg     "$BASE/%D0%BA%D0%B0%D1%80%D1%82%D0%BE%D1%87%D0%BA%D0%B0-3.jpg"
curl -fL -o white-cabinet.jpg "$BASE/%D0%BA%D0%B0%D1%80%D1%82%D0%BE%D1%87%D0%BA%D0%B0-4.jpg"
ls -la
