BUN ?= bun

.PHONY: build build-exe typecheck test lint check doctor bench-check bench-resolve bench-ci perf-smoke clean test-prod prepublish

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

