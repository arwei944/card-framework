# Task 6: Agent 端 — 目录结构与 package.json

**Files:**
- Create: `evolution-agent/package.json`
- Create: `evolution-agent/src/config.json`

## Step 1: 创建 evolution-agent 目录

```
mkdir d:\work\solo work\card-framework\evolution-agent\src
```

## Step 2: 创建 package.json

```json
{
  "name": "cardframe-evolution-agent",
  "version": "1.0.0",
  "description": "CardFrame self-evolution agent - AI code generation, Git version management, test & rollback",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js"
  },
  "dependencies": {
    "ws": "^8.16.0",
    "dotenv": "^16.3.1"
  }
}
```

## Step 3: 创建 config.json

```json
{
  "port": 9100,
  "projectRoot": "..",
  "branch": "main",
  "evolutionBranch": "evolution",
  "llmEndpoint": "https://api.anthropic.com/v1/messages",
  "testTimeout": 120000,
  "maxSnapshots": 20,
  "autoMergeThreshold": 10,
  "npmCommand": "npm"
}
```

## Step 4: 提交
```bash
git add evolution-agent/
git commit -m "feat: initialize evolution-agent directory structure"
```