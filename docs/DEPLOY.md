# 免费部署与数据库演示

## 主线路

1. 在 Neon 免费项目选亚太新加坡区域，创建本项目 PostgreSQL 数据库。分开配置应用连接和验收只读账号。
2. 在 Northflank Developer Sandbox 建一个项目和容器服务。使用本仓库根目录 Dockerfile，应用端口 3001 配置为公网 HTTP，由平台提供 HTTPS 域名。
3. 在服务环境变量配置 `DATABASE_URL`、`ADMIN_PASSWORD` 和 `PUBLIC_ORIGIN=https://实际域名`。生产容器启动按序迁移、导入种子、启动 API。用 `/api/v1/health` 和实际文献查询验证。
4. 将公开首页和 `/api/v1/documents` 的完整 HTTPS URL 填入 README。再从校园网和手机流量打开两者、访问独立文献 URL、登录维护端发布一条资料。记录日期、网络及结果。

若主线路免费资格、容量或可达性受限，将同一镜像部署到 Render 的新加坡 Free Web Service。可使用根目录 `render.yaml` 或在控制台配置 Docker 运行时。数据库连接保持 Neon，`PUBLIC_ORIGIN` 改为选中线路的 HTTPS 源。免费 Render 空闲后会休眠，单独记录冷启动并在答辩前主动打开页面和真实接口。切换线路时同样核查账户免费状态。

## DBeaver Community

数据库管理员在 PostgreSQL 创建项目专用的登录角色后，只授予业务表读取权限。使用 DBeaver 的 PostgreSQL 连接，配置 Neon 的 TLS 和本项目只读角色。投屏前隐藏连接面板和认证字段。

```sql
GRANT USAGE ON SCHEMA public TO zj_demo_reader;
GRANT SELECT ON public.documents, public.document_audit TO zj_demo_reader;

SELECT id, title, status, publish_date, collected_at
FROM public.documents
WHERE title ILIKE '%跨境%'
ORDER BY collected_at DESC;

SELECT document_id, action, created_at
FROM public.document_audit
ORDER BY created_at DESC
LIMIT 10;
```

`zj_demo_reader` 由数据库管理员使用客户端的角色管理功能创建，并通过私有渠道设定认证信息。使用真实数据库角色运行验证查询，现场按文献 ID 对照页面与接口返回。备份使用 `pg_dump` 导出业务表及审计记录，在独立的数据库恢复并比较记录数和 ID。备份保存在受控位置。
