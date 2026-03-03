Dockerized E2E runner (label: docker-e2e-runner)

What is included
- Dockerfile to run Playwright tests
- docker-compose.yml with three services:
  - app-under-test (nginx serving ./example-site)
  - playwright-runner (builds the Dockerfile, runs tests)
  - k6 (runs load test against app-under-test)
- example Playwright test in tests/
- simple static example-site/
- k6 load test in k6/

How to run
1. From the infra directory, build and start services:
   docker compose up --build

2. This will start the nginx app, then run k6 (it will run immediately) and the playwright-runner will run the npm test command and exit.

Notes and tips
- The Playwright runner uses BASE_URL=http://app-under-test (container name) so tests target the nginx service via the internal Docker network.
- If you need to target services on the host, docker compose includes extra_hosts host.docker.internal mapping.
- To run only Playwright tests locally (not in Docker): npm ci && npx playwright install && npm test
- Adjust k6 script at k6/load-test.js and numbers in docker-compose.yml as needed.
