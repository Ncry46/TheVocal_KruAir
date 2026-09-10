# Design: Homework upload to teacher's Google Drive

Date: 2026-09-08  
Status: implemented (user approved)

## Goal

When a student submits homework audio, upload the file into **that lesson teacher's Google Drive**, under a per-student folder — instead of only storing on the API server disk.

## Approach

Extend existing teacher Google OAuth (`google_calendar_connections`) to also request Drive file scope. On homework submit, upload via Drive API; store the Drive file URL (or webViewLink) on `class_logs.student_audio_url`. If teacher has no Drive connection, fall back to local `backend/uploads/homework` (current behavior).

## Folder layout

```
VOCALITY Homework/
  {student nickname}/
    {YYYY-MM-DD}-{lesson-or-classLogId}.{ext}
```

Root folder created once per connected teacher and remembered (folder id on connection row or settings).

## Behavior

1. Teacher connects Google in Settings (same button; broader consent if needed — re-connect if only calendar was granted).
2. Student uploads audio on Homework page (unchanged UX).
3. Backend resolves lesson `teacher_id` → Google tokens → ensure folders → upload → save link.
4. Notify teacher as today; link opens Drive/file when possible.

## Data

- Reuse `google_calendar_connections` (or rename conceptually to google_connections): add `drive_root_folder_id NVARCHAR(128) NULL`, ensure refresh tokens support Drive scope.
- OAuth scopes: existing calendar.events + `https://www.googleapis.com/auth/drive.file` (app-created files only).

## Non-goals

- Student-owned Drive
- Sharing folders for student edit access
- Migrating old local files to Drive
- Admin central Drive (option C)
- Deleting/archiving old homework automatically

## Success criteria

- Connected teacher: new homework lands in Drive under student folder
- Disconnected teacher: local upload still works
- `student_audio_url` playable/openable from app
- Clear error if Google upload fails after local fallback decision
