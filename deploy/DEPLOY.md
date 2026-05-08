# Docker 低内存服务器部署说明（GitHub Actions 构建镜像）

目标：

- 对外访问：`http://111.231.44.21:5173`
- Nginx 监听 `5173`
- Nginx 反代 `/api` 到后端 `3010`
- 服务器不再执行前端构建，避免 2G 内存服务器在 `pnpm build` 时卡顿或 OOM

## 1. 部署架构

现在采用“GitHub Actions 构建，服务器拉镜像”的方式：

```text
本地开发提交代码
  ↓
git push 到 GitHub main 分支
  ↓
GitHub Actions 构建 API 镜像和 Web 镜像
  ↓
推送镜像到 GitHub Container Registry（GHCR）
  ↓
服务器 docker compose pull 拉取镜像
  ↓
服务器 docker compose up -d 重启容器
```

镜像分为两个：

- API 镜像：`ghcr.io/<你的github用户名>/<你的仓库名>/api:latest`
- Web 镜像：`ghcr.io/<你的github用户名>/<你的仓库名>/web:latest`

## 2. GitHub Actions

工作流文件：`.github/workflows/docker-image.yml`

触发方式：

- 推送到 `main` 分支自动构建
- 在 GitHub Actions 页面手动执行 `workflow_dispatch`

Actions 会自动使用 `GITHUB_TOKEN` 登录 GHCR，并推送以下标签：

```text
ghcr.io/<owner>/<repo>/api:latest
ghcr.io/<owner>/<repo>/api:<commit-sha>
ghcr.io/<owner>/<repo>/web:latest
ghcr.io/<owner>/<repo>/web:<commit-sha>
```

> 注意：GHCR 镜像路径需要全小写。

## 3. 第一次服务器部署

### 3.1 拉取项目

```bash
git clone <你的仓库地址>
cd Design_pro_forhos
```

### 3.2 配置环境变量

```bash
cp deploy/.env.example .env
```

编辑 `.env`：

```bash
nano .env
```

至少修改：

```env
HOSPITAL_JWT_SECRET=替换成强随机密钥
HOSPITAL_CORS_ORIGINS=http://111.231.44.21:5173
APP_IMAGE=ghcr.io/<你的github用户名>/<你的仓库名>/api:latest
WEB_IMAGE=ghcr.io/<你的github用户名>/<你的仓库名>/web:latest
```

示例：

```env
APP_IMAGE=ghcr.io/cpiforheal/design_pro_forhos/api:latest
WEB_IMAGE=ghcr.io/cpiforheal/design_pro_forhos/web:latest
```

### 3.3 登录 GHCR

如果仓库或镜像是私有的，服务器需要先登录 GHCR。

在 GitHub 创建 Personal Access Token，至少勾选：

- `read:packages`

然后服务器执行：

```bash
echo <你的GitHubToken> | docker login ghcr.io -u <你的GitHub用户名> --password-stdin
```

如果镜像设置为公开，也可以不登录。

### 3.4 启动服务

```bash
docker compose pull
docker compose up -d
```

## 4. 检查服务

```bash
docker compose ps
curl -I http://111.231.44.21:5173/
curl http://111.231.44.21:5173/api/health
```

期望：

- 首页返回 `200`
- `/api/health` 返回 JSON

## 5. 后续更新发布

本地开发完成后：

```bash
git add .
git commit -m "你的提交说明"
git push origin main
```

等待 GitHub Actions 构建完成后，服务器执行：

```bash
cd Design_pro_forhos
git pull
docker compose pull
docker compose up -d
docker image prune -f
```

说明：

- `docker compose pull`：拉取 GitHub Actions 构建好的新镜像
- `docker compose up -d`：用新镜像重启容器
- `docker image prune -f`：清理旧镜像，避免服务器磁盘占满

## 6. 本地 Docker 构建测试

如果需要在本地测试完整 Docker 构建，可以使用：

```bash
docker compose -f deploy/docker-compose.local.yml up -d --build
```

停止本地测试容器：

```bash
docker compose -f deploy/docker-compose.local.yml down
```

> 生产服务器不要使用这个本地构建文件，否则仍然会在服务器上执行构建。

## 7. 数据与附件

SQLite 数据库和附件目录挂载在：

```text
./server/data
```

请定期备份：

```bash
tar -czf server-data-backup-$(date +%F).tar.gz server/data
```

## 8. 常见问题

### 8.1 服务器提示 denied 或 unauthorized

原因通常是没有登录 GHCR，或 Token 没有 `read:packages` 权限。

重新执行：

```bash
echo <你的GitHubToken> | docker login ghcr.io -u <你的GitHub用户名> --password-stdin
```

### 8.2 镜像拉不到

检查 `.env` 中镜像地址是否全小写：

```env
APP_IMAGE=ghcr.io/<owner>/<repo>/api:latest
WEB_IMAGE=ghcr.io/<owner>/<repo>/web:latest
```

### 8.3 服务器又开始构建

确认生产使用的是根目录 `docker-compose.yml`，并且里面使用的是 `image`，不是 `build`。

不要在服务器执行：

```bash
docker compose -f deploy/docker-compose.local.yml up -d --build
```
