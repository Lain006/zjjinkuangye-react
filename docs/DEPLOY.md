# 免费部署与数据库演示

## 当前生产服务

| 项目 | 当前值 |
| --- | --- |
| React 网站 | [公网首页](https://zjjinkuangye-react.onrender.com/) |
| Express API | [公开文献 JSON](https://zjjinkuangye-react.onrender.com/api/v1/documents) |
| 数据库连通检查 | [Health](https://zjjinkuangye-react.onrender.com/api/v1/health) |
| 应用托管 | Render Free，新加坡 |
| 真实数据库 | Neon Free，PostgreSQL 17，新加坡 |
| 应用提交 | [fdec825](https://github.com/Lain006/zjjinkuangye-react/commit/fdec8257eee8648982b880c46aa6b01d1f99e309) |

Northflank 的免费工作区创建服务时要求绑卡验证，用户选择使用不绑卡的 Render Free。Render 通过仓库根目录 Dockerfile 构建。环境变量 `DATABASE_URL` 配置 Neon 的 TLS 连接，`ADMIN_PASSWORD` 由组员在 Render 环境变量界面管理。部署根目录保持仓库根，并可从根目录的 `render.yaml` 查看配置。

部署完成后打开首页、深链接及实际 JSON API。健康探针为 `/api/v1/livez`，它只验证 Node 进程。人工检查 `/api/v1/health` 时会真实查询数据库。分支自动部署已关闭，答辩版由组长手动定位指定 commit 更新。

Render Free 空闲 15 分钟会休眠，答辩前从校园网和手机流量分别打开首页与真实文献 API，使服务和数据库恢复，再做冷启动和真实设备记录。 [Render 免费服务说明](https://render.com/docs/free)

## DBeaver Community

DBeaver 可用 PostgreSQL 连接，配置 Neon 的 TLS 和项目只读角色。云端验收临时登录已撤回，答辩前由数据库管理员在私有界面启用只读角色登录并设定认证信息。只读权限保留在角色上。投屏前隐藏连接面板和认证字段。

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

现场以新发布的文献 ID 对照前端详情、JSON 和 DBeaver 查询。业务数据可用 `pg_dump` 备份，在独立数据库恢复并比较行数、ID 和 UTC 时间戳。备份保存在受控位置。
