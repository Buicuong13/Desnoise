cd "d:\Học tập\Nam04\Denoise_project\backend"

# 1. Hạ tầng (Postgres + Redis)
docker compose up -d

# 2. Tạo file cấu hình local
Copy-Item .env.example .env

# 3. Môi trường Python (bạn tự cài)
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt    # tensorflow ~1GB, tải lâu

# 4. Tạo bảng
alembic upgrade head

# 5. Chạy API
uvicorn app.main:app --reload
