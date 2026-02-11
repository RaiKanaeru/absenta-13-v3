import { spawnSync } from "node:child_process"
import { tool } from "@opencode-ai/plugin"

function execute(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    shell: process.platform === "win32",
    timeout: 180000,
    maxBuffer: 10 * 1024 * 1024,
  })

  const stdout = (result.stdout || "").trim()
  const stderr = (result.stderr || "").trim()
  const output = [stdout, stderr].filter(Boolean).join("\n")

  return {
    ok: result.status === 0 && !result.error,
    output: output || "(no output)",
    error: result.error ? result.error.message : "",
    code: result.status,
  }
}

function runCompose(args, cwd) {
  const dockerCompose = execute("docker-compose", args, cwd)
  if (dockerCompose.ok) {
    return dockerCompose.output
  }

  const dockerComposePlugin = execute("docker", ["compose", ...args], cwd)
  if (dockerComposePlugin.ok) {
    return dockerComposePlugin.output
  }

  throw new Error(
    [
      `docker-compose failed (code ${dockerCompose.code}): ${dockerCompose.error}`,
      dockerCompose.output,
      `docker compose failed (code ${dockerComposePlugin.code}): ${dockerComposePlugin.error}`,
      dockerComposePlugin.output,
    ]
      .filter(Boolean)
      .join("\n\n"),
  )
}

export default tool({
  description: "Show Docker service state and recent logs.",
  args: tool.schema.object({
    service: tool.schema.string().default("app"),
    tail: tool.schema.number().int().min(10).max(500).default(50),
  }),
  async execute({ service, tail }, context) {
    const ps = runCompose(["ps"], context.directory)
    const logs = runCompose(["logs", `--tail=${tail}`, service], context.directory)

    return [
      "# docker compose ps",
      ps,
      "",
      `# docker compose logs --tail=${tail} ${service}`,
      logs,
    ].join("\n")
  },
})
