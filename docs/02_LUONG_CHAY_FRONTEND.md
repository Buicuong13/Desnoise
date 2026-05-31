# 02 — Luồng chạy Frontend & Tổ chức chức năng từng folder

> UI cho hệ thống **Denoise + OCR + LLM Correction**. Frontend: **Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Zustand · TipTap v3 · shadcn/ui (Radix)**.
> Tài liệu mô tả **code thực tế** trong `frontend/`.

---

## 0. Tóm tắt nhanh

- App Router với 3 nhóm route: `/` (landing) · `(auth)` (login/register) · `(dashboard)` (app chính).
- **Trái tim của app** là route editor `(dashboard)/dashboard/editor/[id]` — chứa toàn bộ pipeline UI và state per-page.
- Data fetching = **fetch wrapper tự viết** (`lib/api/client.ts`), **không** dùng React Query/SWR. Polling status bằng `setInterval`.
- Token (access + refresh JWT) lưu ở **cookie** `denoise_token` / `denoise_refresh` (không httpOnly). Middleware edge gác route theo **sự hiện diện** của cookie.
- ⚠️ Tồn tại **2 codebase song song**: code thật nối backend (`lib/api/*`, `lib/*-store.ts`, editor) và **code mock/demo cũ** (`lib/mock-data.ts`, `lib/types.ts`, `text-editor.tsx`, `image-viewer.tsx`, trang admin/settings). Code cũ chỉ build được nhờ `typescript.ignoreBuildErrors: true` ([next.config.mjs:3](../frontend/next.config.mjs#L3)).

---

## 1. Công nghệ (từ [frontend/package.json](../frontend/package.json))

| Nhóm | Lựa chọn |
|---|---|
| Framework | **Next.js 16.2** (App Router) · React 19 |
| Ngôn ngữ | TypeScript 5.7 (`strict: true`, alias `@/* → ./*`) |
| Styling | **Tailwind CSS v4** (`@tailwindcss/postcss`, theme qua CSS `@theme`, **không** có `tailwind.config`), `tw-animate-css`. Font: `Geist` + `Geist_Mono` |
| State | **Zustand 5** — 2 store: `useAuth`, `useUploadStore` |
| Data fetching | `fetch` wrapper tự viết (`lib/api/client.ts`); polling custom (`setInterval`) |
| Editor | **TipTap v3** (`@tiptap/react`, `starter-kit`, `pm`, `extension-highlight`) |
| Forms | `react-hook-form` + `zod` **đã cài** nhưng form auth/settings thực tế dùng `useState` + validate tay |
| UI kit | **shadcn/ui** (style "new-york") trên **Radix UI**; icon `lucide-react`; toast `sonner`; animation `framer-motion`; chart `recharts`; table `@tanstack/react-table`; dropzone `react-dropzone`; theme `next-themes` |
| Analytics | `@vercel/analytics` (chỉ production) |
| Scripts | `dev: next dev` · `build: next build` · `start: next start` · `lint: eslint .` |

---

## 2. Routing & tổ chức folder (`frontend/`)

```
frontend/
├── middleware.ts          # Gác route edge theo cookie denoise_token
├── app/                   # App Router
│   ├── layout.tsx         # Layout gốc (html/body, font, metadata, Analytics)
│   ├── page.tsx           # Landing (ghép từ components/landing/*)
│   ├── globals.css        # CSS LIVE (rules .ocr-low-conf, .tiptap-editor)
│   ├── (auth)/            # Nhóm route auth — layout split-screen
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   └── (dashboard)/       # Nhóm route app — gác auth + sidebar shell
│       ├── layout.tsx     # hydrate() auth, gate loading, redirect /login
│       ├── dashboard/page.tsx            # Trang chủ: stats + workspace gần đây
│       ├── dashboard/upload/page.tsx     # STUB redirect → editor/new
│       ├── dashboard/history/page.tsx    # Bảng "My Documents"
│       ├── dashboard/settings/page.tsx   # (non-functional)
│       ├── dashboard/editor/[id]/page.tsx # ★ CORE: toàn bộ pipeline UI
│       └── admin/page.tsx                # (mock, không nối backend)
├── components/
│   ├── editor/            # Component pipeline (xem §6)
│   ├── dashboard/layout.tsx  # Sidebar shell
│   ├── landing/*          # Section marketing (navbar, hero, features, ...)
│   ├── ui/*               # shadcn/ui primitives (Radix)
│   └── theme-provider.tsx # wrapper next-themes (CHƯA mount ở layout gốc)
├── hooks/                 # use-mobile, use-toast (legacy)
├── lib/
│   ├── api/               # Tầng client API (xem §3)
│   ├── auth-store.ts      # Zustand: phiên đăng nhập
│   ├── upload-store.ts    # Zustand: pipeline upload
│   ├── types.ts           # (LEGACY — type mock, KHÔNG khớp backend)
│   ├── mock-data.ts       # (LEGACY)
│   └── utils.ts           # cn() (clsx + tailwind-merge)
└── styles/globals.css     # (DEAD — không được import)
```

### 2.1. Layout gốc — [app/layout.tsx](../frontend/app/layout.tsx)
Layout duy nhất phát `<html>/<body>`, set font Geist, metadata ("DocRecover - AI-Powered Document Recovery"), render `<Analytics/>` chỉ ở production, import `./globals.css`.

### 2.2. Landing — [app/page.tsx](../frontend/app/page.tsx)
Ghép trang marketing từ `components/landing/*` theo thứ tự: `Navbar → Hero → Features → HowItWorks → Testimonials → Pricing → CTA → Footer`. CTA navbar link tới `/login` và `/register`.

### 2.3. Nhóm `(auth)` — [app/(auth)/layout.tsx](../frontend/app/(auth)/layout.tsx)
Layout split-screen (form bên trái, minh hoạ bên phải). `/login` bọc `LoginForm` trong `<Suspense>` (đọc `useSearchParams` cho `next` redirect + banner `expired=1`). `/register` tương tự. (Các link `/forgot-password`, `/terms`, `/privacy` **chưa hiện thực**.)

### 2.4. Nhóm `(dashboard)` — [app/(dashboard)/layout.tsx](../frontend/app/(dashboard)/layout.tsx)
Client component: gọi `useAuth().hydrate()` khi mount, hiện "Loading..." khi `isHydrating`, redirect `/login` nếu chưa auth, ngược lại render `<DashboardLayout>` (sidebar). Các page:
| Route | Render |
|---|---|
| `/dashboard` | Stats (Workspaces / Images processed / Free quota) + workspace gần đây. Fetch `api.documents.list()`. |
| `/dashboard/upload` | **Stub** → `router.replace('/dashboard/editor/new')` (upload đã gộp vào editor). |
| `/dashboard/history` | Bảng "My Documents" (search, filter status, sort client). Row link `/dashboard/editor/{id}`. |
| `/dashboard/settings` | UI profile/password/notifications. **Non-functional** (save chỉ bắn toast). |
| `/dashboard/editor/[id]` | **★ Workspace lõi.** `id==='new'` → picker + upload trang đầu; ngược lại → full pipeline UI (§6/§7). |
| `/admin` | Dashboard admin **toàn bộ từ mảng hardcode + `mockUsers`** — không nối backend. |

### 2.5. Middleware edge — [middleware.ts](../frontend/middleware.ts)
Gác theo **sự hiện diện** cookie `denoise_token` (không verify JWT): bảo vệ `/dashboard/*` và `/admin/*` (redirect `/login?next=...`); chặn user đã đăng nhập vào `/login`,`/register` (đẩy về `/dashboard`). Matcher loại trừ `api`, `_next/*`, asset tĩnh.

---

## 3. Tầng API client (`lib/api/`)

### 3.1. HTTP client lõi — [lib/api/client.ts](../frontend/lib/api/client.ts)
- `API_BASE_URL` = `process.env.NEXT_PUBLIC_API_URL` (cắt `/` cuối) hoặc `http://localhost:8000`.
- **Token lưu ở cookie** (không phải localStorage): `denoise_token` (access) + `denoise_refresh` (refresh), `SameSite=Lax`, max-age 14 ngày, **không httpOnly** (client JS đọc được; middleware cũng đọc). Helper: `getStoredToken/setStoredToken/getStoredRefreshToken/setStoredRefreshToken`.
- `apiRequest<T>(path, opts, isRetry?)`: gắn `Authorization: Bearer <token>` khi `auth !== false`; JSON-encode `body` hoặc gửi `form` (FormData); hỗ trợ `raw`, `signal`.
- **Silent refresh**: gặp 401 trên request có auth (không phải `/auth/`) → single-flight `POST /api/v1/auth/refresh`; thành công → retry 1 lần; thất bại → `handleSessionExpired()` xoá cookie + `window.location.replace('/login?expired=1')`.
- Lỗi chuẩn hoá thành `ApiError(status, message, detail)` (xử lý cả `detail` string và mảng 422 của FastAPI).

### 3.2. Tổng hợp — [lib/api/index.ts](../frontend/lib/api/index.ts)
Gom tất cả thành object `api`: `api.auth`, `api.documents`, `api.uploads`, `api.pages`, `api.ocr`, `api.corrections`, `api.exports` (+ re-export token helper & types).

### 3.3. Map từng module → endpoint backend

**`auth.ts`**
| Hàm | Endpoint |
|---|---|
| `register({email,password,full_name?})` | `POST /api/v1/auth/register` → `AuthSession` (auth:false) |
| `login({email,password})` | `POST /api/v1/auth/login` → `AuthSession` |
| `logout()` | `POST /api/v1/auth/logout` |
| `me()` | `GET /api/v1/users/me` → `ApiUser` |

**`documents.ts`**
| `listDocuments()` | `GET /documents` → `ApiDocument[]` |
| `createDocument({title,description?})` | `POST /documents` → `ApiDocument` |
| `getDocument(id)` | `GET /documents/{id}` |
| `archiveDocument(id)` | `DELETE /documents/{id}` |

**`uploads.ts`** (signed direct-to-Cloudinary, 3 bước)
| `getSignature({workspace_id,filename,content_type,file_size,purpose?})` | `POST /uploads/signature` → `UploadSignature` |
| `uploadToCloudinary(uploadUrl, fields, file, onProgress?)` | **POST thẳng lên Cloudinary qua XMLHttpRequest** (không Authorization; dùng XHR để có event progress) |
| `registerUpload(documentId, meta)` | `POST /documents/{documentId}/pages/register-upload` → `ApiPage` |

**`pages.ts`**
| `denoisePage(pageId, {source?, params?})` | `POST /pages/{pageId}/denoise` → `{page_id, status}` |
| `listPages(documentId)` | `GET /documents/{documentId}/pages` |
| `getPage(pageId)` | `GET /pages/{pageId}` |
| `getPageStatus(pageId)` | `GET /pages/{pageId}/status` → `ApiPageStatus` |
| `getPageDownloadUrl(pageId, type)` | build chuỗi URL `…/download?type=…` (không fetch) |
| `pollPageStatus(pageId, {until, intervalMs=1500, timeoutMs=120000, onTick, signal})` | poll `getPageStatus` tới khi đạt trạng thái terminal |

**`ocr.ts`**
| `triggerOcr(pageId)` | `POST /pages/{pageId}/ocr` |
| `getOcrResult(pageId)` | `GET /pages/{pageId}/ocr` → `ApiOcrDocument` |
| `patchTiptap(pageId, tiptapJson)` | `PATCH /pages/{pageId}/tiptap` → `ApiPage` |

**`corrections.ts`**
| `triggerLlmCorrection(pageId)` | `POST /pages/{pageId}/llm-correction` → `{status, page_id, provider}` |
| `listCorrections(pageId, status?)` | `GET /corrections/by-page/{pageId}` → `ApiCorrection[]` |
| `keepCorrection(id)` | `POST /corrections/{id}/keep` |
| `undoCorrection(id)` | `POST /corrections/{id}/undo` |
| `bulkReview({accept_ids?, reject_ids?})` | `POST /corrections/bulk` (**chưa dùng trong UI**) |
| `getFinalText(pageId)` | `GET /corrections/by-page/{pageId}/final-text` (**chưa dùng trong UI**) |

**`exports.ts`**
| `exportDocx(documentId)` | `POST /documents/{documentId}/export/docx` → `ApiExportResult` |
| `exportPdf(documentId)` | `POST /documents/{documentId}/export/pdf` |

---

## 4. Quản lý state

### `useUploadStore` — [lib/upload-store.ts](../frontend/lib/upload-store.ts) (Zustand)
Sống ngoài React → giữ qua điều hướng. State: `step` (`'idle'|'signing'|'uploading'|'registering'|'complete'|'error'`), `progress` (0–100), `statusMessage`, `error`, `resultPage`, `documentId`, `previewDataUrl`, `fileName`. Action chính:
- `startUpload(workspace, file, previewDataUrl)` — điều phối toàn bộ: (1) nếu `workspace.kind==='new'` → `api.documents.create({title})`; (2) `api.uploads.sign`; (3) `api.uploads.toCloudinary` map `onProgress` vào `progress`; (4) `api.uploads.register`; set `complete` + `resultPage`. **Pipeline dừng ở `uploaded`** — denoise là hành động riêng.
- `reset()`.

### `useAuth` — [lib/auth-store.ts](../frontend/lib/auth-store.ts) (Zustand)
State: `user: ApiUser|null`, `isAuthenticated`, `isLoading`, `isHydrating`, `error`. Action:
- `hydrate()` — nếu có cookie token → `api.auth.me()`; lỗi → xoá token + redirect `/login`.
- `login/register` → gọi API → `applySession()` lưu access+refresh + set user.
- `logout()` → `api.auth.logout()` (best-effort) + xoá token + reset.
- helper `hasRole(user, ...roles)`.

### State multi-workspace / per-page — **không ở store**, nằm cục bộ trong [editor/[id]/page.tsx](../frontend/app/(dashboard)/dashboard/editor/[id]/page.tsx)
- `pages: ApiPage[]`, `activePageId` (page đang xử lý).
- `ocrByPage: Record<pageId, ApiOcrDocument|null>` (cache layout OCR theo page); ref `fetchedOcr` chống fetch trùng.
- `corrections: ApiCorrection[]` (chỉ cho page active).
- `revisionByPage: Record<pageId, number>` — `bumpRevision()` ép TipTap reload sau khi backend recompute.
- `busyAction: 'denoise'|'ocr'|'llm'|'export'|null`, `pollingRef`.

---

## 5. Mô hình domain — [lib/api/types.ts](../frontend/lib/api/types.ts)

Phản chiếu `backend/app/schemas/`. Type chính:
- `UserRole = 'admin'|'user'|'viewer'`; `UserStatus = 'active'|'banned'|'pending'`.
- **`PageStatus`** (máy trạng thái pipeline): `'uploaded'|'denoising'|'denoised'|'ocr_running'|'ocr_done'|'llm_running'|'llm_done'|'reviewing'|'reviewed'|'exported'|'failed'`.
- `ApiUser`: `{id, email, full_name|null, role, status, images_used}`.
- `AuthSession`: `{access_token, refresh_token, token_type:'bearer', user}`.
- `ApiDocument` (workspace): `{id, title, description|null, status, total_pages, created_at}`.
- `ApiPage` (bản ghi trung tâm per-ảnh): `{id, document_id, page_number, status, original_url, denoised_url|null, denoise_version, width, height, file_size_kb, ocr_plain_text|null, tiptap_json|null, final_text|null, processing_error|null, completed_at|null}`.
- `ApiOcrDocument` (từ `GET /pages/{id}/ocr`): `{page_id, width, height, ocr_document, tiptap_json, plain_text, low_confidence_words, suspicious_count, blurred}`.
- `ApiCorrection`: `{id, page_id, word_indices|null, start_offset|null, end_offset|null, original_text, suggested_text, reason|null, llm_provider, llm_model, confidence_score|null, status, reviewed_at|null, created_at}`.
- `ApiExportResult` `{export_id, format, file_url}`; `ApiFinalText` `{page_id, text, blurred}`.

> ⚠️ File **`lib/types.ts`** là **legacy** (dùng bởi mock-data/admin/editor cũ) — KHÔNG khớp `ApiUser`/`ApiPage`.

---

## 6. Components — luồng editor

| Component | Vai trò |
|---|---|
| [correction-review-editor.tsx](../frontend/components/editor/correction-review-editor.tsx) `CorrectionReviewEditor` | **Editor TipTap v3** bind vào `tiptap_json` của page. Extension tuỳ biến `paragraphMeta` giữ attrs layout (`range`, `blockId`, `bbox`, `confidence`) qua round-trip; plugin `lowConfExtension` vẽ `Decoration.inline` class `ocr-low-conf` (gạch chân răng cưa amber) lên từ low-confidence theo `start_offset/end_offset`. Prop `revision` bump → `setContent(value)` (cách reload sau Keep/Undo / chuyển page). Nút "Save text" → `onSave(editor.getJSON())`. |
| [before-after-compare.tsx](../frontend/components/editor/before-after-compare.tsx) `BeforeAfterCompare` | **So sánh denoise trước/sau**: slider wipe — ảnh gốc làm nền, ảnh denoised phủ lên clip bằng `clip-path: inset(...)` theo range input. (Dựa vào việc denoise giữ nguyên kích thước ảnh.) |
| [page-upload-panel.tsx](../frontend/components/editor/page-upload-panel.tsx) `PageUploadPanel` | Dropzone (`react-dropzone`, JPG/PNG/WEBP/TIFF/BMP ≤ 20MB). Đọc preview data-URL → `useUploadStore.startUpload`. 2 mode: `{kind:'new',title}` / `{kind:'existing',id}`. Hiện `Progress`; `complete` → gọi `onComplete(page, documentId)` 1 lần rồi reset store. |
| [processing-indicator.tsx](../frontend/components/editor/processing-indicator.tsx) `ProcessingIndicator` | Placeholder thị giác cho bước AI đang chạy (skeleton + sweep). **Không poll** — poll nằm ở route. |
| `image-viewer.tsx`, `text-editor.tsx` | **LEGACY/không dùng** (mock cũ, đã bị `CorrectionReviewEditor` thay thế). |

**Cơ chế poll bất đồng bộ (thực tế, trong route editor):**
- Một effect chạy `setInterval(() => refreshPage(id), 2000)` khi status page active ∈ `ACTIVE_STATUSES = ['denoising','ocr_running','llm_running']`.
- Mỗi hành động trigger đi qua `runAndWait(trigger, until)` → gọi trigger rồi `api.pages.pollStatus(pageId, {until:[...,'failed'], timeoutMs:180000, onTick})`; `onTick` cập nhật live status/`denoised_url`/`denoise_version`; terminal `failed` → toast.

---

## 7. Luồng end-to-end Frontend (ánh xạ UI → API)

```
[1] Landing /          Navbar "Get Started"/"Log in" → /register hoặc /login

[2] Register/Login     useAuth.register/login → api.auth.register|login
                       → applySession() ghi cookie denoise_token + denoise_refresh
                       → router.push(next || '/dashboard')
                       (middleware từ đây cho qua /dashboard, chặn quay lại /login)

[3] Dashboard hydrate  (dashboard)/layout.tsx → useAuth.hydrate() → api.auth.me()
                       (lấy role + quota; gate loading; lỗi → /login)
                       /dashboard list workspace qua api.documents.list()

[4] Tạo/mở workspace   "New Document" → /dashboard/editor/new
                       picker (api.documents.list) → chọn cũ HOẶC "+ tạo mới" (+title)
                       mở doc cũ từ history → editor/{id}: api.documents.get + api.pages.list

[5] Upload trang       PageUploadPanel → useUploadStore.startUpload:
                       api.documents.create (chỉ khi mới) → api.uploads.sign
                       → api.uploads.toCloudinary (direct, XHR progress) → api.uploads.register
                       page mới (status:'uploaded') thành activePageId
                       (flow "new": router.replace('/dashboard/editor/{documentId}'))

[6] Denoise            "Run Denoise" → handleDenoise('original')
                       → runAndWait(() => api.pages.denoise(id,{source}), ['denoised'])
                       poll getPageStatus tới denoised/failed
                       → hiển thị BeforeAfterCompare (wipe). "Denoise again" dùng source:'current_denoised'
                       → "Download Denoised" mở denoised_url

[7] OCR                "Run OCR" (bật khi đã denoised) → handleRunOcr
                       → runAndWait(() => api.ocr.trigger(id), ['ocr_done'])
                       → api.ocr.get(id) nạp ApiOcrDocument vào ocrByPage, bump revision
                       → render trong CorrectionReviewEditor, gạch chân từ low-confidence

[8] Chỉnh tay          edit text + "Save text" → handleSaveTiptap → api.ocr.saveTiptap (PATCH tiptap)

[9] LLM correction     "Run LLM Correction" → handleRunLlm
                       → runAndWait(() => api.corrections.trigger(id), ['llm_done'])
                       → api.corrections.list(id) đổ danh sách gợi ý (card original → suggested + reason + badge)
                       (viewer thấy hint provider free; user/admin = OpenAI)

[10] Review keep/undo  mỗi gợi ý pending có Keep / Undo
                       → reviewSuggestion(id) → api.corrections.keep|undo
                       → refreshPage(id) + bumpRevision (editor reload tiptap_json/final_text backend dựng lại)
                       (keep/undo do BACKEND quyết định; FE chỉ refetch)

[11] Export            nút DOCX/PDF (ẩn với viewer) → handleExport
                       → api.exports.docx|pdf(docId) → mở res.file_url tab mới

[12] Thêm trang        panel "Add next page" (mode existing) → nối page mới
                       (viewer bị chặn bởi quota: images_used ≥ 10, tối đa 2 workspace)
```

---

## 8. `hooks/`

| Hook | Chức năng |
|---|---|
| [use-mobile.ts](../frontend/hooks/use-mobile.ts) `useIsMobile` | `matchMedia` breakpoint 768px → boolean (dùng cho sidebar shadcn). |
| [use-toast.ts](../frontend/hooks/use-toast.ts) `useToast`/`toast` | Toast store reducer (Radix) — **legacy**, app dùng `sonner` thay thế. |

---

## 9. Ghi chú / caveat quan trọng

1. **2 codebase song song**: code thật nối backend vs. mock/demo cũ (`mock-data.ts`, `lib/types.ts`, `text-editor.tsx`, `image-viewer.tsx`, admin, settings). Code cũ có lỗi type, chỉ build được nhờ `ignoreBuildErrors: true`.
2. **`/admin`** hoàn toàn mock-driven, tham chiếu field không tồn tại (`user.plan`, `user.documentsCount`); sub-route `/admin/users`, `/admin/logs`, và `/forgot-password`, `/terms`, `/privacy` **chưa hiện thực**.
3. **`/dashboard/settings`** non-functional (save chỉ toast).
4. **Bảo mật token**: access + refresh JWT lưu cookie **không httpOnly** (client JS đọc được — chính code comment cũng cảnh báo chưa production-grade).
5. **2 file `globals.css`** — chỉ `app/globals.css` được import (`styles/globals.css` là dead).
6. **`theme-provider.tsx`** tồn tại nhưng **chưa mount** ở layout gốc → dark mode `next-themes` chưa active.
7. Form dùng `useState` validate tay dù đã cài `react-hook-form` + `zod`.

> Xem **file 01** cho phía backend và **file 03** cho map hàm ↔ database.
