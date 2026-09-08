'use strict';

const { IS_PROD } = require('../config');

/**
 * Operational error with a safe, client-facing message and a stable code.
 * Anything that is NOT an AppError is treated as an unexpected server fault
 * and never has its details returned to the client.
 */
class AppError extends Error {
  constructor(code, message, status = 400, details) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.details = details;
    this.expose = true;
  }
}

function notFoundHandler(_req, res) {
  res.status(404).json({ error: { code: 'not_found', message: 'Resource not found.' } });
}

// Known body-parser / framework errors we want to surface as safe 4xx instead
// of a generic 500. We map by error `type`/`status`, never by echoing the raw
// message (a JSON parse error message can contain a snippet of the bad body).
const BODY_PARSER_ERRORS = {
  'entity.parse.failed': { status: 400, code: 'invalid_json', message: 'Request body is not valid JSON.' },
  'entity.too.large': { status: 413, code: 'payload_too_large', message: 'Request body is too large.' },
  'request.aborted': { status: 400, code: 'request_aborted', message: 'The request was aborted.' },
  'encoding.unsupported': { status: 415, code: 'unsupported_encoding', message: 'Unsupported content encoding.' },
  'parameters.too.many': { status: 413, code: 'too_many_parameters', message: 'Too many request parameters.' },
};

function classifyKnownError(err) {
  if (err && typeof err.type === 'string' && BODY_PARSER_ERRORS[err.type]) {
    return BODY_PARSER_ERRORS[err.type];
  }
  // multer file-size / count limits
  if (err && err.name === 'MulterError') {
    return { status: 400, code: 'upload_rejected', message: 'The upload was rejected (file too large or too many files).' };
  }
  // Generic exposable 4xx from a dependency (e.g. http-errors) — keep the status,
  // drop the message.
  if (
    err &&
    err.expose === true &&
    Number.isInteger(err.status) &&
    err.status >= 400 &&
    err.status < 500
  ) {
    return { status: err.status, code: 'bad_request', message: 'Bad request.' };
  }
  return null;
}

// Express 5 forwards async rejections here automatically.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  const known = err instanceof AppError ? null : classifyKnownError(err);
  const isApp = err instanceof AppError;
  const status = isApp ? err.status : known ? known.status : 500;
  const code = isApp ? err.code : known ? known.code : 'internal_error';

  // Server-side diagnostics only. Never sent to the client. We deliberately do
  // NOT log request bodies, headers, tokens or credentials.
  const logLine = {
    at: new Date().toISOString(),
    method: req.method,
    path: req.originalUrl,
    status,
    code,
    message: isApp || known ? err.message : String(err && err.message).slice(0, 300),
  };
  if (status >= 500) {
    console.error('[error]', logLine, IS_PROD ? '' : (err && err.stack) || '');
  } else {
    console.warn('[warn]', logLine);
  }

  if (isApp) {
    return res.status(status).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
  }

  if (known) {
    return res.status(known.status).json({ error: { code: known.code, message: known.message } });
  }

  // Unexpected: generic message, no stack / SQL / paths / secrets.
  return res.status(500).json({
    error: { code: 'internal_error', message: 'Something went wrong. Please try again.' },
  });
}

module.exports = { AppError, errorHandler, notFoundHandler };
