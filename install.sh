#!/bin/sh
# LaunchWhitely installer — works with: curl -sSfL https://raw.githubusercontent.com/your-org/launchwhitely/main/install.sh | sh
set -e

REPO="sakshamred/Meth-v12"
BIN_DIR="${LAUNCHWHITELY_INSTALL_DIR:-${HOME}/.local/bin}"
BINARY_NAME="launchwhitely"

# ── Detect platform ─────────────────────────────────────────────────────────

OS="$(uname -s 2>/dev/null | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m 2>/dev/null)"

case "${OS}" in
  linux)
    case "${ARCH}" in
      x86_64)          TARGET="x86_64-unknown-linux-gnu" ;;
      aarch64|arm64)   TARGET="aarch64-unknown-linux-gnu" ;;
      *) echo "Unsupported arch: ${ARCH}" >&2; exit 1 ;;
    esac
    EXT="tar.gz"
    ;;
  darwin)
    case "${ARCH}" in
      x86_64)          TARGET="x86_64-apple-darwin" ;;
      arm64)           TARGET="aarch64-apple-darwin" ;;
      *) echo "Unsupported arch: ${ARCH}" >&2; exit 1 ;;
    esac
    EXT="tar.gz"
    ;;
  *)
    echo "Unsupported OS: ${OS}. Use the Windows installer or cargo install launchwhitely." >&2
    exit 1
    ;;
esac

# ── Resolve version ─────────────────────────────────────────────────────────

if [ -z "${LAUNCHWHITELY_VERSION}" ]; then
  LATEST_JSON="$(curl -sSf "https://api.github.com/repos/${REPO}/releases/latest")"
  VERSION="$(printf '%s' "${LATEST_JSON}" | grep '"tag_name"' | sed 's/.*"v\([^"]*\)".*/\1/' | head -1)"
  if [ -z "${VERSION}" ]; then
    echo "Could not determine latest version. Set LAUNCHWHITELY_VERSION and retry." >&2
    exit 1
  fi
else
  VERSION="${LAUNCHWHITELY_VERSION}"
fi

FILENAME="${BINARY_NAME}-${TARGET}.${EXT}"
URL="https://github.com/${REPO}/releases/download/v${VERSION}/${FILENAME}"

# ── Download and extract ────────────────────────────────────────────────────

TMP="$(mktemp -d)"
trap 'rm -rf "${TMP}"' EXIT

printf 'Installing launchwhitely v%s (%s)...\n' "${VERSION}" "${TARGET}"
curl -sSfL "${URL}" | tar -xz -C "${TMP}"

# ── Install ─────────────────────────────────────────────────────────────────

mkdir -p "${BIN_DIR}"
mv "${TMP}/${BINARY_NAME}" "${BIN_DIR}/${BINARY_NAME}"
chmod +x "${BIN_DIR}/${BINARY_NAME}"

printf '\nInstalled to %s/%s\n' "${BIN_DIR}" "${BINARY_NAME}"

# ── PATH hint ───────────────────────────────────────────────────────────────

case ":${PATH}:" in
  *:${BIN_DIR}:*)
    printf 'launchwhitely is ready — run: launchwhitely serve\n'
    ;;
  *)
    printf '\nAdd %s to your PATH:\n' "${BIN_DIR}"
    printf '  export PATH="%s:${PATH}"\n' "${BIN_DIR}"
    printf 'Then run: launchwhitely serve\n'
    ;;
esac
