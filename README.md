# Contract Review

A simple web app for asking questions about a contract. Upload a PDF, read it on the left, and chat with it on the right.

Built with plain HTML, CSS and JavaScript. No frameworks, no npm, no build step.

## Features

- **Two-column layout:** contract preview on the left, chat on the right. Both stay visible and scroll independently.
- **PDF upload:** drag and drop a PDF or click to browse. It shows in the preview panel, and you can replace it at any time.
- **Chat with your contract:** your question and the PDF are sent to an n8n webhook. The reply appears in the chat with:
  - the **answer**,
  - the **citations** (the exact clauses that support it),
  - a short **reasoning** note.
- **Clear states:** a typing indicator while waiting, and friendly messages for errors or a missing upload.

## Run locally

You need a modern browser (Chrome, Safari, Firefox or Edge). Python is optional.

**Option 1: open the file.** Double-click `index.html`.

**Option 2: serve it locally (recommended).** Browsers can block the webhook call from a file opened directly, so a local server works more reliably:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## Configuration

The webhook address is set at the top of `app.js` (`WEBHOOK_URL`). The app posts a `multipart/form-data` request with two fields:

| Field     | Content                |
| --------- | ---------------------- |
| `file`    | the uploaded PDF       |
| `message` | the user's question    |

The webhook must return JSON in this shape:

```json
{
  "response": "answer based only on the contract",
  "citation": ["clause or page text that supports the answer"],
  "reasoning": "1-2 sentences on how the citations support the answer"
}
```

If the contract doesn't contain the answer, `response` is `"This information is not mentioned in the contract."`, `citation` is `[]` and `reasoning` is `""`.

**Notes**

- n8n `webhook-test` URLs only respond while the workflow is listening for a test event. Use the production `/webhook/` URL once the workflow is active.
- The n8n Webhook node must allow your page's origin under *Allowed Origins (CORS)*.

## Files

| File         | Purpose                         |
| ------------ | ------------------------------- |
| `index.html` | Page structure                  |
| `styles.css` | Navy and orange styling         |
| `app.js`     | Upload, PDF preview, chat logic |
