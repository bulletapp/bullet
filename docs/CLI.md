# Bullet CLI Guide

The Bullet CLI is a high-performance console application built on .NET 10 for terminal power users and automated CI/CD pipelines (GitHub Actions, GitLab CI, Jenkins, Azure DevOps).

---

## 1. Installation & Execution

Run directly via the .NET SDK:

```bash
dotnet run --project src/Bullet.Cli -- <command> [options]
```

Or publish as a standalone single-file binary:

```bash
dotnet publish src/Bullet.Cli/Bullet.Cli.csproj -c Release -r win-x64 --self-contained -p:PublishSingleFile=true
```

---

## 2. Commands & Options

### `bullet arsenal run <file.bullet.json>`
Executes all Shots and Squads defined in an exported `.bullet.json` Arsenal file.

| Option | Description | Default |
|---|---|---|
| `--loadout <name>` | Select environment Loadout by name | `null` |
| `--report <format>` | Output report format: `console`, `junit`, `json` | `console` |
| `--output <path>` | Path to write the test report file | `null` |
| `--iterations <n>` | Number of iterations to execute | `1` |
| `--delay <ms>` | Millisecond delay between shots | `0` |
| `--stop-on-error` | Abort immediately upon first failed test | `false` |

### Examples

```bash
# Execute local test arsenal
bullet arsenal run ./users.bullet.json

# Execute in CI with JUnit XML output
bullet arsenal run ./api-tests.bullet.json --report junit --output ./results.xml --stop-on-error
```

---

## 3. GitHub Actions CI Example

```yaml
name: API Regression Suite

on:
  push:
    branches: [ main ]
  pull_request:

jobs:
  bullet-tests:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v4

    - name: Setup .NET 10
      uses: actions/setup-dotnet@v4
      with:
        dotnet-version: 10.0.x

    - name: Run Bullet Firing Run
      run: |
        dotnet run --project src/Bullet.Cli -- arsenal run ./tests/api.bullet.json --report junit --output ./results.xml

    - name: Publish Test Results
      uses: EnricoMi/publish-unit-test-result-action@v2
      if: always()
      with:
        files: results.xml
```
