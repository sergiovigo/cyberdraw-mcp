#!/usr/bin/env node
import { dispatch, InstallationError } from "./core.mjs";

try {
  const result = await dispatch(process.argv.slice(2));
  if (result.help) {
    console.log(result.help);
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  const details =
    error instanceof InstallationError ? error.details : undefined;
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: message,
        ...(details ? { details } : {}),
      },
      null,
      2,
    ),
  );
  process.exitCode = error instanceof InstallationError ? error.code : 1;
}
