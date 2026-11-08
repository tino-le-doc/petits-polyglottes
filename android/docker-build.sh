#!/bin/bash
# S'exécute DANS le conteneur Docker (voir build-local.sh).
set -e
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq >/dev/null && apt-get install -y -qq aapt unzip wget >/dev/null

export ANDROID_HOME=/cache/sdk GRADLE_USER_HOME=/cache/gradle-home
if [ ! -x "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" ]; then
  echo "== Téléchargement des outils Android (Google)"
  wget -q https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip -O /tmp/clt.zip
  mkdir -p "$ANDROID_HOME/cmdline-tools" && unzip -q /tmp/clt.zip -d /tmp/clt && mv /tmp/clt/cmdline-tools "$ANDROID_HOME/cmdline-tools/latest"
fi
yes | "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" --licenses >/dev/null
"$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" "platforms;android-34" "build-tools;34.0.0" >/dev/null

if [ ! -x /cache/gradle-8.7/bin/gradle ]; then
  echo "== Téléchargement de Gradle"
  wget -q https://services.gradle.org/distributions/gradle-8.7-bin.zip -O /tmp/gradle.zip && unzip -q /tmp/gradle.zip -d /cache
fi

echo "== Compilation de l'APK"
export KEYSTORE_FILE=/key/release.keystore KEYSTORE_PASSWORD="$(cat /key/mot-de-passe.txt)"
# Les outils Google n'existent qu'en x86 : on utilise l'aapt2 ARM d'Ubuntu.
/cache/gradle-8.7/bin/gradle -p /work/android assembleRelease --no-daemon -q \
  -Pandroid.aapt2FromMavenOverride=/usr/bin/aapt2

mkdir -p /work/dist
cp /work/android/app/build/outputs/apk/release/app-release.apk /work/dist/PetitsPolyglottes.apk
chown -R "$HOST_UID:$HOST_GID" /work/dist /work/android /cache
echo "== OK : dist/PetitsPolyglottes.apk"
