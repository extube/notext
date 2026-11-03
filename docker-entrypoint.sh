#!/bin/sh
# Startup fetch: run the newest code without baking it into the image.
# GIT_SRC modes (optional): a git url clones/pulls the latest source before
# building. A bind mount on /src (the checked-out repo) wins over the image
# snapshot. The shell inside is sh, so any command in the copied source that relies
# on /bin/sh works. With no env, npm ci produces the lockfile hash-shm
set -e

REPO_URL="${GIT_SRC:-}"
REF="${GIT_REF:-main}"

if [ -n "$REPO_URL" ]; then
  if [ -d .git ]; then
    git fetch --depth 1 origin "$REF"
    git reset --hard FETCH_HEAD
  else
    git clone --depth 1 --branch "$REF" "$REPO_URL" .
  fi
elif [ -d /src ]; then
  # newest local code: the bind-mounted checkout replaces the image copy
  for item in src package.json package-lock.json svelte.config.js vite.config.js; do
    if [ -e "/src/$item" ]; then
      rm -rf "/app/$item"
      cp -r "/src/$item" "/app/$item"
    fi
  done
fi

# reinstall deps only when the lockfile actually changed
lock_hash=$(sha256sum package-lock.json 2>/dev/null | cut -d' ' -f1)
if [ -d node_modules ] && [ -f /root/lock_hash ] && [ "$(cat /root/lock_hash)" = "$lock_hash" ]; then
  echo "deps unchanged — skipping npm ci"
else
  npm ci --no-audit --no-fund
  echo "$lock_hash" > /root/lock_hash
fi

npm run build
exec node build
