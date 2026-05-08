# Docker 部署说明（5173 不变）

目标：

- 对外访问：`http://111.231.44.21:5173`
- Nginx 监听 `5173`
- Nginx 反代 `/api` 到后端 `3010`

## 1. 服务器拉取项目

```bash
git clone <你的仓库地址>
cd Design_pro_forhos
```

## 2. 生成前端静态文件

> 这里直接在服务器执行一次构建，把 `dist` 提供给 Nginx。

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm build
```

## 3. 配置环境变量

```bash
cp deploy/.env.example .env
```

编辑 `.env`，至少改：

- `HOSPITAL_JWT_SECRET`（必须）
- `HOSPITAL_CORS_ORIGINS`（默认已是 `http://111.231.44.21:5173`）

## 4. 启动容器

```bash
docker compose up -d --build
```

## 5. 检查

```bash
docker compose ps
curl -I http://111.231.44.21:5173/
curl http://111.231.44.21:5173/api/health
```

期望：

- 首页返回 `200`
- `/api/health` 返回 JSON

## 6. 更新发布

```bash
git pull
pnpm build
docker compose up -d --build
```

## 7. 数据与附件

- SQLite 与附件目录挂载在：`./server/data`
- 请定期备份该目录。
