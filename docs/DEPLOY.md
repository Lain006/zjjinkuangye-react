# 免费部署与数据库演示

## 当前生产服务

| 项目 | 当前值 |
| --- | --- |
| React 网站 | [公网首页](https://zjjinkuangye-react.onrender.com/) |
| Express API | [公开文献 JSON](https://zjjinkuangye-react.onrender.com/api/v1/documents) |
| 数据库连通检查 | [Health](https://zjjinkuangye-react.onrender.com/api/v1/health) |
| 应用托管 | Render Free，新加坡 |
| 真实数据库 | Neon Free，PostgreSQL 17，新加坡 |
| 应用提交 | [a1b716e](https://github.com/Lain006/zjjinkuangye-react/commit/a1b716e502363e1dc1e19a51da961b0847e53b61) |
| 部署记录 | [2026-11-25 Render 部署](https://dashboard.render.com/web/srv-dc1veqp42hec738ii7j0/deploys/dep-dc392qajnfac73a315mg) |

Northflank 的免费工作区创建服务时要求绑卡验证，用户选择使用不绑卡的 Render Free。Render 通过仓库根目录 Dockerfile 构建。环境变量 `DATABASE_URL` 配置 Neon 的 TLS 连接，`ADMIN_PASSWORD` 由组员在 Render 环境变量界面管理。部署根目录保持仓库根，并可从根目录的 `render.yaml` 查看配置。

部署完成后打开首页、深链接及实际 JSON API。健康探针为 `/api/v1/livez`，它只验证 Node 进程。人工检查 `/api/v1/health` 时会真实查询数据库。分支自动部署已关闭，答辩版由组长手动定位指定 commit 更新。

2026-11-25 手动部署全站手剪纸版。公网首页、文献库、三个分析视图和维护入口返回与本地生产构建一致的前端资源。浏览器验证了首页自动换题和轻摆、刷新轻摆、三个分析视图、三亚·海南下钻和维护登录页。数据库健康检查通过。发布前后的公开统计总数均为 23 条文献、6 个有记录的主题、20 个发布月份和 7 个地区。[包含浏览器断言修正的 GitHub Actions 检查](https://github.com/Lain006/zjjinkuangye-react/actions/runs/45571022136)

2026-11-24 手动部署地质纸偶剧场版。公网首页、文献库、分析页和维护入口返回与本地生产构建相同的前端入口资源。公网分析资源包含主题分布、文献发布时间轨和地区标本点阵。数据库健康检查通过，发布前后公开聚合结果一致，含 8 条公开文献、3 个主题、8 个发布月份、2 个地区。[GitHub Actions 检查](https://github.com/Lain006/zjjinkuangye-react/actions/runs/45260193312)

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

容器启动顺序为迁移、种子导入、已核验证据回填、启动 API。证据回填按文献 ID 和原编目 URL 校验，只补空字段并保留原有状态，写入和审计同事务提交。Render 启动日志的 `Evidence backfill` 按状态列出总数、核验命中数、完整数和更新数。
