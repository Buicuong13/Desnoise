# 01 — Luồng chạy Backend & Tổ chức chức năng từng folder

> Hệ thống **Denoise + OCR + LLM Correction**. Backend: **Python 3.11+ · FastAPI · SQLAlchemy 2.0 · Celery + Redis · PostgreSQL**.
> Tài liệu này mô tả **code thực tế** trong `backend/`, có ghi chú nơi code đã đi khác so với bản thiết kế trong `README.md`.

---

## 0. Tóm tắt nhanh

- Backend là **API trạng thái-rời (stateless)**: mọi trạng thái nằm trên DB, không có session toàn cục.
- Pipeline AI có **điểm dừng**: `Upload → Denoise → OCR → LLM Correction → Review → Export`. **Không bước nào tự kích hoạt bước kế tiếp** — user phải bấm nút để chạy từng bước.
- 3 tác vụ nặng chạy bất đồng bộ qua **Celery** (`denoise`, `ocr`, `llm_correction`). API chỉ enqueue và trả `202`.
- Ảnh được upload **trực tiếp từ trình duyệt lên Cloudinary** (signed upload); backend không nhận bytes ảnh khi upload.
- Phân quyền 3 role: `admin / user / viewer`. Provider LLM được backend **tự chọn theo role** (user/admin → OpenAI, viewer → OpenRouter free), client không được phép truyền provider.

---

## 1. Công nghệ & điểm vào (entrypoint)

### 1.1. Stack (từ [backend/requirements.txt](../backend/requirements.txt))

| Nhóm | Thư viện |
|---|---|
| Web | `fastapi`, `uvicorn[standard]`, `pydantic` + `pydantic-settings`, `python-multipart` |
| DB | `sqlalchemy 2.0`, `psycopg2-binary`, `alembic` |
| Auth | `python-jose[cryptography]` (JWT), `passlib[argon2]` + `argon2-cffi` |
| Async | `celery 5.4`, `redis` |
| Storage | `cloudinary`, `httpx` |
| AI denoise | `tensorflow` (U-Net), `pillow`, `numpy` |
| AI OCR | `pytesseract` (Tesseract) |
| AI LLM | `langchain` + `langchain-openai` + `langchain-core` |
| Export | `python-docx` (DOCX), `reportlab` (PDF) |

> **Ghi chú lệch thiết kế:** `slowapi`, `opencv-python`, `docx2pdf` có trong requirements nhưng **không được import** trong code → chưa có rate-limit thật; PDF dựng bằng `reportlab` (không phải `docx2pdf`).

### 1.2. Entrypoint — [backend/app/main.py](../backend/app/main.py)

- `create_app()` → `setup_logging()` → tạo `FastAPI(title, debug, version)`.
- Middleware **CORS**: origins lấy từ `settings.CORS_ORIGINS` (chuỗi phân tách dấu phẩy), `allow_credentials=True`.
- Route nội tuyến: `GET /healthz` → `{"status":"ok"}`.
- Gắn `api_router` dưới prefix **`/api/v1`**. Biến module-level `app = create_app()`.
- **Không** có startup/shutdown event, **không** `Base.metadata.create_all` (schema do **Alembic** quản lý).

### 1.3. Lắp ráp router — [backend/app/api/v1/api.py](../backend/app/api/v1/api.py)

| Module endpoint | Prefix | Tag |
|---|---|---|
| `auth` | `/auth` | auth |
| `users` | `/users` | users |
| `documents` | `/documents` | documents |
| `uploads` | `""` (path tự nhúng) | uploads |
| `pages` | `""` | pages |
| `ocr` | `""` | ocr |
| `restoration` | `""` | restoration |
| `corrections` | `/corrections` | corrections |
| `exports` | `""` | exports |
| `admin` | `/admin` | admin |

> **Document = Workspace = một cuốn sách.** `uploads/pages/ocr/restoration/exports` dùng prefix rỗng và nhúng full path trong decorator (vd. `/pages/{id}/ocr`, `/documents/{doc_id}/pages`).

---

## 2. Tổ chức chức năng từng folder (`backend/app/`)

```
backend/app/
├── main.py            # Khởi tạo FastAPI app, CORS, /healthz, gắn router /api/v1
├── core/              # Hạ tầng cross-cutting: config, security, exceptions, logging
├── api/               # Tầng HTTP: deps (DI) + v1/endpoints/* (route handlers)
├── database/          # Engine, Session, Base ORM + mixins
├── models/            # SQLAlchemy ORM (13 bảng) + enums
├── schemas/           # Pydantic I/O (request/response)
├── services/          # Logic nghiệp vụ (orchestration cho từng bước pipeline)
├── workers/           # Celery app + 3 task bất đồng bộ
├── ai/                # Hiện thực model/engine: denoising / ocr / llm
├── storage/           # Lưu blob (Cloudinary / local) — interface + factory
├── repositories/      # (RỖNG — không dùng repository pattern)
└── utils/             # (RỖNG)
```

### 2.1. `core/` — hạ tầng dùng chung
| File | Chức năng |
|---|---|
| [config.py](../backend/app/core/config.py) | `Settings(BaseSettings)` đọc `.env`, `get_settings()` có `@lru_cache`. Chứa JWT/DB/Redis/Celery/Cloudinary/Tesseract/OpenAI/OpenRouter, quota (`VIEWER_MAX_IMAGES=10`, `VIEWER_MAX_WORKSPACES=2`), `SUSPICIOUS_CONFIDENCE_THRESHOLD=70.0`. |
| [security.py](../backend/app/core/security.py) | Hash mật khẩu **Argon2** (`hash_password`/`verify_password`); JWT `create_access_token` (HS256, claim `sub`+`role`+`type:"access"`), `decode_access_token`; refresh token (`create_refresh_token` trả raw+sha256 hash+expiry, `hash_refresh_token`). |
| [exceptions.py](../backend/app/core/exceptions.py) | `AppError(HTTPException)` + lớp con: `AuthenticationError`(401), `PermissionDenied`(403), `NotFound`(404), `QuotaExceeded`(403), `ValidationError`(400). |
| [logging.py](../backend/app/core/logging.py) | `setup_logging()` (handler stdout, level theo `DEBUG`), `get_logger(name)`. |

### 2.2. `database/`
| File | Chức năng |
|---|---|
| [base.py](../backend/app/database/base.py) | `Base(DeclarativeBase)`; `UUIDPKMixin` (UUID PK, default `uuid4`); `TimestampMixin` (`created_at`/`updated_at` server-side). |
| [session.py](../backend/app/database/session.py) | `engine` (**sync**, `pool_pre_ping`); `SessionLocal` (`expire_on_commit=False`); dependency `get_db()` (generator, không tự commit). |

### 2.3. `models/` — ORM (13 bảng)
- [enums.py](../backend/app/models/enums.py) — toàn bộ enum kiểu `str`: `UserRole`, `UserStatus`, `DocumentStatus`, **`PageStatus`** (xem §6), `CorrectionStatus`, `LLMProvider`, `ExportFormat`, + enum subscription/payment.
- Mỗi entity 1 file: `user.py`, `document.py`, `page.py` (trung tâm pipeline), `ocr_word.py`, `correction.py`, `denoise_attempt.py`, `refresh_token.py`, `export.py`, `feedback.py`, `subscription.py`, `payment.py`, `audit_log.py`. (Chi tiết schema → xem **file 03**.)

### 2.4. `schemas/` — Pydantic I/O
| File | Schema chính |
|---|---|
| [auth.py](../backend/app/schemas/auth.py) | `RegisterIn`, `LoginIn`, `RefreshIn`, `LogoutIn`, `TokenOut`, `AuthSessionOut`, `UserOut`, `DevLoginIn` |
| [document.py](../backend/app/schemas/document.py) | `DocumentCreate`, `DocumentOut` |
| [page.py](../backend/app/schemas/page.py) | `PageOut`, `PageStatusOut`, `DenoiseIn`, `TiptapPatchIn` |
| [ocr.py](../backend/app/schemas/ocr.py) | Contract layout nội bộ `OCRDocument` (cây `OcrBlockNode→Paragraph→Line→Word`, bbox `[x0,y0,x1,y1]`, conf 0–1), `LowConfidenceWord`; shape API `OcrWordOut`, `OcrDocumentOut` |
| [correction.py](../backend/app/schemas/correction.py) | `CorrectionOut`, `BulkReviewIn` (`accept_ids`/`reject_ids`), `FinalTextOut` |
| [upload.py](../backend/app/schemas/upload.py) | `SignatureIn`, `SignatureOut`, `RegisterUploadIn` |

### 2.5. `services/` — logic nghiệp vụ (xem §5)
`denoise_service.py`, `ocr_service.py`, `llm_correction_service.py`, `suspicious_detector_service.py`, `tiptap_service.py`, `export_service.py`.

### 2.6. `workers/` — Celery (xem §6)
`celery_app.py`, `denoise_task.py`, `ocr_task.py`, `llm_correction_task.py`.

### 2.7. `ai/` — hiện thực model/engine (xem §7)
- `denoising/`: `model_loader.py`, `inference.py`, `transforms.py`.
- `ocr/`: `base.py` (Protocol + factory), `tesseract_engine.py`.
- `llm/`: `schemas.py`, `prompts/ocr_correction_prompt.py`, `chains/ocr_correction_chain.py`.

### 2.8. `storage/` — blob storage cắm-được
`base.py` (`Storage` Protocol + `StoredImage`), `cloudinary_backend.py`, `local_backend.py`, `__init__.py` (`get_storage()` factory: có Cloudinary config → Cloudinary, ngược lại → local disk).

### 2.9. `repositories/` & `utils/`
**Cả hai RỖNG** (chỉ có `__init__.py`). **Không có tầng repository** — endpoint/service truy vấn DB trực tiếp qua SQLAlchemy `Session`.

---

## 3. Tầng Dependency Injection — [backend/app/api/deps.py](../backend/app/api/deps.py)

| Dependency | Chức năng |
|---|---|
| `bearer_scheme = HTTPBearer(auto_error=False)` | Hiện nút "Authorize" trong Swagger; không tự raise để dependency tự báo lỗi. |
| `get_current_user(credentials, db)` | Validate scheme `Bearer`, decode JWT, bắt buộc `type=="access"`, load `User` theo `sub`, **chặn user bị `banned`**. |
| `require_roles(*roles)` | **Factory** trả dependency kiểm tra `current.role in roles`, sai → `PermissionDenied`. |
| `get_llm_provider_for_user(user)` | Chọn provider **phía server**: `user`/`admin` → `LLMProvider.openai`; còn lại (`viewer`) → `LLMProvider.openrouter_qwen`. |
| Alias | `CurrentUser`, `AdminUser = require_roles(admin)`, `PaidUser = require_roles(user, admin)`. |

> **Ownership check** không nằm ở `deps.py` — mỗi file endpoint tự định nghĩa helper cục bộ `_get_owned_document` / `_get_owned_page` / `_get_owned_correction` (404 khi truy cập chéo user).

---

## 4. Danh mục Endpoint

Ký hiệu: 🔵 = enqueue Celery task · ⚪ = đồng bộ.

### `auth.py` (`/auth`) — ⚪, **không cần auth**
| Method · Path | Chức năng | Schema |
|---|---|---|
| `POST /register` (201) | Tạo tài khoản **viewer**, phát session | `RegisterIn`→`AuthSessionOut` |
| `POST /login` | Verify mật khẩu, chặn banned, phát session | `LoginIn`→`AuthSessionOut` |
| `POST /refresh` | Validate refresh theo sha256 hash → **xoay vòng** (revoke cũ, mint mới) | `RefreshIn`→`TokenOut` |
| `POST /logout` | Best-effort revoke refresh token | `LogoutIn`→`{"status":"ok"}` |
| `POST /dev-login` | CHỈ dev (403 ngoài `development`): get-or-create user | `DevLoginIn`→`TokenOut` |

### `users.py` (`/users`)
| `GET /me` | Trả user hiện tại | auth `CurrentUser`→`UserOut` |

### `documents.py` (`/documents`) — ⚪, auth `CurrentUser`
| Method · Path | Chức năng |
|---|---|
| `GET ""` | List workspace của user (chưa archived), mới nhất trước |
| `POST ""` (201) | Tạo workspace; **viewer ≤ `VIEWER_MAX_WORKSPACES`** else `QuotaExceeded` |
| `GET /{doc_id}` | Lấy workspace (404 nếu không sở hữu) |
| `PATCH /{doc_id}/ui-state` | **501 — chưa hiện thực** (TODO lưu `ui_state` debounce) |
| `DELETE /{doc_id}` (204) | Soft-delete: `status='archived'` |

### `uploads.py` — ⚪, auth `CurrentUser`
| Method · Path | Chức năng |
|---|---|
| `POST /uploads/signature` | Validate ownership + content-type + size + **quota ảnh viewer**; **bắt buộc Cloudinary**; trả thông tin ký để upload trực tiếp (TTL 300s) |
| `POST /documents/{doc_id}/pages/register-upload` (201) | Sau khi browser upload xong lên Cloudinary → tạo `Page(status='uploaded')`, tính `page_number` kế tiếp, tăng `doc.total_pages` và **`user.images_used`**. **Không auto-denoise.** |

### `pages.py` — auth `CurrentUser`
| Method · Path | Sync? | Chức năng |
|---|---|---|
| `POST /pages/{id}/denoise` (202) | 🔵 | User trigger (re)denoise. Cho phép từ nhiều status (`_DENOISE_ALLOWED`). `source="current_denoised"` fallback về original nếu chưa có. Set `denoising` → enqueue `denoise_page_task`. |
| `GET /documents/{doc_id}/pages` | ⚪ | List page theo số trang |
| `GET /pages/{id}` | ⚪ | Lấy page |
| `GET /pages/{id}/status` | ⚪ | Poll status nhẹ |
| `GET /pages/{id}/download?type=denoised\|original` | ⚪ | Redirect URL Cloudinary, hoặc stream bytes nếu storage local |

### `ocr.py` — auth `CurrentUser`
| Method · Path | Sync? | Chức năng |
|---|---|---|
| `POST /pages/{id}/ocr` (202) | 🔵 | Trigger OCR (yêu cầu status ≥ denoised) → enqueue `ocr_page_task` |
| `GET /pages/{id}/ocr` | ⚪ | Trả `ocr_document_json`, `tiptap_json`, plain text, từ low-confidence, đếm suspicious |
| `PATCH /pages/{id}/tiptap` | ⚪ | Lưu chỉnh tay Tiptap; tính lại `final_text`; status ocr_done/llm_done → `reviewing` |

### `restoration.py` — auth `CurrentUser`
| `POST /pages/{id}/llm-correction` (202) | 🔵 | Trigger LLM correction (yêu cầu `ocr_done`/...); provider chọn theo role qua `get_llm_provider_for_user`; enqueue `llm_correct_page_task(page_id, role)` |

> Tên file/tag là "restoration" nhưng thực chất là **trigger LLM correction** (không phải phục hồi ảnh).

### `corrections.py` (`/corrections`) — ⚪, auth `CurrentUser`
| Method · Path | Chức năng |
|---|---|
| `GET /by-page/{page_id}` | List correction (lọc optional `?status=`) |
| `GET /by-page/{page_id}/final-text` | Dựng lại text với correction `kept`; `blurred = (role==viewer)` |
| `POST /{id}/keep` | `status='kept'`, stamp reviewer, `recompute_review`, page → `reviewing` |
| `POST /{id}/undo` | `status='undone'`, recompute |
| `POST /bulk` | Apply keep cho `accept_ids`, undo cho `reject_ids` trong 1 transaction |

### `exports.py` — ⚪, **auth `PaidUser`** (viewer bị chặn ngay tại API)
| `POST /documents/{doc_id}/export/docx` | Dựng DOCX từ các page → (option) upload Cloudinary → ghi `Export` → mọi page → `exported`; trả `{export_id, format, file_url}` hoặc stream file |
| `POST /documents/{doc_id}/export/pdf` | Tương tự với `build_pdf` |

### `admin.py` (`/admin`) — auth `AdminUser`, **toàn bộ là 501 stub**
`GET /users`, `PATCH /users/{id}`, `GET /history`, `GET /dashboard` — đều raise `501 Not Implemented`.

---

## 5. Tầng Service (`backend/app/services/`)

### [denoise_service.py](../backend/app/services/denoise_service.py) — `denoise_page(page_id, *, source, params)`
1. Mở `SessionLocal`, load `Page`; set `denoising`, clear lỗi, commit.
2. Chọn nguồn ảnh: `current_denoised` (nếu có) hoặc `original`; `storage.download(...)`.
3. Trong `TemporaryDirectory`: ghi input.png → `load_model()` (cache) → `run_inference(...)` → đọc bytes denoised.
4. `new_version = denoise_version+1`; `storage.upload_image(...)` vào `documents/{doc}/denoised/page_{n}_denoised_v{ver}`.
5. Ghi đè `denoised_url`, `current_denoised_cloudinary_public_id`, `denoise_version`, `width/height`; status → `denoised`, set `completed_at`.
6. INSERT 1 row `DenoiseAttempt` (log debug). Commit.
7. **Lỗi** → rollback, reload page, status → `failed`, lưu `processing_error`, re-raise.

### [ocr_service.py](../backend/app/services/ocr_service.py) — `ocr_page(page_id)`
1. Load page, status → `ocr_running`, commit.
2. Chọn nguồn: ưu tiên ảnh denoised, fallback original; `storage.download`.
3. `engine = get_ocr_service()` → `doc = engine.extract_document_layout(image_bytes)`.
4. **Xoá `OcrWord` cũ** của page → duyệt cây `block→para→line→word` theo thứ tự đọc, INSERT từng `OcrWord` (confidence ×100, bbox `{x,y,w,h}`, `is_suspicious = conf_100 < threshold`, `start_offset`/`end_offset`).
5. Ghi `ocr_document_json`, `ocr_plain_text`, `tiptap_json = ocr_document_to_tiptap(doc)`, seed `final_text`; status → `ocr_done`. Commit.
6. Lỗi → rollback → `failed`, re-raise.

### [suspicious_detector_service.py](../backend/app/services/suspicious_detector_service.py) — logic thuần, **không chạm DB**
- `SuspiciousChunk` (word_indices, original_text, context trước/sau).
- `detect_chunks(words, *, context_window=5, max_gap=1)`: sắp theo `word_index`, gom các từ nghi ngờ liền kề (cách nhau ≤ `max_gap` từ tốt) thành cụm, đính kèm ±`context_window` từ ngữ cảnh → đầu vào cho LLM (sửa theo cụm + ngữ cảnh, không từng-từ).

### [llm_correction_service.py](../backend/app/services/llm_correction_service.py)
- `_resolve_provider(role)` — map role→provider (giống `deps`).
- `llm_correct_page(page_id, user_role) -> int`:
  1. Resolve provider + `model_name`; load page; status → `llm_running`.
  2. Load `OcrWord` theo index; `chunks = detect_chunks(words)`. **Không có từ nghi ngờ → status `llm_done`, return 0** (dừng sớm).
  3. **Xoá `Correction` cũ**; `chain = build_chain(provider)`; `chain.batch([{context, original}, ...])`.
  4. Mỗi (chunk, suggestion): bỏ qua nếu `suggested == original`; ngược lại INSERT `Correction(status='pending')` với offset/word_indices/provider/model/`confidence_score`.
  5. status → `llm_done`, commit, return count. Lỗi → rollback → `failed`.
- `recompute_review(db, page)` — dựng lại `final_text` + `tiptap_json` từ `ocr_plain_text` + correction **kept** (theo offset) qua `apply_corrections`. **Backend giữ quyền quyết định cuối (authoritative).**
- `build_final_text(db, page_id)` — đường offset khi có `ocr_plain_text`; **fallback word-index** cho page OCR trước khi nâng cấp layout.

### [tiptap_service.py](../backend/app/services/tiptap_service.py) — chuyển đổi OCR layout ⇄ Tiptap (ProseMirror) JSON, **không chạm DB**
- `ocr_document_to_tiptap(doc)` — mỗi paragraph OCR → 1 node `paragraph` mang `attrs` (`blockId`, `paragraphId`, `bbox`, `confidence`, `range:[start,end]`).
- `apply_corrections(ocr_document_json, plain_text, corrections)` — thay thế theo offset, giữ nguyên range paragraph → trả `(final_text, tiptap_json)`.
- `tiptap_to_plain_text(tiptap)` — trích text đệ quy, paragraph nối bằng dòng trống.

### [export_service.py](../backend/app/services/export_service.py)
- `_page_text(page)` — ưu tiên `final_text` → `tiptap_to_plain_text(tiptap_json)` → `ocr_plain_text`.
- `build_docx(pages)` — `python-docx`, page break giữa các trang → bytes.
- `build_pdf(pages)` — `reportlab` (A4), `PageBreak` giữa trang, escape XML → bytes.

---

## 6. Luồng Worker bất đồng bộ (`backend/app/workers/`)

### [celery_app.py](../backend/app/workers/celery_app.py)
- `Celery("denoise", broker=CELERY_BROKER_URL, backend=CELERY_RESULT_BACKEND)` (Redis).
- Serializer JSON, `task_track_started=True`, `task_always_eager` từ `CELERY_TASK_ALWAYS_EAGER` (chạy in-process khi test local, không cần worker).
- `autodiscover_tasks(["app.workers"])` + import tường minh 3 module task để chắc chắn đăng ký.

### Task (wrapper mỏng, ủy quyền cho service)
| Task (`name`) | Trigger | Gọi | Trả |
|---|---|---|---|
| `denoise_page_task` (`denoise.page`) | `POST /pages/{id}/denoise` | `denoise_page(page_id, source, params)` | `page_id` |
| `ocr_page_task` (`ocr.page`) | `POST /pages/{id}/ocr` | `ocr_page(page_id)` | `page_id` |
| `llm_correct_page_task` (`llm.correct_page`) | `POST /pages/{id}/llm-correction` | `llm_correct_page(page_id, role)` | int (số suggestion) |

> **Lưu ý retry "trang trí":** task có cấu hình `max_retries` nhưng service **re-raise sau khi đánh dấu `failed`** và task **không gọi `self.retry`** (cũng không set `autoretry_for`) → thực tế lỗi chỉ đánh dấu `failed` và propagate 1 lần.

**Chuyển trạng thái mỗi task:**
- denoise: `denoising → denoised` (hoặc `failed`)
- ocr: `ocr_running → ocr_done` (hoặc `failed`)
- llm: `llm_running → llm_done` (hoặc `failed`); short-circuit `llm_done` với 0 suggestion khi không có từ nghi ngờ.

---

## 7. Bên trong pipeline AI (`backend/app/ai/`)

### Denoising — [ai/denoising/](../backend/app/ai/denoising/)
- `model_loader.py`: `build_generator(input_size=(256,256,1))` — **U-Net** (encoder 64→128→256→256(dropout)→512(dropout) + MaxPool; decoder UpSampling + skip `concatenate`; cuối `Conv2D(1,1, sigmoid)`). `load_model()` có `@lru_cache(maxsize=1)`, load weights từ `DENOISING_WEIGHTS_PATH`, raise nếu thiếu.
- `transforms.py`: `normalize/denormalize` (÷255 / ×255 clip→uint8), `load_grayscale_image`, `pad_to_patch_size` (đệm trắng tới bội số patch size).
- `inference.py`: `run_inference(...)` — load grayscale → pad tới bội số `DENOISING_IMAGE_SIZE` (256) → cắt **patch không chồng lấn** → batch qua `model.predict` → ghép lại → **crop về kích thước gốc** → lưu PNG. Xử lý **ảnh kích thước bất kỳ** không cần resize.

### OCR — [ai/ocr/](../backend/app/ai/ocr/)
- `base.py`: `OCRService` `Protocol` (`extract_document_layout(image_bytes) -> OCRDocument`); `get_ocr_service()` `@lru_cache` trả `TesseractLayoutEngine`. → **engine cắm-được**, đổi không đụng orchestration.
- `tesseract_engine.py`: gọi `pytesseract.image_to_data(..., lang=TESSERACT_LANG, config="--psm {PSM}")`; gom token theo `block→par→line`, dựng cây node + `plain_text` với `start_offset`/`end_offset` chính xác; bbox `_union`, confidence trung bình (0–1); thu từ < `threshold` vào `low_confidence_words`.

### LLM correction — [ai/llm/](../backend/app/ai/llm/)
- `prompts/ocr_correction_prompt.py`: `build_prompt()` → `ChatPromptTemplate` (system: trợ lý sửa OCR tiếng Việt+Anh, đề xuất MỘT bản sửa, giữ dấu/hoa-thường trừ khi hỏng, JSON nghiêm ngặt; human: `Context` + từ nghi ngờ + `format_instructions`).
- `schemas.py`: `CorrectionSuggestion` (`original`, `suggested`, `reason`, `confidence: 0..1`) — contract output của LLM.
- `chains/ocr_correction_chain.py`: LCEL chain `build_chain(provider)` = `prompt | llm | PydanticOutputParser`. `_build_llm`: `openai`→`ChatOpenAI(OPENAI_MODEL)`, ngược lại → model free trên OpenRouter (`base_url=OPENROUTER_BASE_URL`). Gọi qua `chain.batch(inputs)`.

> **Ghi chú:** tên provider/env "qwen" được giữ để tương thích, nhưng thực tế trỏ tới một model free khác trên OpenRouter (NVIDIA Nemotron Nano).

---

## 8. Luồng thực thi end-to-end (pipeline có điểm dừng 🛑)

```
[1] Auth                 POST /api/v1/auth/register|login                → tokens
                         (role quyết định provider LLM + quota về sau)

[2] Tạo workspace        POST /api/v1/documents                          → Document(status=draft)
                         (viewer ≤ VIEWER_MAX_WORKSPACES)

[3] Upload (2 bước) 🛑    POST /uploads/signature  → ký, validate quota
                         (browser upload TRỰC TIẾP lên Cloudinary)
                         POST /documents/{id}/pages/register-upload       → Page(status=uploaded)
                         (KHÔNG auto-denoise; tăng user.images_used)

[4] Denoise (trigger) 🛑  POST /pages/{id}/denoise → enqueue denoise_page_task
                         denoise_service: download → U-Net patch → upload _v{n} → status=denoised
                         (lặp lại được với source=current_denoised)
                         → user có thể DOWNLOAD và DỪNG: GET /pages/{id}/download

[5] OCR (trigger) 🛑      POST /pages/{id}/ocr → enqueue ocr_page_task
                         ocr_service: Tesseract layout → ghi ocr_document_json,
                         ocr_plain_text, ocr_words(is_suspicious), tiptap_json,
                         seed final_text → status=ocr_done
                         GET /pages/{id}/ocr (frontend lấy về)

[6] Suspicious detect    (nằm TRONG OCR: is_suspicious mỗi từ; và lại trong LLM
                          qua detect_chunks gom cụm + ngữ cảnh — không phải endpoint riêng)

[7] LLM correction 🛑     POST /pages/{id}/llm-correction → llm_correct_page_task(page_id, role)
                         build chunks → chain.batch theo role → INSERT corrections(pending)
                         → status=llm_done (0 suggestion nếu không có từ nghi ngờ)

[8] Review Keep/Undo 🛑   POST /corrections/{id}/keep|undo  hoặc  /corrections/bulk
                         _set_status → recompute_review (dựng lại final_text + tiptap_json
                         từ correction kept theo offset) → page=reviewing
                         (chỉnh tay: PATCH /pages/{id}/tiptap)

[9] Export (User/Admin)  POST /documents/{id}/export/docx|pdf → build_docx/build_pdf
                         từ final_text mỗi page → (option) Cloudinary → INSERT exports
                         → mọi page = exported (viewer bị chặn bởi PaidUser → 403)
```

**Cung trạng thái page tổng quát:**
`uploaded → denoising → denoised → ocr_running → ocr_done → llm_running → llm_done → reviewing → (reviewed) → exported`, và `failed` đạt được từ bất kỳ bước worker nào.

> ⚠️ `reviewed` có trong enum nhưng **không có code nào chuyển page *vào* `reviewed`** — review dừng ở `reviewing` (transition còn dang dở).

---

## 9. Ghi chú lệch thiết kế / quan sát quan trọng

1. **Không có repository layer / utils** — 2 folder này rỗng; data access nằm inline trong endpoint/service.
2. **`slowapi`, `opencv-python`, `docx2pdf` không được import** — chưa có rate-limit thật; PDF dùng `reportlab`.
3. **Subscription, payment, audit log, feedback** có ORM model nhưng **không endpoint/service nào dùng**. Toàn bộ admin endpoint là `501`. `PATCH /documents/{id}/ui-state` cũng `501`.
4. **`reviewed` page status không bao giờ được set**.
5. **Chọn provider bị lặp** ở `deps.get_llm_provider_for_user` và `llm_correction_service._resolve_provider`; endpoint tính provider để trả response nhưng chỉ truyền `role` cho task (task tự resolve lại).
6. **Confidence khác thang theo tầng**: node layout OCR dùng 0–1; `OcrWord.confidence` và `Correction.confidence_score` lưu 0–100 (×100 khi convert).
7. **"restoration" endpoint = trigger LLM correction**, không phải phục hồi ảnh (tên dễ gây nhầm).

---

### Tham chiếu file chính
`main.py` · `api/v1/api.py` · `api/deps.py` · `models/enums.py` (từ vựng trạng thái) · `services/*.py` · `workers/celery_app.py` · `ai/`
