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

# 6. Chạy Celery
#
# Cách nhanh (dev) — một worker nghe TẤT CẢ queue, pool 4 thread:
celery -A app.workers.celery_app worker -P threads -c 4 \
  -Q default,classify_queue,denoise_queue,ocr_queue,llm_queue,payment_queue --loglevel=info

# Cách production (khuyến nghị) — mỗi loại task một worker/queue/pool riêng để
# task nặng (denoise) không chiếm slot của task nhẹ, và payment luôn mượt
# (xem celery_redis_pool_deploy_plan.md). Mở mỗi lệnh trong 1 terminal:
#   celery -A app.workers.celery_app worker -Q classify_queue -c 2 -n classify@%h --loglevel=info
#   celery -A app.workers.celery_app worker -Q denoise_queue  -c 1 -n denoise@%h  --loglevel=info
#   celery -A app.workers.celery_app worker -Q ocr_queue      -c 2 -n ocr@%h      --loglevel=info
#   celery -A app.workers.celery_app worker -Q llm_queue      -c 4 -n llm@%h      --loglevel=info
#   celery -A app.workers.celery_app worker -Q payment_queue  -c 1 -n payment@%h  --loglevel=info
#   celery -A app.workers.celery_app worker -Q default        -c 1 -n default@%h  --loglevel=info
#
# Lưu ý Windows: thêm `-P solo` (hoặc `-P threads`) cho mỗi worker vì prefork
# không chạy ổn trên Windows. task_time_limit chỉ cưỡng chế trên prefork (Linux).

# 7. (Tùy chọn) Theo dõi queue/worker bằng Flower
celery -A app.workers.celery_app flower --port=5555

# 8. (Thanh toán) Stripe — test mode
#   .env: STRIPE_API_KEY=sk_test_..., FRONTEND_URL=http://localhost:3000
#   stripe listen --forward-to localhost:8000/api/v1/billing/webhook
#   → copy "whsec_..." vào STRIPE_WEBHOOK_SECRET
