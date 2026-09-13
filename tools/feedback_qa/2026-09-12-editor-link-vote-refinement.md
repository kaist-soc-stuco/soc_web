# 2026-09-12 editor link and vote refinement verification

- Shared link modal used by survey contenteditable and post/event/email Tiptap editors.
- Chrome localhost:8080: selected text -> link dialog -> Enter apply -> inline URL popup -> edit -> unlink verified in survey description and event body.
- Fixed modal focus trap interfering with contenteditable selection restoration and Tiptap view access before mount.
- Survey header selection geometry: title y=276.4, height=38.3; description y=334.7, height=24.8 in both inactive preview and active editor with toolbar closed.
- Encoded section title `&amp;amp;&nbsp;` renders `&` in both deletion and reordering dialogs.
- Vote autosave: title and description edits, undo/redo, reload persistence verified. New draft roster addition creates the vote and retains roster tab; missing vote timestamp renders an empty cell.
- Chrome file chooser was blocked by extension file URL access permission. Actual file selection/upload end-to-end remains unverified; manual roster add sharing draft creation path verified.
- Web typecheck/build passed. API vote-quorum tests: 2 passed.
- QA survey and two QA vote records removed after verification; no publication or ballots submitted.
