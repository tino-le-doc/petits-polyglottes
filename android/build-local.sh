#!/bin/bash
# Compile l'APK sur ce PC (ARM) dans un conteneur Docker.
# Résultat : dist/PetitsPolyglottes.apk   —   Clé de signature : ~/petits-polyglottes-cle/
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$HOME/.cache/petits-polyglottes-android"
docker run --rm \
  -e HOST_UID="$(id -u)" -e HOST_GID="$(id -g)" \
  -v "$ROOT":/work \
  -v "$HOME/.cache/petits-polyglottes-android":/cache \
  -v "$HOME/petits-polyglottes-cle":/key:ro \
  eclipse-temurin:17-jdk-noble bash /work/android/docker-build.sh
