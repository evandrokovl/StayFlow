const path = require('path');
const express = require('express');

const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'src');

function srcPath(...parts) {
  return path.join(srcDir, ...parts);
}

function resetBackendModules() {
  for (const key of Object.keys(require.cache)) {
    if (key.startsWith(srcDir)) {
      delete require.cache[key];
    }
  }
}

function mockModule(modulePath, exports) {
  require.cache[modulePath] = {
    id: modulePath,
    filename: modulePath,
    loaded: true,
    exports
  };
}

function jsonErrorHandler(err, req, res, next) {
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message
  });
}

async function withRoute(routePath, basePath, callback, options = {}) {
  resetBackendModules();

  for (const [modulePath, exports] of Object.entries(options.mocks || {})) {
    mockModule(modulePath, exports);
  }

  const route = require(routePath);
  const app = express();

  app.use(express.json());

  if (options.beforeRoute) {
    options.beforeRoute(app);
  }

  app.use(basePath, route);
  app.use(jsonErrorHandler);

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    return await callback(baseUrl);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    resetBackendModules();
  }
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  let body = null;

  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  return {
    status: response.status,
    headers: response.headers,
    body
  };
}

module.exports = {
  rootDir,
  srcPath,
  resetBackendModules,
  mockModule,
  withRoute,
  requestJson
};
