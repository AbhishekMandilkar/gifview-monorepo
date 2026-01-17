#!/usr/bin/env node

const BASE_URL = process.env.API_URL || "http://localhost:3000/api/v1";

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
};

const log = {
  title: (msg) => console.log(`\n${colors.bright}${colors.cyan}═══ ${msg} ═══${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  info: (msg) => console.log(`${colors.dim}${msg}${colors.reset}`),
  json: (data) => console.log(JSON.stringify(data, null, 2)),
};

async function testEndpoint(method, path, body = null) {
  const url = `${BASE_URL}${path}`;
  log.info(`${method} ${url}`);

  try {
    const options = {
      method,
      headers: { "Content-Type": "application/json" },
    };
    if (body) options.body = JSON.stringify(body);

    const res = await fetch(url, options);
    const data = await res.json();

    if (res.ok) {
      log.success(`${res.status} ${res.statusText}`);
      log.json(data);
      return { success: true, data };
    } else {
      log.error(`${res.status} ${res.statusText}`);
      log.json(data);
      return { success: false, data };
    }
  } catch (err) {
    log.error(`Request failed: ${err.message}`);
    return { success: false, error: err.message };
  }
}

async function runTests() {
  console.log(`${colors.bright}API Test Suite${colors.reset}`);
  console.log(`Base URL: ${BASE_URL}\n`);

  // Posts
  log.title("Posts");
  await testEndpoint("GET", "/posts?pageSize=5");

  // Gifs
  log.title("Gifs");
  await testEndpoint("GET", "/gifs?pageSize=5");

  // Users
  log.title("Users");
  await testEndpoint("GET", "/users?pageSize=5");

  // Connectors
  log.title("Connectors");
  await testEndpoint("GET", "/connectors?pageSize=5");

  // Interests
  log.title("Interests");
  await testEndpoint("GET", "/interests?pageSize=5");
  await testEndpoint("GET", "/interests/depth/1?pageSize=5");

  // Post Media (requires a valid postId)
  log.title("Post Media");
  log.info("Skipping - requires valid postId");

  // Post Likes
  log.title("Post Likes");
  log.info("Skipping - requires valid postId");

  // Post Comments
  log.title("Post Comments");
  log.info("Skipping - requires valid postId");

  // Comment Likes
  log.title("Comment Likes");
  log.info("Skipping - requires valid commentId");

  console.log(`\n${colors.bright}${colors.green}Tests completed!${colors.reset}\n`);
}

runTests().catch(console.error);
