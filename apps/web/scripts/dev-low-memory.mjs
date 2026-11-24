import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
console.log("Modo de pouca memória: Webpack, old space de 1536 MiB por processo Node.");
console.log("O consumo total inclui memória nativa, buffers e processos auxiliares.");
const child = spawn(
  process.execPath,
  [require.resolve("next/dist/bin/next"), "dev", "--webpack", ...process.argv.slice(2)],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      LOW_MEMORY_DEV: "1",
      // Next passes NODE_OPTIONS to its server child. The last heap limit wins;
      // preserve unrelated options without changing the user's shell or .env.
      NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --max-old-space-size=1536`.trim()
    }
  }
);

child.on("error", (error) => {
  console.error("Não foi possível iniciar o modo de pouca memória:", error.message);
  process.exitCode = 1;
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => child.kill(signal));
}

child.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal === "SIGINT" ? 130 : 1);
});
