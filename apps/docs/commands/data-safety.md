---
outline: deep
---

<CommandHeader
  name="gpc data-safety"
  description="Manage data safety declarations for your app's Play Store listing."
  usage="gpc data-safety <subcommand> [options]"
  :badges="['--json', '--dry-run']"
/>

## Commands

| Command                                     | Description                         |
| ------------------------------------------- | ----------------------------------- |
| [`data-safety update`](#data-safety-update) | Update declarations from a CSV file |
| [`data-safety get`](#data-safety-get)       | Not available (no API endpoint)     |
| [`data-safety export`](#data-safety-export) | Not available (no API endpoint)     |

## `data-safety update`

Update the data safety declarations from a CSV file exported from Google Play Console. The CSV uses the Play Console data safety export format with columns: Question ID, Response, Response value, Answer requirement, and Human-friendly label.

### Synopsis

```bash
gpc data-safety update --file <path> [options]
```

### Options

| Flag     | Short | Type     | Default        | Description                                        |
| -------- | ----- | -------- | -------------- | -------------------------------------------------- |
| `--file` |       | `string` | **(required)** | Path to data safety CSV file (Play Console format) |
| `--app`  |       | `string` |                | App package name                                   |
| `--json` |       | `flag`   |                | Output as JSON                                     |

### Workflow

1. Go to **Play Console** > **App content** > **Data safety**
2. Fill out the form or update it
3. Click **Export to CSV** to download the file
4. Version-control the CSV alongside your app code
5. Push updates via the CLI:

```bash
gpc data-safety update --file data-safety.csv --app com.example.app
```

```
Data safety declarations updated.
```

This lets you keep data safety declarations in source control and apply them from CI without logging into the Play Console.

### Dry run

Preview what would happen without making changes:

```bash
gpc data-safety update --file data-safety.csv --dry-run
```

---

## `data-safety get`

The Google Play Developer API does not provide a GET endpoint for data safety declarations. To view your current declarations, use the Play Console web UI:

**Play Console** > **App content** > **Data safety**

---

## `data-safety export`

The Google Play Developer API does not provide a GET endpoint for data safety declarations, so they cannot be exported via the API. To export your declarations:

1. Go to **Play Console** > **App content** > **Data safety**
2. Click **Export to CSV**

The exported CSV can then be version-controlled and re-applied with `data-safety update --file`.

## Errors

| Code             | Exit | Description                                                    |
| ---------------- | ---- | -------------------------------------------------------------- |
| `FILE_NOT_FOUND` | 1    | The specified CSV file does not exist                          |
| `INVALID_INPUT`  | 1    | The CSV file is empty                                          |
| `FILE_TOO_LARGE` | 1    | The CSV exceeds 1 MB (data safety CSVs are typically a few KB) |
| `API_ERROR`      | 4    | Google Play API rejected the update                            |

## Related

- [preflight](./preflight) -- Privacy scanner detects tracking SDKs and flags data safety obligations
- [listings](./listings) -- Store listing management (descriptions, screenshots, etc.)
