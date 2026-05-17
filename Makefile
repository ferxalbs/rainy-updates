BUN ?= bun
TARGET ?= $(shell $(BUN) -e "console.log(process.arch === 'arm64' ? 'macos-arm64' : 'macos-x64')")
# Note: Above is a default for macOS, but it can be overridden.

.PHONY: build build-exe typecheck test lint check doctor bench-check bench-resolve bench-ci perf-smoke clean test-prod prepublish release-preflight

build:
	$(BUN) run build

build-exe:
	$(BUN) run build:exe

typecheck:
	$(BUN) run typecheck

test:
	$(BUN) test

lint:
	$(BUN) run lint

check:
	$(BUN) run check

doctor:
	$(BUN) run ga

bench-check:
	$(BUN) run bench:check

bench-resolve:
	$(BUN) run bench:resolve

bench-ci:
	$(BUN) run bench:ci

perf-smoke:
	$(BUN) run perf:smoke

clean:
	$(BUN) run clean

test-prod:
	$(BUN) run test:prod

prepublish:
	$(BUN) run prepublishOnly

release-preflight:
	$(BUN) run release-preflight

build-all-platforms:
	$(BUN) scripts/build-release-binary.mjs macos-arm64 dist/binaries/macos-arm64
	$(BUN) scripts/build-release-binary.mjs macos-x64 dist/binaries/macos-x64
	$(BUN) scripts/build-release-binary.mjs linux-arm64 dist/binaries/linux-arm64
	$(BUN) scripts/build-release-binary.mjs linux-x64 dist/binaries/linux-x64
	$(BUN) scripts/build-release-binary.mjs windows-x64 dist/binaries/windows-x64

