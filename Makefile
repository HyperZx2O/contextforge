.PHONY: test-all test-unit test-integration test-api

test-all: test-unit test-integration

test-api: test-all

test-unit:
	cd backend && python -m pytest tests/unit/ -v

test-integration:
	cd backend && python -m pytest tests/integration/ -v
